import { describe, expect, it } from "vitest";
import { LEVELS } from "@/game/levels";
import type { RoomView, ServerMsg } from "@/net/protocol";
import { createRoom, EMPTY_MS, GRACE_MS } from "./room";

function setup() {
  let n = 0;
  const room = createRoom("ABCD", { random: () => 0, newId: () => `id${++n}`, levels: LEVELS }, 0);
  const client = () => {
    const msgs: ServerMsg[] = [];
    const send = (m: ServerMsg) => void msgs.push(m);
    const last = <T extends ServerMsg["t"]>(t: T) => msgs.findLast((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined;
    return { msgs, send, last, room: () => last("room")!.room as RoomView };
  };
  return { room, client };
}

describe("sala — lobby", () => {
  it("primeiro a entrar é anfitrião; cada um recebe welcome e um cowboy livre", () => {
    const { room, client } = setup();
    const a = client();
    const b = client();
    const ra = room.join("Ana", null, a.send);
    room.join("Bia", null, b.send);
    expect(ra).toEqual({ ok: true, id: "id1" });
    expect(a.last("welcome")).toEqual({ t: "welcome", you: "id1", token: "id2" });
    expect(a.room().members.map((m) => [m.nick, m.cowboy, m.host])).toEqual([["Ana", 0, true], ["Bia", 1, false]]);
  });

  it("token devolve o mesmo membro sem duplicar", () => {
    const { room, client } = setup();
    const a = client();
    room.join("Ana", null, a.send);
    room.disconnect("id1", a.send, 100);
    const a2 = client();
    expect(room.join("Outro", "id2", a2.send)).toEqual({ ok: true, id: "id1" });
    expect(a2.room().members).toHaveLength(1);
    expect(a2.room().members[0]).toMatchObject({ nick: "Ana", online: true });
  });

  it("sala cheia recusa o nono", () => {
    const { room, client } = setup();
    for (let i = 0; i < 8; i++) room.join(`P${i}`, null, client().send);
    expect(room.join("Nono", null, client().send)).toEqual({ ok: false, code: "full" });
  });

  it("trocar de cowboy pula os ocupados", () => {
    const { room, client } = setup();
    const a = client();
    room.join("Ana", null, a.send);
    room.join("Bia", null, client().send);
    expect(room.handle("id1", { t: "cowboy", dir: 1 })).toBeNull();
    expect(a.room().members[0].cowboy).toBe(2);
    room.handle("id1", { t: "cowboy", dir: -1 });
    expect(a.room().members[0].cowboy).toBe(0);
  });

  it("só o anfitrião escolhe a fase; random usa o sorteio; slug inexistente é recusado", () => {
    const { room, client } = setup();
    const a = client();
    room.join("Ana", null, a.send);
    room.join("Bia", null, client().send);
    expect(room.handle("id3", { t: "pick", slug: "1-2" })).toBe("not_host");
    expect(room.handle("id1", { t: "pick", slug: "1-2" })).toBeNull();
    expect(a.room().slug).toBe("1-2");
    room.handle("id1", { t: "pick", slug: "random" });
    expect(a.room().slug).toBe(LEVELS[0].slug);
    expect(room.handle("id1", { t: "pick", slug: "99-9" })).toBe("bad_state");
  });

  it("desconectado mantém o lugar por GRACE_MS; depois sai e o anfitrião passa adiante", () => {
    const { room, client } = setup();
    const a = client();
    const b = client();
    room.join("Ana", null, a.send);
    room.join("Bia", null, b.send);
    room.disconnect("id1", a.send, 1000);
    room.tick(1000 + GRACE_MS - 1);
    expect(b.room().members[0]).toMatchObject({ nick: "Ana", online: false, host: true });
    room.tick(1000 + GRACE_MS);
    expect(b.room().members).toEqual([expect.objectContaining({ nick: "Bia", host: true })]);
  });

  it("fechar o socket antigo não derruba quem já reconectou", () => {
    const { room, client } = setup();
    const old = client();
    room.join("Ana", null, old.send);
    const fresh = client();
    room.join("Ana", "id2", fresh.send);
    room.disconnect("id1", old.send, 10);
    expect(fresh.room().members[0].online).toBe(true);
  });

  it("sala sem ninguém conectado morre depois de EMPTY_MS", () => {
    const { room, client } = setup();
    const a = client();
    room.join("Ana", null, a.send);
    expect(room.isDead(EMPTY_MS * 10)).toBe(false);
    room.disconnect("id1", a.send, 500);
    expect(room.isDead(500 + EMPTY_MS - 1)).toBe(false);
    expect(room.isDead(500 + EMPTY_MS)).toBe(true);
  });

  it("ping responde pong com quadro 0 fora de partida", () => {
    const { room, client } = setup();
    const a = client();
    room.join("Ana", null, a.send);
    room.handle("id1", { t: "ping", at: 42 });
    expect(a.last("pong")).toEqual({ t: "pong", at: 42, frame: 0 });
  });
});
