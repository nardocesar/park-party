import { MAX_PLAYERS } from "@/game/engine/constants";
import type { LevelDef } from "@/game/engine/level";
import { nextFreeCowboy } from "@/game/cowboys";
import type { ClientMsg, ErrorCode, RoomView, ServerMsg } from "@/net/protocol";

/** Quanto tempo um desconectado mantém o lugar (F5, queda de Wi-Fi). */
export const GRACE_MS = 30_000;
/** Sala sem ninguém conectado por este tempo é removida. */
export const EMPTY_MS = 60_000;

export type Send = (msg: ServerMsg) => void;
export type RoomDeps = { random: () => number; newId: () => string; levels: (LevelDef & { slug: string })[] };
export type JoinResult = { ok: true; id: string } | { ok: false; code: ErrorCode };
export type Room = ReturnType<typeof createRoom>;

type Member = { id: string; token: string; nick: string; cowboy: number; send: Send | null; offSince: number };

/** Regras de uma sala. Sem sockets nem relógio: quem chama passa `send` e `now`. */
export function createRoom(code: string, deps: RoomDeps, now: number) {
  let members: Member[] = [];
  const state: RoomView["state"] = "lobby";
  let slug: string | null = null;
  let emptySince: number | null = now;

  const find = (id: string) => members.find((m) => m.id === id);
  const view = (): RoomView => ({
    code,
    state,
    slug,
    members: members.map((m, i) => ({ id: m.id, nick: m.nick, cowboy: m.cowboy, host: i === 0, online: m.send !== null, playing: false })),
  });
  const broadcast = (msg: ServerMsg) => {
    for (const m of members) m.send?.(msg);
  };
  const sendRoom = () => broadcast({ t: "room", room: view() });

  function join(nick: string, token: string | null, send: Send): JoinResult {
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
    return { ok: true, id: m.id };
  }

  function disconnect(id: string, send: Send, now: number) {
    const m = find(id);
    if (!m || m.send !== send) return; // socket antigo de quem já reconectou
    m.send = null;
    m.offSince = now;
    if (!members.some((x) => x.send)) emptySince = now;
    sendRoom();
  }

  function handle(id: string, msg: ClientMsg): ErrorCode | "drop" | null {
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
      case "ping":
        m.send?.({ t: "pong", at: msg.at, frame: 0 });
        return null;
      default:
        return "bad_state";
    }
  }

  function tick(now: number) {
    const expired = members.filter((m) => !m.send && now - m.offSince >= GRACE_MS);
    if (expired.length === 0) return;
    members = members.filter((m) => !expired.includes(m));
    sendRoom();
  }

  const isDead = (now: number) => emptySince !== null && now - emptySince >= EMPTY_MS;

  return { code, join, disconnect, handle, tick, isDead, view };
}
