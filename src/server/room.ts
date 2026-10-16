import { MAX_PLAYERS } from "@/game/engine/constants";
import { parseLevel, type LevelDef } from "@/game/engine/level";
import { nextFreeCowboy } from "@/game/cowboys";
import { STEP_MS } from "@/net/clock";
import type { ClientMsg, ErrorCode, RoomView, ServerMsg } from "@/net/protocol";
import { createMatch, type Match } from "./match";

/** Quanto tempo um desconectado mantém o lugar (F5, queda de Wi-Fi). */
export const GRACE_MS = 30_000;
/** Sala sem ninguém conectado por este tempo é removida. */
export const EMPTY_MS = 60_000;
/** Depois de concluir a fase, todos voltam ao lobby. */
export const CLEARED_MS = 5_000;

export type Send = (msg: ServerMsg) => void;
export type RoomDeps = {
  random: () => number;
  newId: () => string;
  levels: (LevelDef & { slug: string })[];
  /** Grava o tempo e devolve o recorde para esse número de jogadores. */
  onCleared: (slug: string, players: number, timeMs: number) => Promise<number | null>;
};
export type JoinResult = { ok: true; id: string } | { ok: false; code: ErrorCode };
export type Room = ReturnType<typeof createRoom>;

type Member = { id: string; token: string; nick: string; cowboy: number; send: Send | null; offSince: number };

