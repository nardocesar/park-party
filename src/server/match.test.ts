import { describe, expect, it } from "vitest";
import { parseLevel } from "@/game/engine/level";
import { createWorld, step } from "@/game/engine/world";
import { decodeInput, RIGHT } from "@/net/bits";
import { STEP_MS } from "@/net/clock";
import type { ServerMsg } from "@/net/protocol";
import { createTimeline } from "@/net/timeline";
import { COUNTDOWN_MS, createMatch, MAX_FUTURE } from "./match";
import { TINY } from "./testing/tiny";

const level = parseLevel(TINY);
/** Instante em que o quadro f fica devido (com folga contra arredondamento). */
const at = (f: number) => COUNTDOWN_MS + f * STEP_MS + 0.5;
const ticks = (msgs: ServerMsg[]) => msgs.filter((m) => m.t === "tick") as Extract<ServerMsg, { t: "tick" }>[];

describe("partida autoritativa", () => {
  it("a fase de teste se conclui andando para a direita", () => {
    const w = createWorld(level, 2);
    for (let f = 0; f < 600 && w.status === "playing"; f++) step(w, [decodeInput(RIGHT), decodeInput(RIGHT)]);
    expect(w.status).toBe("cleared");
  });

  it("nada acontece durante a contagem", () => {
    const m = createMatch(level, 2, 0);
    expect(m.tick(COUNTDOWN_MS - 1)).toEqual([]);
    expect(m.frame()).toBe(0);
  });

  it("input a tempo vale no quadro carimbado; atrasado vale no próximo quadro", () => {
    const m = createMatch(level, 2, 0);
    expect(m.input(0, 5, RIGHT, at(0))).toBe(true);
    const first = ticks(m.tick(at(6)));
    expect(first.flatMap((t) => t.changes)).toEqual([[5, 0, RIGHT]]);
    m.input(1, 2, RIGHT, at(6)); // carimbado no 2, mas o servidor já está no 6
    const later = ticks(m.tick(at(8)));
    expect(later.flatMap((t) => t.changes)).toEqual([[7, 1, RIGHT]]);
  });

  it("transmite a cada 2 quadros e o hash ao cruzar múltiplos de 60; o hash bate com o cliente", () => {
    const m = createMatch(level, 2, 0);
    m.input(0, 1, RIGHT, at(0));
    const msgs: ServerMsg[] = [];
    for (let f = 1; f <= 61; f++) msgs.push(...m.tick(at(f)));
    expect(ticks(msgs).map((t) => t.s)).toEqual(Array.from({ length: 30 }, (_, i) => 2 * (i + 1)));
    const hash = msgs.find((x) => x.t === "hash") as Extract<ServerMsg, { t: "hash" }>;
    expect(hash.s).toBe(60);

    const client = createTimeline(level, 2, 1);
    for (const t of ticks(msgs)) client.confirm(t.s, t.changes, t.resets);
    expect(client.frame()).toBe(60);
    expect(client.hash()).toBe(hash.h);
  });

  it("reinício pedido entra no próximo quadro", () => {
    const m = createMatch(level, 2, 0);
    m.tick(at(10));
    m.restart();
    const t = ticks(m.tick(at(12)));
    expect(t.flatMap((x) => x.resets)).toEqual([11]);
    expect(m.world().resets).toBe(1);
  });

  it("pausa congela; retomar dá contagem e o próximo quadro só depois dela", () => {
    const m = createMatch(level, 2, 0);
    m.tick(at(10));
    m.pause();
    expect(m.tick(at(500))).toEqual([]);
    expect(m.resume(10_000)).toEqual({ t: "resume", s: 10, inMs: COUNTDOWN_MS });
    m.tick(10_000 + COUNTDOWN_MS - 1);
    expect(m.frame()).toBe(10);
    m.tick(10_000 + COUNTDOWN_MS + STEP_MS + 0.5);
    expect(m.frame()).toBe(11);
  });

  it("input enviado durante a contagem é aceito (quem já segura uma tecla ao começar)", () => {
    const m = createMatch(level, 2, 0);
    expect(m.input(0, 1, RIGHT, 30)).toBe(true);
    // e na contagem da volta de uma pausa (quadro virtual abaixo do confirmado)
    m.tick(at(200));
    m.pause();
    m.resume(50_000);
    expect(m.input(0, m.frame() + 1, RIGHT, 50_010)).toBe(true);
  });

  it("input carimbado longe demais no futuro é recusado", () => {
    const m = createMatch(level, 2, 0);
    expect(m.input(0, MAX_FUTURE + 5, RIGHT, at(0))).toBe(false);
  });

  it("para de avançar quando a fase é concluída e manda o último tick", () => {
    const m = createMatch(level, 2, 0);
    m.input(0, 1, RIGHT, at(0));
    m.input(1, 1, RIGHT, at(0));
    const msgs: ServerMsg[] = [];
    for (let f = 1; f <= 600 && m.world().status === "playing"; f++) msgs.push(...m.tick(at(f)));
    expect(m.world().status).toBe("cleared");
    expect(ticks(msgs).at(-1)!.s).toBe(m.frame());
  });

  it("snapshot traz quadro, mundo e bits", () => {
    const m = createMatch(level, 2, 0);
    m.input(0, 1, RIGHT, at(0));
    m.tick(at(4));
    const snap = m.snapshot() as Extract<ServerMsg, { t: "snapshot" }>;
    expect(snap.s).toBe(4);
    expect(snap.bits).toEqual([RIGHT, 0]);
    expect(typeof snap.world).toBe("string");
  });
});
