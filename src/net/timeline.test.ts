import { describe, expect, it } from "vitest";
import { parseLevel } from "@/game/engine/level";
import { hashWorld, worldToJson } from "@/game/engine/snapshot";
import { createWorld, step } from "@/game/engine/world";
import { LEVELS } from "@/game/levels";
import { decodeInput, JUMP, RIGHT } from "./bits";
import { fuzzInputs } from "./testing/fuzz";
import { createTimeline, MAX_AHEAD, type Change } from "./timeline";

/** Inputs por quadro → mudanças; o input de índice f vale no quadro f + 1. */
function toChanges(inputs: number[][]): Change[] {
  const out: Change[] = [];
  let prev = inputs[0].map(() => 0);
  inputs.forEach((bits, i) => {
    bits.forEach((b, seat) => b !== prev[seat] && out.push([i + 1, seat, b]));
    prev = bits;
  });
  return out;
}

describe("linha do tempo (rollback)", () => {
  it("previsão errada + confirmação em pedaços dá o mesmo hash da simulação direta", () => {
    const FRAMES = 600;
    for (const [i, def] of LEVELS.entries()) {
      if (i % 8 !== 0) continue; // amostra de mundos; o teste de snapshot cobre todas as fases
      for (const players of [2, 4, 8]) {
        const level = parseLevel(def);
        const inputs = fuzzInputs(i * 10 + players, players, FRAMES);
        const direct = createWorld(level, players);
        for (const f of inputs) step(direct, f.map(decodeInput));

        const changes = toChanges(inputs);
        const tl = createTimeline(level, players, 0);
        let s = 0;
        while (s < FRAMES) {
          const next = Math.min(FRAMES, s + 1 + (s % 7));
          // o próprio input chega antes da confirmação (como no cliente real)
          for (const [f, seat, b] of changes) if (seat === 0 && f > s && f <= next + 10) tl.setOwn(f, b);
          tl.predict(next + 10);
          tl.confirm(next, changes.filter(([f]) => f > s && f <= next), []);
          s = next;
        }
        expect(tl.hash(), `${def.slug} com ${players}`).toBe(hashWorld(direct));
      }
    }
  });

  it("o próprio input aparece na previsão antes de ser confirmado", () => {
    const tl = createTimeline(parseLevel(LEVELS[0]), 2, 0);
    const x0 = tl.world().players[0].x;
    tl.setOwn(1, RIGHT);
    const { world, frame } = tl.predict(20);
    expect(frame).toBe(20);
    expect(world.players[0].x).toBeGreaterThan(x0);
    expect(tl.world().players[0].x).toBe(x0);
  });

  it("os outros jogadores repetem o último input confirmado", () => {
    const tl = createTimeline(parseLevel(LEVELS[0]), 2, 0);
    tl.confirm(5, [[1, 1, RIGHT]], []);
    const at5 = tl.world().players[1].x;
    expect(tl.predict(25).world.players[1].x).toBeGreaterThan(at5);
  });

  it("som de um quadro toca uma vez só, mesmo ressimulado", () => {
    const tl = createTimeline(parseLevel(LEVELS[0]), 2, 0);
    for (let f = 0; f < 30; f++) tl.confirm(f + 1, [], []); // todos no chão
    tl.setOwn(31, JUMP);
    expect(tl.predict(35).events).toContain("jump");
    expect(tl.predict(35).events).toEqual([]);
    expect(tl.predict(40).events).not.toContain("jump");
  });

  it("reinício confirmado num quadro volta todos ao início", () => {
    const tl = createTimeline(parseLevel(LEVELS[0]), 2, 0);
    tl.confirm(10, [[1, 0, RIGHT]], []);
    tl.confirm(11, [], [11]);
    expect(tl.world().resets).toBe(1);
  });

  it("a previsão não passa de MAX_AHEAD quadros à frente do confirmado", () => {
    const tl = createTimeline(parseLevel(LEVELS[0]), 2, 0);
    expect(tl.predict(10_000).frame).toBe(MAX_AHEAD);
  });

  it("carregar um snapshot substitui o confirmado", () => {
    const level = parseLevel(LEVELS[0]);
    const src = createWorld(level, 2);
    for (let f = 0; f < 50; f++) step(src, [decodeInput(RIGHT), decodeInput(0)]);
    const tl = createTimeline(level, 2, 1);
    tl.load(50, worldToJson(src), [RIGHT, 0]);
    expect(tl.frame()).toBe(50);
    expect(tl.hash()).toBe(hashWorld(src));
    expect(tl.bits()).toEqual([RIGHT, 0]);
  });

  it("confirmação repetida ou antiga é ignorada", () => {
    const tl = createTimeline(parseLevel(LEVELS[0]), 2, 0);
    tl.confirm(10, [], []);
    const h = tl.hash();
    tl.confirm(8, [[5, 0, RIGHT]], []);
    expect(tl.frame()).toBe(10);
    expect(tl.hash()).toBe(h);
  });
});