/** Regras de uma sala. Sem sockets nem relógio: quem chama passa `send` e `now`. */
export function createRoom(code: string, deps: RoomDeps, now: number) {
  let members: Member[] = [];
  let state: RoomView["state"] = "lobby";
  let slug: string | null = null;
  let emptySince: number | null = now;
  let match: Match | null = null;
  /** Ids na ordem dos jogadores da partida (assento = índice). */
  let seats: string[] = [];
  let clearedAt: number | null = null;

  const find = (id: string) => members.find((m) => m.id === id);
  const view = (): RoomView => ({
    code,
    state,
    slug,
    members: members.map((m, i) => ({
      id: m.id,
      nick: m.nick,
      cowboy: m.cowboy,
      host: i === 0,
      online: m.send !== null,
      playing: seats.includes(m.id),
    })),
  });
  const broadcast = (msg: ServerMsg) => {
    for (const m of members) m.send?.(msg);
  };
  /** Mensagens da partida só para quem está jogando. */
  const toSeats = (msg: ServerMsg) => {
    for (const id of seats) find(id)?.send?.(msg);
  };
  const sendRoom = () => broadcast({ t: "room", room: view() });
  const startMsg = (): ServerMsg => ({ t: "start", slug: slug!, seats: seats.map((id) => ({ id, cowboy: find(id)!.cowboy })) });
  const offlineSeats = () => seats.filter((id) => !find(id)?.send);
  const pausedMsg = (now: number): ServerMsg => {
    const since = Math.min(...offlineSeats().map((id) => find(id)!.offSince));
    return { t: "paused", ids: offlineSeats(), ms: Math.max(0, since + GRACE_MS - now) };
  };
  const toLobby = () => {
    state = "lobby";
    match = null;
    seats = [];
    clearedAt = null;
  };

  function join(nick: string, token: string | null, send: Send, now: number): JoinResult {
    let m = token ? members.find((x) => x.token === token) : undefined;
    if (m) {
      m.send = send;
      m.offSince = 0;
    } else {
      if (members.length >= MAX_PLAYERS) return { ok: false, code: "full" };
      const cowboy = nextFreeCowboy(members.map((x) => x.cowboy), -1, 1)!;
      m = { id: deps.newId(), token: deps.newId(), nick, cowboy, send, offSince: 0 };
      members.push(m);
    }
    emptySince = null;
    send({ t: "welcome", you: m.id, token: m.token });
    sendRoom();
    if (match && seats.includes(m.id)) {
      send(startMsg());
      send(match.snapshot());
      if (state === "paused") {
        if (offlineSeats().length === 0) {
          state = "playing";
          toSeats(match.resume(now));
          sendRoom();
        } else send(pausedMsg(now));
      }
    }
    return { ok: true, id: m.id };
  }

  function disconnect(id: string, send: Send, now: number) {
    const m = find(id);
    if (!m || m.send !== send) return; // socket antigo de quem já reconectou
    m.send = null;
    m.offSince = now;
    if (match && seats.includes(id) && clearedAt === null) {
      if (state === "playing") {
        state = "paused";
        match.pause();
      }
      toSeats(pausedMsg(now));
    }
    if (!members.some((x) => x.send)) emptySince = now;
    sendRoom();
  }

  function handle(id: string, msg: ClientMsg, now: number): ErrorCode | "drop" | null {
    const m = find(id);
    if (!m) return "drop";
    const isHost = members[0] === m;
    switch (msg.t) {
      case "cowboy": {
        if (state !== "lobby") return "bad_state";
        const c = nextFreeCowboy(members.map((x) => x.cowboy), m.cowboy, msg.dir);
        if (c !== null) {
          m.cowboy = c;
          sendRoom();
        }
        return null;
      }
      case "pick": {
        if (!isHost) return "not_host";
        if (state !== "lobby") return "bad_state";
        const picked = msg.slug === "random" ? deps.levels[Math.floor(deps.random() * deps.levels.length)].slug : msg.slug;
        if (!deps.levels.some((l) => l.slug === picked)) return "bad_state";
        slug = picked;
        sendRoom();
        return null;
      }
      case "start": {
        if (!isHost) return "not_host";
        const online = members.filter((x) => x.send);
        if (state !== "lobby" || !slug || online.length < 2) return "bad_state";
        const def = deps.levels.find((l) => l.slug === slug)!;
        seats = online.map((x) => x.id);
        match = createMatch(parseLevel(def), seats.length, now);
        state = "playing";
        toSeats(startMsg());
        sendRoom();
        return null;
      }
      case "toLobby":
        if (!isHost) return "not_host";
        if (state === "lobby") return "bad_state";
        toLobby();
        sendRoom();
        return null;
      case "restart":
        if (state === "playing" && match && seats.includes(id)) match.restart();
        return null;
      case "input": {
        const seat = seats.indexOf(id);
        if (!match || seat < 0) return null; // input atrasado de partida que já acabou
        return match.input(seat, msg.f, msg.bits, now) ? null : "drop";
      }
      case "resync":
        if (match && seats.includes(id)) m.send?.(match.snapshot());
        return null;
      case "ping":
        m.send?.({ t: "pong", at: msg.at, frame: match ? match.virtualFrame(now) : 0 });
        return null;
      case "join":
        return "bad_state";
    }
  }

  function tick(now: number) {
    const expired = members.filter((m) => !m.send && now - m.offSince >= GRACE_MS);
    if (expired.length) {
      members = members.filter((m) => !expired.includes(m));
      if (expired.some((m) => seats.includes(m.id))) toLobby(); // a partida não continua sem ele
      sendRoom();
    }
    if (!match || state !== "playing") return;
    for (const msg of match.tick(now)) toSeats(msg);
    if (clearedAt === null && match.world().status === "cleared") {
      clearedAt = now;
      const timeMs = Math.round(match.world().frame * STEP_MS);
      deps
        .onCleared(slug!, seats.length, timeMs)
        .catch(() => null)
        .then((bestMs) => toSeats({ t: "cleared", timeMs, bestMs }));
    }
    if (clearedAt !== null && now - clearedAt >= CLEARED_MS) {
      toLobby();
      sendRoom();
    }
  }

  const isDead = (now: number) => emptySince !== null && now - emptySince >= EMPTY_MS;

  return { code, join, disconnect, handle, tick, isDead, view };
}
