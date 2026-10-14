import { describe, expect, it } from "vitest";
import { SOUNDS, soundLength, type Sfx } from "./audio";

describe("efeitos sonoros", () => {
  const all = Object.entries(SOUNDS) as [Sfx, (typeof SOUNDS)[Sfx]][];

  it("todo evento do jogo tem um som curto (menos de 1,5 s, fanfarra até 2 s)", () => {
    for (const [name, notes] of all) {
      expect(notes.length, name).toBeGreaterThan(0);
      expect(soundLength(notes), name).toBeLessThanOrEqual(name === "clear" ? 2 : 1.5);
    }
  });

  it("notas têm frequência audível e volume entre 0 e 1", () => {
    for (const [name, notes] of all) {
      for (const n of notes) {
        expect(n.f, name).toBeGreaterThanOrEqual(40);
        expect(n.f, name).toBeLessThanOrEqual(8000);
        expect(n.v ?? 1, name).toBeGreaterThan(0);
        expect(n.v ?? 1, name).toBeLessThanOrEqual(1);
      }
    }
  });
});
