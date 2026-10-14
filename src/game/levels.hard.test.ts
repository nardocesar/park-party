import { describe, expect, it } from "vitest";
import { TILE } from "./engine/constants";
import { climbOn, finish, goTo, jumpOnto, mid, solo, waitFor, worldAt } from "./testing/bot";

/** Fases difíceis: cada roteiro compõe trechos (empurrar, empilhar, elevador…) com 2 jogadores. */
describe("fases difíceis", () => {
  it("1-4: ponte que exige todos, caixas nos botões, torre pela chave, elevador de todos", () => {
    const w = createWorld2("1-4");
    const [a, b] = w.players;
    solo(w, [0, 1], () => w.gates[0].open === 1 && w.players.every((p) => p.x > 36 * TILE), 4000);
    expect(w.gates[0].open).toBe(1);
    // torre: a encosta no platô, b sobe nele e pula para o platô pela chave
    goTo(w, [[a, 39 * TILE - 8], [b, 37 * TILE]]);
    climbOn(w, b, a);
    jumpOnto(w, b, FLOOR - 1);
    goTo(w, [[b, mid(40)]]);
    expect(w.key.holder).toBe(1);
    // todos no elevador
    goTo(w, [[b, mid(45)], [a, mid(44)]]);
    waitFor(w, () => w.lifts[0].y === (FLOOR - 4) * TILE);
    expect(w.lifts[0].y).toBe((FLOOR - 4) * TILE);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });

  it("1-5: dois elevadores de todos e torre no patamar alto", () => {
    const w = createWorld2("1-5");
    const [a, b] = w.players;
    goTo(w, [[b, mid(12)], [a, mid(11)]]);
    waitFor(w, () => w.lifts[0].y === (FLOOR - 2) * TILE);
    goTo(w, [[b, mid(20)], [a, mid(19)]]);
    waitFor(w, () => w.lifts[1].y === (FLOOR - 4) * TILE);
    expect(w.lifts[1].y).toBe((FLOOR - 4) * TILE);
    goTo(w, [[a, 30 * TILE - 8], [b, mid(26)]]);
    climbOn(w, b, a);
    jumpOnto(w, b, 2);
    goTo(w, [[b, mid(31)]]);
    expect(w.key.holder).toBe(1);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });
});

const FLOOR = 8;
function createWorld2(slug: string) {
  return worldAt(slug, 2);
}
