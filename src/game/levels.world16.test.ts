import { describe, expect, it } from "vitest";
import { TILE } from "./engine/constants";
import { NO_INPUT, type Player, type World } from "./engine/world";
import { climbOn, drive, finish, goTo, jumpOnto, mid, relay, rideRail, solo, stackHoist, waitFor, worldAt } from "./testing/bot";

const FLOOR = 8;

/** Torre: `base` para em `col`, `top` sobe na cabeça dela e pula segurando até `done`. */
function towerJump(w: World, base: Player, top: Player, col: number, done: () => boolean) {
  goTo(w, [[base, mid(col)], [top, mid(col - 1)]]);
  expect(climbOn(w, top, base)).toBe(true);
  drive(w, (p) => (p === top ? { ...NO_INPUT, jump: true } : NO_INPUT), done, 90);
  return done();
}

/** Quem está na frente (maior x) e quem está atrás. */
const byFront = (w: World): [Player, Player] => {
  const [a, b] = w.players;
  return a.x > b.x ? [a, b] : [b, a];
};

/**
 * Ponte com contagem: `holder` segura o botão (`switchCol`) enquanto `runner` atravessa até o
 * botão do outro lado (`farCol`) e o segura; aí o holder atravessa.
 */
function timedBridge(w: World, holder: Player, runner: Player, switchCol: number, farCol: number) {
  goTo(w, [[holder, mid(switchCol)], [runner, mid(switchCol - 1)]]);
  goTo(w, [[runner, mid(farCol)]]);
  goTo(w, [[holder, mid(farCol - 1)]], 400, { unstick: false });
}

describe("Mundo 16 — Corrida do ouro (2 jogadores)", () => {
  it("16-1: botão no morro solta a chave, torre no vale, ponte com contagem", () => {
    const w = worldAt("16-1");
    const [a, b] = w.players;
    goTo(w, [[a, mid(16)], [b, mid(15)]]);
    expect(w.key.locked).toBe(false);
    expect(towerJump(w, a, b, 25, () => w.key.holder !== null)).toBe(true);
    goTo(w, [[a, mid(40)], [b, mid(39)]]);
    timedBridge(w, a, b, 40, 54);
    expect(w.resets).toBe(0);
    expect(w.players.every((p) => p.x > 53 * TILE && p.onGround)).toBe(true);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });

  it("16-2: revezamento na ponte, torre até o botão da jaula e caixote de todos como degrau", () => {
    const w = worldAt("16-2");
    const [front, back] = byFront(w);
    expect(relay(w, back, front, 10, 21)).toBe(true);
    expect(w.resets).toBe(0);
    const [f2, b2] = byFront(w);
    goTo(w, [[f2, mid(32)], [b2, mid(31)]]);
    climbOn(w, b2, f2);
    expect(jumpOnto(w, b2, FLOOR - 1)).toBe(true);
    goTo(w, [[b2, mid(34)]]);
    expect(w.key.locked).toBe(false);
    // os dois em fila atrás do caixote (pegando a chave no caminho) e empurram até o patamar
    goTo(w, [[f2, mid(41)], [b2, mid(40)]], 1500);
    expect(w.key.holder).not.toBeNull();
    drive(w, () => ({ ...NO_INPUT, right: true }), () => w.boxes[0].x === 47 * TILE, 900);
    expect(w.boxes[0].x).toBe(47 * TILE);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });

  it("16-3: amarrados — caixote no botão segura a ponte, paredão com corda, jaula e porta no alto", () => {
    const w = worldAt("16-3");
    const [front, back] = byFront(w);
    goTo(w, [[front, mid(7)], [back, mid(6)]]);
    drive(w, () => ({ ...NO_INPUT, right: true }), () => w.boxes[0].x >= 11 * TILE, 600);
    expect(w.switches[0].on).toBe(true);
    // passam por cima do caixote e pela ponte
    solo(w, [0, 1], () => w.players.every((p) => p.x > 21 * TILE && p.onGround), 1500);
    expect(w.resets).toBe(0);
    const [f2, b2] = byFront(w);
    expect(stackHoist(w, f2, b2, 26, FLOOR - 2)).toBe(true);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });

  it("16-4: revezamento, vagonete de todos, botão com atraso, escadaria e ponte com contagem", () => {
    const w = worldAt("16-4");
    const [front, back] = byFront(w);
    expect(relay(w, back, front, 8, 19)).toBe(true);
    expect(rideRail(w, 0, [24, 25])).toBe(true);
    expect(w.resets).toBe(0);
    solo(w, [0, 1], () => w.players.every((p) => p.x > 38 * TILE && p.onGround), 900);
    const [f2, b2] = byFront(w);
    goTo(w, [[f2, mid(43)], [b2, mid(42)]]);
    climbOn(w, b2, f2);
    expect(jumpOnto(w, b2, FLOOR - 1)).toBe(true);
    goTo(w, [[b2, mid(45)]]);
    // o atraso de 3 s conta com alguém em cima; depois a jaula abre de vez
    waitFor(w, () => !w.key.locked, 240);
    expect(w.key.locked).toBe(false);
    goTo(w, [[f2, mid(51)], [b2, mid(50)]], 1500);
    expect(w.key.holder).not.toBeNull();
    goTo(w, [[f2, mid(62)], [b2, mid(61)]]);
    const [f3, b3] = byFront(w);
    timedBridge(w, f3, b3, 62, 76);
    expect(w.resets).toBe(0);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });
});

describe("Mundo 16 — sozinho não dá", () => {
  /** Um jogador aperta o botão da ponte e corre direto: a contagem acaba antes de ele atravessar. */
  it.each([
    ["16-1", 40],
    ["16-2", 10],
    ["16-4", 8],
  ] as const)("%s: a ponte some antes de um jogador sozinho atravessar", (slug, switchCol) => {
    const w = worldAt(slug, 1);
    const [p] = w.players;
    goTo(w, [[p, mid(switchCol)]]);
    const resets = w.resets;
    drive(w, () => ({ ...NO_INPUT, right: true }), () => w.resets > resets, 600);
    expect(w.resets).toBeGreaterThan(resets);
  });
});
