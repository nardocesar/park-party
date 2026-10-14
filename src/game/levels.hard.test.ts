import { describe, expect, it } from "vitest";
import { TILE } from "./engine/constants";
import { climbOn, finish, goTo, jumpOnto, mid, rapel, solo, stackHoist, waitFor, worldAt } from "./testing/bot";
import { NO_INPUT, step } from "./engine/world";

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

  it("2-3: paredão, rapel pela chave, vala e paredão de novo", () => {
    const w = createWorld2("2-3");
    const [a, b] = w.players;
    expect(stackHoist(w, b, a, 12, FLOOR - 2)).toBe(true);
    // a terminou na frente: desce no poço; b segura e iça
    goTo(w, [[a, mid(24)], [b, mid(23)]], 900, { unstick: false });
    expect(rapel(w, a, b, 26, FLOOR + 1)).toBe(true);
    expect(w.key.holder).toBe(0);
    expect(w.resets).toBe(0);
    // atravessam juntos o poço e a vala; quem estiver na frente vira a base do segundo paredão
    solo(w, [0, 1], () => w.players.every((p) => p.x > 31 * TILE && p.onGround), 1500);
    const [front, back] = a.x > b.x ? [a, b] : [b, a];
    expect(stackHoist(w, front, back, 36, FLOOR - 2)).toBe(true);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });

  it("2-4: ponte que cai amarrados, rapel e paredão", () => {
    const w = createWorld2("2-4");
    const [a, b] = w.players;
    // colados atravessam a ponte que cai
    for (let f = 0; f < 300 && b.x + b.w < 8 * TILE - 2; f++)
      step(w, [a.x + a.w < b.x - 0.5 ? { ...NO_INPUT, right: true } : NO_INPUT, { ...NO_INPUT, right: true }]);
    for (let f = 0; f < 60 && a.x + a.w < b.x - 0.5; f++) step(w, [{ ...NO_INPUT, right: true }, NO_INPUT]);
    solo(w, [0, 1], () => w.players.every((p) => p.x > 16 * TILE && p.onGround), 900);
    expect(w.resets).toBe(0);
    goTo(w, [[b, mid(23)], [a, mid(22)]], 900, { unstick: false });
    expect(rapel(w, b, a, 25, FLOOR + 1)).toBe(true);
    expect(w.key.holder).toBe(1);
    solo(w, [0, 1], () => w.players.every((p) => p.x > 27 * TILE && p.onGround), 1500);
    const [front, back] = a.x > b.x ? [a, b] : [b, a];
    expect(stackHoist(w, front, back, 34, FLOOR - 2)).toBe(true);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });
});

const FLOOR = 8;
function createWorld2(slug: string) {
  return worldAt(slug, 2);
}
