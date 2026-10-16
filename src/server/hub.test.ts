import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LEVELS } from "@/game/levels";
import { createHub, type Hub } from "./hub";
import { testClient } from "./testing/client";

let server: Server;
let hub: Hub;
let url: string;

beforeEach(async () => {
  hub = createHub({ random: () => 0, levels: LEVELS });
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
