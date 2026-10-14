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

  describe("Mundo 2 — corda", () => {
    const at = (slug: string) => LEVELS.find((l) => l.slug === slug)!;
    const idle = NO_INPUT;
    const go = (dir: 1 | -1, jump = false): PlayerInput => ({ ...NO_INPUT, left: dir < 0, right: dir > 0, jump });

    it("2-1 tem solução com 2 jogadores (buracos com corda)", () => {
      const w = createWorld(parseLevel(at("2-1")), 2);
      const walk = walker(w);
      for (let f = 0; f < 4000 && w.status === "playing"; f++) step(w, [walk(0, f), walk(1, f)]);
      expect(w.resets).toBe(0);
      expect(w.status).toBe("cleared");
    });

    it("2-2 tem solução: desce pendurado, pega a chave e é içado", () => {
      const w = createWorld(parseLevel(at("2-2")), 2);
      const [a, b] = w.players;
      // b (à frente) anda até cair no poço; a fica parado segurando
      for (let f = 0; f < 5; f++) step(w, [idle, idle]);
      // a acompanha b de perto, para a corda ter folga quando b cair no poço
      for (let f = 0; f < 600 && b.onGround; f++) step(w, [a.x + a.w < b.x - 18 ? go(1) : idle, go(1)]);
      for (let f = 0; f < 120; f++) step(w, [idle, idle]);
      expect(w.resets).toBe(0);
      expect(w.key.holder).toBe(1);
      // a anda para a esquerda, içando b
      for (let f = 0; f < 600 && !(b.onGround && b.y + b.h === 9 * TILE); f++) step(w, [go(-1), idle]);
      expect(b.y + b.h).toBe(9 * TILE);
      // os dois vão para a porta (à esquerda)
      for (let f = 0; f < 1500 && w.status === "playing"; f++) {
        const door = w.door.x + w.door.w / 2;
        step(w, w.players.map((p) => (p.cleared ? idle : go(p.x + p.w / 2 < door ? 1 : -1))));
      }
      expect(w.resets).toBe(0);
      expect(w.status).toBe("cleared");
    });

    it("2-3 tem solução: torre no degrau duplo e içar pelo paredão", () => {
      const w = createWorld(parseLevel(at("2-3")), 2);
      const [a, b] = w.players;
      const walk = walker(w);
      // b sobe no degrau e encosta no paredão
      for (let f = 0; f < 600 && !(b.onGround && b.x + b.w >= 22 * TILE - 0.5); f++) step(w, [idle, walk(1, f)]);
      // a sobe no degrau, depois na cabeça de b, depois no paredão
      for (let f = 0; f < 900 && !(a.onGround && a.y + a.h === 6 * TILE); f++) step(w, [walk(0, f), idle]);
      expect(a.y + a.h).toBe(6 * TILE);
      // a continua andando no alto e iça b pelo paredão
      for (let f = 0; f < 600 && !(b.onGround && b.y + b.h === 6 * TILE); f++) step(w, [go(1), idle]);
      expect(b.y + b.h).toBe(6 * TILE);
      for (let f = 0; f < 3000 && w.status === "playing"; f++) step(w, [walk(0, f), walk(1, f)]);
      expect(w.resets).toBe(0);
      expect(w.status).toBe("cleared");
    });

    it("2-4 tem solução: rapel no poço e depois o paredão", () => {
      const w = createWorld(parseLevel(at("2-4")), 2);
      const [a, b] = w.players;
      const walk = walker(w);
      for (let f = 0; f < 5; f++) step(w, [idle, idle]);
      // a acompanha b de perto, para a corda ter folga quando b cair no poço
      for (let f = 0; f < 600 && b.onGround; f++) step(w, [a.x + a.w < b.x - 18 ? go(1) : idle, go(1)]);
      for (let f = 0; f < 120; f++) step(w, [idle, idle]);
      expect(w.key.holder).toBe(1);
      for (let f = 0; f < 600 && !(b.onGround && b.y + b.h === 9 * TILE); f++) step(w, [go(-1), idle]);
      expect(b.y + b.h).toBe(9 * TILE);
      // agora a vai à frente: atravessa o poço estreito pulando e b segue
      for (let f = 0; f < 1500 && !(a.onGround && a.x + a.w >= 26 * TILE - 0.5); f++) step(w, [walk(0, f), walk(1, f)]);
      for (let f = 0; f < 900 && !(b.onGround && b.y + b.h === 6 * TILE); f++) step(w, [idle, walk(1, f)]);
      expect(b.y + b.h).toBe(6 * TILE);
      for (let f = 0; f < 600 && !(a.onGround && a.y + a.h === 6 * TILE); f++) step(w, [idle, go(1)]);
      expect(a.y + a.h).toBe(6 * TILE);
      for (let f = 0; f < 3000 && w.status === "playing"; f++) step(w, [walk(0, f), walk(1, f)]);
      expect(w.resets).toBe(0);
      expect(w.status).toBe("cleared");
    });
  });

  describe("Mundo 3 — tempo", () => {
    const at = (slug: string) => LEVELS.find((l) => l.slug === slug)!;
    type P = World["players"][number];

    /** Anda até a coluna `col` (borda esquerda do jogador no tile), pulando quando trava. */
    function mover() {
      const last = new Map<P, number>();
      return (p: P, col: number, f: number): PlayerInput => {
        const target = col * TILE + (TILE - p.w) / 2;
        const dx = target - p.x;
        if (Math.abs(dx) < 1) return NO_INPUT;
        const stuck = Math.abs(p.x - (last.get(p) ?? -1)) < 0.1;
        last.set(p, p.x);
        return { left: dx < 0, right: dx > 0, jump: stuck && f % 16 < 8 };
      };
    }
    const near = (p: P, col: number) => Math.abs(p.x - (col * TILE + (TILE - p.w) / 2)) < 1;

    /** Revezamento: `lead` segura o botão da esquerda, `runner` passa e segura o da direita, `lead` passa. */
    function relay(w: World, lead: P, runner: P, left: number, right: number) {
      const mv = mover();
      const input = (m: Map<P, PlayerInput>) => w.players.map((p) => m.get(p) ?? NO_INPUT);
      for (let f = 0; f < 900 && !near(lead, left); f++) step(w, input(new Map([[lead, mv(lead, left, f)]])));
      for (let f = 0; f < 900 && !near(runner, right); f++) step(w, input(new Map([[runner, mv(runner, right, f)]])));
      expect(near(runner, right)).toBe(true);
      for (let f = 0; f < 900 && !near(lead, right + 2); f++) step(w, input(new Map([[lead, mv(lead, right + 2, f)]])));
      expect(near(lead, right + 2)).toBe(true);
    }

    const finish = (w: World) => {
      const walk = walker(w);
      for (let f = 0; f < 4000 && w.status === "playing"; f++) step(w, [walk(0, f), walk(1, f)]);
      expect(w.resets).toBe(0);
      expect(w.status).toBe("cleared");
    };

    it("3-1 tem solução: revezamento nos botões temporizados", () => {
      const w = createWorld(parseLevel(at("3-1")), 2);
      const [a, b] = w.players;
      relay(w, b, a, 16, 24);
      finish(w);
    });

    it("3-2 tem solução: esperar as paredes e a ponte piscarem", () => {
      const w = createWorld(parseLevel(at("3-2")), 2);
      const bridge = w.blinks[3];
      const walk = walker(w);
      const edge = 30 * TILE - 2;
      // até a borda do poço (paredes que piscam: só andar contra elas até sumirem)
      const [a, b] = w.players;
      for (let f = 0; f < 3000 && !(b.x + b.w >= edge && a.x + a.w >= b.x - 1); f++) {
        step(w, w.players.map((p, i) => (p.x + p.w >= edge ? NO_INPUT : { ...walk(i, f), jump: false })));
      }
      // espera a ponte acabar de aparecer e atravessa junto
      for (let f = 0; f < 600 && !(bridge.visible && bridge.timer > 100); f++) step(w, [NO_INPUT, NO_INPUT]);
      for (let f = 0; f < 70; f++) step(w, [{ ...NO_INPUT, right: true }, { ...NO_INPUT, right: true }]);
      expect(w.resets).toBe(0);
      expect(w.players.every((p) => p.x > 33 * TILE)).toBe(true);
      finish(w);
    });

    it("3-3 tem solução: caixas nos dois botões abrem o portão", () => {
      const w = createWorld(parseLevel(at("3-3")), 2);
      finish(w);
      expect(w.switches.every((sw) => sw.on)).toBe(true);
    });

    it("3-4 tem solução: dois revezamentos e paredes que piscam", () => {
      const w = createWorld(parseLevel(at("3-4")), 2);
      const [a, b] = w.players;
      relay(w, b, a, 10, 18); // depois disso a está à frente
      relay(w, a, b, 32, 40);
      finish(w);
    });
  });
});
