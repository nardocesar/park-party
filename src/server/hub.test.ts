import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseLevel } from "@/game/engine/level";
import { LEVELS } from "@/game/levels";
import { RIGHT } from "@/net/bits";
import type { ServerMsg } from "@/net/protocol";
import { createTimeline } from "@/net/timeline";
import { createHub, type Hub } from "./hub";
import { COUNTDOWN_MS } from "./match";
import { testClient } from "./testing/client";
import { TINY } from "./testing/tiny";

let server: Server;
let hub: Hub;
let url: string;
let cleared: [string, number, number][] = [];

beforeEach(async () => {
  cleared = [];
  hub = createHub({
    random: () => 0,
    levels: [...LEVELS, TINY],
    onCleared: async (slug, players, ms) => {
      cleared.push([slug, players, ms]);
      return 999;
    },
  });
  server = createServer();
  server.on("upgrade", (req, socket, head) => hub.handleUpgrade(req, socket, head));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `ws://localhost:${(server.address() as AddressInfo).port}/ws`;
});

afterEach(async () => {
  hub.close();
  await new Promise((resolve) => server.close(resolve));
});

describe("hub", () => {
  it("cria sala e outro jogador entra pelo código", async () => {
    const a = await testClient(url);
    a.send({ t: "join", code: null, nick: "Ana", token: null });
    const { room } = await a.next("room");
    expect(room.code).toMatch(/^[A-HJ-NP-Z]{4}$/);

    const b = await testClient(url);
    b.send({ t: "join", code: room.code, nick: "Bia", token: null });
    const { room: seen } = await b.next("room");
    expect(seen.members.map((m) => m.nick)).toEqual(["Ana", "Bia"]);
  });

  it("código inexistente recebe not_found e é desconectado", async () => {
    const c = await testClient(url);
    c.send({ t: "join", code: "ZZZZ", nick: "Ana", token: null });
    expect(await c.next("error")).toEqual({ t: "error", code: "not_found" });
    await c.closed;
  });

  it("mensagem inválida derruba o socket com 1008", async () => {
    const c = await testClient(url);
    c.ws.send("{lixo");
    expect(await c.closed).toBe(1008);
  });

  it("primeira mensagem precisa ser join", async () => {
    const c = await testClient(url);
    c.send({ t: "start" });
    expect(await c.closed).toBe(1008);
  });

  it("reconexão com token devolve o mesmo id", async () => {
    const a = await testClient(url);
    a.send({ t: "join", code: null, nick: "Ana", token: null });
    const { you, token } = await a.next("welcome");
    const { room } = await a.next("room");
    a.ws.close();
    await a.closed;
    const again = await testClient(url);
    again.send({ t: "join", code: room.code, nick: "Ana", token });
    expect((await again.next("welcome")).you).toBe(you);
  });

  it("rajada de mensagens acima do limite derruba o socket", async () => {
    const c = await testClient(url);
    c.send({ t: "join", code: null, nick: "Ana", token: null });
    for (let i = 0; i < 200; i++) c.send({ t: "ping", at: i });
    expect(await c.closed).toBe(1008);
  });
});

/** Reproduz o confirmado a partir do que o cliente recebeu e confere cada hash. */
function replay(inbox: ServerMsg[]) {
  const tl = createTimeline(parseLevel(TINY), 2, -1);
  let checked = 0;
  let mismatches = 0;
  for (const m of inbox) {
    if (m.t === "tick") tl.confirm(m.s, m.changes, m.resets);
    if (m.t === "hash" && tl.frame() === m.s) {
      checked++;
      if (tl.hash() !== m.h) mismatches++;
    }
  }
  return { checked, mismatches, status: tl.world().status };
}

it("partida com latências diferentes: hashes batem em todos e a fase conclui", async () => {
  const a = await testClient(url);
  a.send({ t: "join", code: null, nick: "Ana", token: null });
  const { room } = await a.next("room");
  const b = await testClient(url);
  b.send({ t: "join", code: room.code, nick: "Bia", token: null });
  await b.next("welcome");
  a.send({ t: "pick", slug: "99-1" });
  a.send({ t: "start" });
  await a.next("start");
  await b.next("start");
  // os dois seguram → desde o quadro 1; o de Bia chega depois da contagem, atrasado:
  // o servidor reagenda para o próximo quadro dele e todos precisam continuar iguais
  a.send({ t: "input", f: 1, bits: RIGHT }, 30);
  b.send({ t: "input", f: 1, bits: RIGHT }, COUNTDOWN_MS + 300);

  const doneA = await a.next("cleared", 15_000);
  const doneB = await b.next("cleared", 15_000);
  expect(doneA).toEqual(doneB);
  expect(doneA.bestMs).toBe(999);
  for (const c of [a, b]) {
    const r = replay(c.inbox);
    expect(r.checked).toBeGreaterThan(0);
    expect(r.mismatches).toBe(0);
    expect(r.status).toBe("cleared");
  }
  expect(cleared).toEqual([["99-1", 2, doneA.timeMs]]);
}, 20_000);
