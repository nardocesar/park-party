import { describe, expect, it } from "vitest";
import { TILE } from "./engine/constants";
import { isSolidAt, parseLevel } from "./engine/level";
import { createWorld, NO_INPUT, step, type PlayerInput, type World } from "./engine/world";
import { LEVELS } from "./levels";

/** Quem está imediatamente embaixo do jogador (para roteiros de teste). */
function support(w: World, p: World["players"][number]) {
  return w.players.find((o) => o !== p && Math.abs(o.y - (p.y + p.h)) < 0.01 && o.x < p.x + p.w && p.x < o.x + o.w);
}

describe("fases", () => {
  it.each(LEVELS.map((l) => [l.name, l] as const))("%s é bem formada", (_, def) => {
    const level = parseLevel(def);
    expect(new Set(def.map.map((r) => r.length)).size).toBe(1);
    expect(level.spawns).toHaveLength(4);
    expect(level.key.x).toBeGreaterThan(0);
    expect(level.door.x).toBeGreaterThan(0);
    const w = createWorld(level, 4);
    step(w, [NO_INPUT, NO_INPUT, NO_INPUT, NO_INPUT]);
    expect(w.players.every((p) => p.onGround)).toBe(true);
  });

  /**
   * Bot de 2 jogadores: A anda até `stop(A)` e serve de base; B sobe em A e pega a chave;
   * depois os dois andam até a porta. Ambos pulam quando travam ou quando há buraco à frente.
   */
  /** Anda para a direita pulando quando trava ou quando há buraco fundo à frente. */
  function walker(world: World) {
    const lastX = world.players.map((p) => p.x);
    return (i: number, f: number): PlayerInput => {
      const p = world.players[i];
      const stuck = Math.abs(p.x - lastX[i]) < 0.1;
      lastX[i] = p.x;
      // com a porta aberta, vai até ela (pode ter passado antes de abrir)
      const { door } = world;
      if (door.open && p.y + p.h <= door.y + door.h + 0.01 && p.y + p.h > door.y) {
        const dx = door.x + door.w / 2 - (p.x + p.w / 2);
        return { ...NO_INPUT, left: dx < 0, right: dx > 0 };
      }
      const ahead = Math.floor((p.x + p.w + 2) / TILE);
      const below = Math.floor((p.y + p.h + 1) / TILE);
      const gap = p.onGround && !isSolidAt(world.level, ahead, below) && !isSolidAt(world.level, ahead, below + 1);
      return { ...NO_INPUT, right: true, jump: (stuck && f % 16 < 8) || gap };
    };
  }

  function solve(world: World, stop: (a: World["players"][number]) => boolean) {
    const [a, b] = world.players;
    const walk = walker(world);

    for (let f = 0; f < 1500 && !stop(a); f++) step(world, [walk(0, f), b.x + b.w < a.x - 24 ? walk(1, f) : NO_INPUT]);
    expect(stop(a)).toBe(true);
    for (let f = 0; f < 600 && world.key.holder === null; f++) step(world, [NO_INPUT, walk(1, f)]);
    expect(world.key.holder).toBe(1);
    for (let f = 0; f < 3000 && world.status === "playing"; f++) step(world, [walk(0, f), walk(1, f)]);
    expect(world.resets).toBe(0);
    expect(world.status).toBe("cleared");
  }

  it("1-1 tem solução com 2 jogadores (empilhar no chão)", () => {
    solve(createWorld(parseLevel(LEVELS[0]), 2), (a) => a.x + a.w >= 20 * TILE - 1);
  });

  it("1-2 tem solução com 2 jogadores (empilhar no degrau)", () => {
    solve(createWorld(parseLevel(LEVELS[1]), 2), (a) => a.onGround && a.y + a.h === 8 * TILE && a.x + a.w >= 23 * TILE - 1);
  });

  it("1-3 tem solução com 2 jogadores (buracos e escada)", () => {
    solve(createWorld(parseLevel(LEVELS[2]), 2), (a) => a.x + a.w >= 18 * TILE - 1);
  });

  it("1-4 tem solução com 2 jogadores (caixa de ponte e botão)", () => {
    const w = createWorld(parseLevel(LEVELS[3]), 2);
    const walk = walker(w);
    for (let f = 0; f < 4000 && w.status === "playing"; f++) step(w, [walk(0, f), walk(1, f)]);
    expect(w.resets).toBe(0);
    expect(w.status).toBe("cleared");
  });

  it("1-5 tem solução com 2 jogadores (elevador exige os dois)", () => {
    const w = createWorld(parseLevel(LEVELS[4]), 2);
    const [a, b] = w.players; // b nasce à frente de a
    const lift = w.lifts[0];
    const right: PlayerInput = { ...NO_INPUT, right: true };
    // b vai até o muro, em cima do elevador; sozinho, o elevador não sobe
    for (let f = 0; f < 600 && b.x + b.w < 14 * TILE - 0.5; f++) step(w, [NO_INPUT, right]);
    for (let f = 0; f < 60; f++) step(w, [NO_INPUT, NO_INPUT]);
    expect(lift.y).toBe(9 * TILE);
    // a entra no elevador ao lado de b: agora o peso é 2
    for (let f = 0; f < 300 && lift.weight < 2; f++) step(w, [right, NO_INPUT]);
    expect(support(w, a)).toBeUndefined();
    for (let f = 0; f < 300 && lift.y > 6 * TILE; f++) step(w, [NO_INPUT, NO_INPUT]);
    expect(lift.y).toBe(6 * TILE);
    const walk = walker(w);
    for (let f = 0; f < 3000 && w.status === "playing"; f++) step(w, [walk(0, f), walk(1, f)]);
    expect(w.resets).toBe(0);
    expect(w.status).toBe("cleared");
  });
});
