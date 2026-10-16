import { describe, expect, it } from "vitest";
import { LEVELS } from "@/game/levels";
import type { RoomView, ServerMsg } from "@/net/protocol";
import { RIGHT } from "@/net/bits";
import { STEP_MS } from "@/net/clock";
import { COUNTDOWN_MS } from "./match";
import { CLEARED_MS, createRoom, EMPTY_MS, GRACE_MS } from "./room";
import { TINY } from "./testing/tiny";

function setup() {
  let n = 0;
  const cleared: [string, number, number][] = [];
  const room = createRoom(
    "ABCD",
    {
      random: () => 0,
      newId: () => `id${++n}`,
      levels: [...LEVELS, TINY],
      onCleared: async (slug, players, ms) => {
        cleared.push([slug, players, ms]);
        return 1234;
      },
    },
    0,
  );
  const client = () => {
    const msgs: ServerMsg[] = [];
    const send = (m: ServerMsg) => void msgs.push(m);
    const last = <T extends ServerMsg["t"]>(t: T) => msgs.findLast((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined;
    return { msgs, send, last, room: () => last("room")!.room as RoomView };
  };
  return { room, client, cleared };
}

describe("sala — lobby", () => {
  it("primeiro a entrar é anfitrião; cada um recebe welcome e um cowboy livre", () => {
    const { room, client } = setup();
    const a = client();
    const b = client();
    const ra = room.join("Ana", null, a.send, 0);
    room.join("Bia", null, b.send, 0);
    expect(ra).toEqual({ ok: true, id: "id1" });
    expect(a.last("welcome")).toEqual({ t: "welcome", you: "id1", token: "id2" });
    expect(a.room().members.map((m) => [m.nick, m.cowboy, m.host])).toEqual([["Ana", 0, true], ["Bia", 1, false]]);
  });

  it("token devolve o mesmo membro sem duplicar", () => {
    const { room, client } = setup();
    const a = client();
    room.join("Ana", null, a.send, 0);
    room.disconnect("id1", a.send, 100);
    const a2 = client();
    expect(room.join("Outro", "id2", a2.send, 0)).toEqual({ ok: true, id: "id1" });
    expect(a2.room().members).toHaveLength(1);
    expect(a2.room().members[0]).toMatchObject({ nick: "Ana", online: true });
  });

  it("sala cheia recusa o nono", () => {
    const { room, client } = setup();
    for (let i = 0; i < 8; i++) room.join(`P${i}`, null, client().send, 0);
    expect(room.join("Nono", null, client().send, 0)).toEqual({ ok: false, code: "full" });
  });

  it("trocar de cowboy pula os ocupados", () => {
    const { room, client } = setup();
    const a = client();
    room.join("Ana", null, a.send, 0);
    room.join("Bia", null, client().send, 0);
    expect(room.handle("id1", { t: "cowboy", dir: 1 }, 0)).toBeNull();
    expect(a.room().members[0].cowboy).toBe(2);
    room.handle("id1", { t: "cowboy", dir: -1 }, 0);
    expect(a.room().members[0].cowboy).toBe(0);
  });

  it("só o anfitrião escolhe a fase; random usa o sorteio; slug inexistente é recusado", () => {
    const { room, client } = setup();
    const a = client();
    room.join("Ana", null, a.send, 0);
    room.join("Bia", null, client().send, 0);
    expect(room.handle("id3", { t: "pick", slug: "1-2" }, 0)).toBe("not_host");
    expect(room.handle("id1", { t: "pick", slug: "1-2" }, 0)).toBeNull();
    expect(a.room().slug).toBe("1-2");
    room.handle("id1", { t: "pick", slug: "random" }, 0);
    expect(a.room().slug).toBe(LEVELS[0].slug);
    expect(room.handle("id1", { t: "pick", slug: "99-9" }, 0)).toBe("bad_state");
  });

  it("desconectado mantém o lugar por GRACE_MS; depois sai e o anfitrião passa adiante", () => {
    const { room, client } = setup();
    const a = client();
    const b = client();
    room.join("Ana", null, a.send, 0);
    room.join("Bia", null, b.send, 0);
    room.disconnect("id1", a.send, 1000);
    room.tick(1000 + GRACE_MS - 1);
    expect(b.room().members[0]).toMatchObject({ nick: "Ana", online: false, host: true });
    room.tick(1000 + GRACE_MS);
    expect(b.room().members).toEqual([expect.objectContaining({ nick: "Bia", host: true })]);
  });

  it("fechar o socket antigo não derruba quem já reconectou", () => {
    const { room, client } = setup();
    const old = client();
    room.join("Ana", null, old.send, 0);
    const fresh = client();
    room.join("Ana", "id2", fresh.send, 0);
    room.disconnect("id1", old.send, 10);
    expect(fresh.room().members[0].online).toBe(true);
  });

  it("sala sem ninguém conectado morre depois de EMPTY_MS", () => {
    const { room, client } = setup();
    const a = client();
    room.join("Ana", null, a.send, 0);
    expect(room.isDead(EMPTY_MS * 10)).toBe(false);
    room.disconnect("id1", a.send, 500);
    expect(room.isDead(500 + EMPTY_MS - 1)).toBe(false);
    expect(room.isDead(500 + EMPTY_MS)).toBe(true);
  });

  it("ping responde pong com quadro 0 fora de partida", () => {
    const { room, client } = setup();
    const a = client();
    room.join("Ana", null, a.send, 0);
    room.handle("id1", { t: "ping", at: 42 }, 0);
    expect(a.last("pong")).toEqual({ t: "pong", at: 42, frame: 0 });
  });
});

/** Sala com Ana (anfitriã, id1) e Bia (id3) jogando a TINY a partir de t = 0. */
function playing() {
  const s = setup();
  const a = s.client();
  const b = s.client();
  s.room.join("Ana", null, a.send, 0);
  s.room.join("Bia", null, b.send, 0);
  s.room.handle("id1", { t: "pick", slug: "99-1" }, 0);
  expect(s.room.handle("id1", { t: "start" }, 0)).toBeNull();
  return { ...s, a, b };
}
const at = (f: number) => COUNTDOWN_MS + f * STEP_MS + 0.5;

describe("sala — partida", () => {
  it("só o anfitrião inicia, com fase escolhida e 2 conectados; assentos na ordem de entrada", () => {
    const s = setup();
    const a = s.client();
    s.room.join("Ana", null, a.send, 0);
    s.room.handle("id1", { t: "pick", slug: "99-1" }, 0);
    expect(s.room.handle("id1", { t: "start" }, 0)).toBe("bad_state"); // sozinha
    const b = s.client();
    s.room.join("Bia", null, b.send, 0);
    expect(s.room.handle("id3", { t: "start" }, 0)).toBe("not_host");
    expect(s.room.handle("id1", { t: "start" }, 0)).toBeNull();
    expect(b.last("start")).toEqual({ t: "start", slug: "99-1", seats: [{ id: "id1", cowboy: 0 }, { id: "id3", cowboy: 1 }] });
    expect(a.room().state).toBe("playing");
    expect(a.room().members.every((m) => m.playing)).toBe(true);
  });

  it("inputs viram ticks; concluir grava o tempo, avisa todos e volta ao lobby", async () => {
    const { room, a, b, cleared } = playing();
    room.handle("id1", { t: "input", f: 1, bits: RIGHT }, at(0));
    room.handle("id3", { t: "input", f: 1, bits: RIGHT }, at(0));
    let f = 1;
    while (!cleared.length && f < 600) room.tick(at(f++));
    expect(cleared).toEqual([["99-1", 2, expect.any(Number)]]);
    expect(b.msgs.some((m) => m.t === "tick")).toBe(true);
    await new Promise((r) => setTimeout(r, 0)); // deixa o onCleared resolver
    expect(b.last("cleared")).toEqual({ t: "cleared", timeMs: cleared[0][2], bestMs: 1234 });
    room.tick(at(f) + CLEARED_MS);
    expect(a.room().state).toBe("lobby");
  });

  it("queda de quem está jogando pausa; reconexão manda start + snapshot e retoma", () => {
    const { room, a, b } = playing();
    room.tick(at(30));
    const bTok = b.last("welcome")!.token;
    room.disconnect("id3", b.send, at(30));
    expect(a.last("paused")).toMatchObject({ t: "paused", ids: ["id3"] });
    expect(a.room().state).toBe("paused");

    const b2: ServerMsg[] = [];
    const send2 = (m: ServerMsg) => void b2.push(m);
    expect(room.join("Bia", bTok, send2, at(30) + 5000)).toEqual({ ok: true, id: "id3" });
    expect(b2.map((m) => m.t)).toEqual(expect.arrayContaining(["welcome", "room", "start", "snapshot", "resume"]));
    expect(a.last("resume")).toMatchObject({ t: "resume", s: 30 });
    expect(a.room().state).toBe("playing");
  });

  it("prazo expira na pausa: volta ao lobby sem ele e o próximo vira anfitrião", () => {
    const { room, a, b } = playing();
    room.tick(at(10));
    room.disconnect("id1", a.send, at(10));
    expect(b.room().state).toBe("paused");
    room.tick(at(10) + GRACE_MS + 1); // +1: at() é fracionário e a soma perde precisão
    const r = b.room();
    expect(r.state).toBe("lobby");
    expect(r.members.map((m) => [m.nick, m.host])).toEqual([["Bia", true]]);
  });

  it("quem entra durante a partida espera e não recebe ticks", () => {
    const { room, client } = playing();
    const c = client();
    room.join("Cris", null, c.send, at(0));
    room.tick(at(20));
    expect(c.room().members.find((m) => m.nick === "Cris")!.playing).toBe(false);
    expect(c.msgs.some((m) => m.t === "tick")).toBe(false);
  });

  it("resync devolve snapshot só para quem pediu", () => {
    const { room, a, b } = playing();
    room.tick(at(10));
    room.handle("id3", { t: "resync" }, at(10));
    expect(b.last("snapshot")).toMatchObject({ t: "snapshot", s: 10 });
    expect(a.last("snapshot")).toBeUndefined();
  });

  it("anfitrião volta todos ao lobby; reinício pedido aparece no tick", () => {
    const { room, a, b } = playing();
    room.tick(at(10));
    room.handle("id3", { t: "restart" }, at(10));
    room.tick(at(12));
    expect(b.msgs.some((m) => m.t === "tick" && m.resets.includes(11))).toBe(true);
    expect(room.handle("id3", { t: "toLobby" }, at(12))).toBe("not_host");
    expect(room.handle("id1", { t: "toLobby" }, at(12))).toBeNull();
    expect(a.room().state).toBe("lobby");
  });

  it("input absurdo derruba o socket", () => {
    const { room } = playing();
    expect(room.handle("id1", { t: "input", f: 9_999_999, bits: 1 }, at(0))).toBe("drop");
  });
});
