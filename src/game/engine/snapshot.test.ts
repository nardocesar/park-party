import { describe, expect, it } from "vitest";
import { LEVELS } from "@/game/levels";
import { decodeInput } from "@/net/bits";
import { fuzzInputs } from "@/net/testing/fuzz";
import { parseLevel } from "./level";
import { cloneWorld, hashWorld, worldFromJson, worldToJson } from "./snapshot";
import { createWorld, step, type World } from "./world";

const run = (w: World, inputs: number[][]) => {
  for (const f of inputs) step(w, f.map(decodeInput));
};

describe("snapshot do mundo", () => {
  it("clone é independente do original e compartilha a fase", () => {
    const w = createWorld(parseLevel(LEVELS[0]), 2);
    const c = cloneWorld(w);
    run(c, fuzzInputs(1, 2, 60));
    expect(c.level).toBe(w.level);
    expect(hashWorld(c)).not.toBe(hashWorld(w));
    expect(w.frame).toBe(0);
  });

  it("serializar no meio da fase e continuar dá o mesmo hash, em todas as fases", () => {
    for (const [i, def] of LEVELS.entries()) {
      const level = parseLevel(def);
      const players = [2, 4, 8][i % 3];
      const inputs = fuzzInputs(i + 1, players, 400);
      const a = createWorld(level, players);
      run(a, inputs.slice(0, 200));
      const b = worldFromJson(worldToJson(a), level);
      expect(hashWorld(b), def.slug).toBe(hashWorld(a));
      run(a, inputs.slice(200));
      run(b, inputs.slice(200));
      expect(hashWorld(b), def.slug).toBe(hashWorld(a));
    }
  });

  it("hash ignora os eventos do último quadro", () => {
    const w = createWorld(parseLevel(LEVELS[0]), 2);
    const h = hashWorld(w);
    w.events = ["jump"];
    expect(hashWorld(w)).toBe(h);
  });
});
