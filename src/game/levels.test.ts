import { describe, expect, it } from "vitest";
import { TILE } from "./engine/constants";
import { isSolidAt, parseLevel } from "./engine/level";
import { createWorld, NO_INPUT, step, type PlayerInput, type World } from "./engine/world";
import { LEVELS } from "./levels";

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
    const thornJumps = new Set<number>();
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
      const gap =
        p.onGround &&
        !isSolidAt(world.level, ahead, below) &&
        !isSolidAt(world.level, ahead, below + 1) &&
        !world.falls.some((fb) => fb.x <= (ahead + 0.5) * TILE && (ahead + 0.5) * TILE < fb.x + fb.w);
      // vala com espinho no fundo conta como buraco
      const spikePit =
        p.onGround &&
        world.thorns.some((t) => t.speed === 0 && Math.floor(t.x / TILE) === ahead && Math.floor(t.y / TILE) === below);
      // esmagador logo à frente descendo ou baixo: espera
      const crusher = world.thorns.find(
        (t) => t.dy > 0 && t.x < p.x + p.w + 6 && t.x + t.w > p.x - 2 && !(t.way === -1 && t.t < 0.6),
      );
      if (crusher && p.onGround && crusher.x >= p.x + p.w - 1) return NO_INPUT;
      // espinho logo à frente no nível dos pés: pula; espinho acima do caminho: nunca pula
      const thornAhead = world.thorns.some(
        (t) => t.x > p.x + p.w - 2 && t.x < p.x + p.w + 6 && t.y < p.y + p.h && t.y + t.h > p.y + p.h - 4,
      );
      const thornAbove = world.thorns.some(
        (t) => t.x < p.x + p.w + 24 && t.x + t.w > p.x && t.y + t.h <= p.y && t.y + t.h > p.y - 40,
      );
      // pulo sobre espinho: segura até o ápice (pulo cheio)
      if (thornAhead && p.onGround) thornJumps.add(i);
      if (p.onGround && !thornAhead) thornJumps.delete(i);
      const rising = thornJumps.has(i) && !p.onGround && p.vy < 0;
      // perto de esmagador, nada de pulo para destravar (a ponta pega a cabeça)
      const nearCrusher = world.thorns.some((t) => t.dy > 0 && t.x < p.x + p.w + 2 * TILE && t.x + t.w > p.x - TILE);
      const unstick = stuck && f % 16 < 8 && !nearCrusher;
      const jump = !thornAbove && (unstick || gap || spikePit || thornAhead || rising);
      return { ...NO_INPUT, right: true, jump };
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


  });

  describe("Mundo 4 — chão que cai e espinhos", () => {
    const at = (slug: string) => LEVELS.find((l) => l.slug === slug)!;
    const finish = (w: World) => {
      const walk = walker(w);
      for (let f = 0; f < 4000 && w.status === "playing"; f++) step(w, [walk(0, f), walk(1, f)]);
      expect(w.resets).toBe(0);
      expect(w.status).toBe("cleared");
    };

    it("4-1 tem solução: atravessar a ponte que cai juntos", () => {
      const w = createWorld(parseLevel(at("4-1")), 2);
      // a encosta em b antes da ponte, para atravessarem colados
      const [a, b] = w.players;
      for (let f = 0; f < 300 && b.x + b.w < 10 * TILE - 2; f++) step(w, [a.x + a.w < b.x - 0.5 ? { ...NO_INPUT, right: true } : NO_INPUT, { ...NO_INPUT, right: true }]);
      for (let f = 0; f < 60 && a.x + a.w < b.x - 0.5; f++) step(w, [{ ...NO_INPUT, right: true }, NO_INPUT]);
      finish(w);
    });

    it("4-2 tem solução: pular espinhos do chão, não pular sob os do teto, empilhar pela chave", () => {
      const w = createWorld(parseLevel(at("4-2")), 2);
      solve(w, (a) => a.x + a.w >= 31 * TILE - 1);
    });


  });

  describe("Mundo 5 — trilhos e paredes", () => {
    const at = (slug: string) => LEVELS.find((l) => l.slug === slug)!;
    type P = World["players"][number];
    const finish = (w: World) => {
      const walk = walker(w);
      for (let f = 0; f < 4000 && w.status === "playing"; f++) step(w, [walk(0, f), walk(1, f)]);
      expect(w.resets).toBe(0);
      expect(w.status).toBe("cleared");
    };
    /** Leva cada jogador até o x alvo (sem pular) e para. */
    const goTo = (w: World, targets: number[], max = 900) => {
      for (let f = 0; f < max && w.players.some((p, i) => Math.abs(p.x - targets[i]) > 1); f++) {
        step(w, w.players.map((p: P, i) => {
          const dx = targets[i] - p.x;
          return Math.abs(dx) <= 1 ? NO_INPUT : { ...NO_INPUT, left: dx < 0, right: dx > 0 };
        }));
      }
    };
    const rideToEnd = (w: World, max = 2000) => {
      const r = w.rails[0];
      for (let f = 0; f < max && !(r.weight === 0 && r.s === 0 && f > 10) && r.s < railEnd(w); f++) step(w, [NO_INPUT, NO_INPUT]);
    };
    const railEnd = (w: World) => {
      const path = w.level.rails[0].path;
      let t = 0;
      for (let i = 1; i < path.length; i++) t += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
      return t;
    };

    it("5-1 tem solução: todos no trilho para cruzar o poço", () => {
      const w = createWorld(parseLevel(at("5-1")), 2);
      goTo(w, [8 * TILE + 2, 9 * TILE + 14]);
      rideToEnd(w);
      expect(w.rails[0].s).toBe(railEnd(w));
      finish(w);
    });

    it("5-2 tem solução: subir na plataforma automática junto", () => {
      const w = createWorld(parseLevel(at("5-2")), 2);
      const r = w.rails[0];
      goTo(w, [10 * TILE, 11 * TILE]);
      // espera a plataforma chegar embaixo e parar, e entram
      for (let f = 0; f < 900 && !(r.s === 0 && r.wait > 60); f++) step(w, [NO_INPUT, NO_INPUT]);
      goTo(w, [13 * TILE + 2, 14 * TILE + 14], 80);
      for (let f = 0; f < 900 && !(r.s === railEnd(w) && r.wait > 60); f++) step(w, [NO_INPUT, NO_INPUT]);
      expect(w.resets).toBe(0);
      goTo(w, [18 * TILE, 20 * TILE], 80);
      expect(w.players.every((p) => p.y + p.h === (8 - 3) * TILE)).toBe(true);
      finish(w);
    });


  });

  describe("Mundos 6 e 7 — vento e molas", () => {
    const at = (slug: string) => LEVELS.find((l) => l.slug === slug)!;
    type P = World["players"][number];
    const finish = (w: World) => {
      const walk = walker(w);
      for (let f = 0; f < 4000 && w.status === "playing"; f++) step(w, [walk(0, f), walk(1, f)]);
      expect(w.resets).toBe(0);
      expect(w.status).toBe("cleared");
    };
    /** Comanda cada jogador por um tempo: direção (-1, 0, 1) e pulo, até `done` ou `max` frames. */
    const drive = (w: World, inputs: (p: P, i: number) => PlayerInput, done: () => boolean, max = 900) => {
      for (let f = 0; f < max && !done(); f++) step(w, w.players.map((p, i) => inputs(p, i)));
    };
    const lastX = new Map<P, number>();
    /** Vai até x; se travar (degrau, trampolim), pula. */
    const toward = (p: P, x: number): PlayerInput => {
      if (Math.abs(p.x - x) <= 1) return NO_INPUT;
      const stuck = p.onGround && Math.abs(p.x - (lastX.get(p) ?? NaN)) < 0.1;
      lastX.set(p, p.x);
      return { ...NO_INPUT, left: p.x > x, right: p.x < x, jump: stuck || (!p.onGround && p.vy < 0) };
    };
    const onTop = (p: P, row: number) => p.onGround && Math.abs(p.y + p.h - row * TILE) < 0.01;

    it("6-1 tem solução: corrente de ar até o paredão", () => {
      const w = createWorld(parseLevel(at("6-1")), 2);
      for (const i of [1, 0]) {
        const p = w.players[i];
        drive(w, (q) => (q === p ? toward(q, 12 * TILE) : NO_INPUT), () => p.y < 3 * TILE, 900);
        drive(w, (q) => (q === p ? toward(q, 16 * TILE + i * TILE) : NO_INPUT), () => onTop(p, 4), 300);
        expect(onTop(p, 4)).toBe(true);
      }
      finish(w);
    });

    it("6-2 tem solução: andar contra o vento sem parar", () => {
      finish(createWorld(parseLevel(at("6-2")), 2));
    });



    it("7-1 tem solução: trampolim até o platô", () => {
      const w = createWorld(parseLevel(at("7-1")), 2);
      for (const i of [1, 0]) {
        const p = w.players[i];
        drive(w, (q) => (q === p ? toward(q, 11 * TILE + 1) : NO_INPUT), () => p.vy < -1, 900);
        drive(w, (q) => (q === p ? { ...NO_INPUT, right: true, jump: q.vy < 0 } : NO_INPUT), () => onTop(p, 5), 200);
        expect(onTop(p, 5)).toBe(true);
      }
      finish(w);
    });

    it("7-2 tem solução: revezamento no trampolim com botão", () => {
      const w = createWorld(parseLevel(at("7-2")), 2);
      const [a, b] = w.players;
      drive(w, (q) => (q === a ? toward(q, 7 * TILE + 1) : toward(q, 11 * TILE + 1)), () => b.vy < -1 && Math.abs(a.x - (7 * TILE + 1)) <= 1, 900);
      drive(w, (q) => (q === b ? { ...NO_INPUT, right: true, jump: q.vy < 0 } : NO_INPUT), () => onTop(b, 5), 200);
      drive(w, (q) => (q === b ? toward(q, 16 * TILE + 1) : NO_INPUT), () => Math.abs(b.x - (16 * TILE + 1)) <= 1, 300);
      expect(w.switches[1].on).toBe(true);
      drive(w, (q) => (q === a ? toward(q, 11 * TILE + 1) : NO_INPUT), () => a.vy < -1, 300);
      drive(w, (q) => (q === a ? { ...NO_INPUT, right: true, jump: q.vy < 0 } : NO_INPUT), () => onTop(a, 5), 200);
      expect(onTop(a, 5)).toBe(true);
      finish(w);
    });


  });

  describe("Mundos 8 e 9 — gravidade e portais", () => {
    const at = (slug: string) => LEVELS.find((l) => l.slug === slug)!;
    type P = World["players"][number];
    const finish = (w: World) => {
      const walk = walker(w);
      for (let f = 0; f < 4000 && w.status === "playing"; f++) step(w, [walk(0, f), walk(1, f)]);
      expect(w.resets).toBe(0);
      expect(w.status).toBe("cleared");
    };
    const drive = (w: World, inputs: (p: P, i: number) => PlayerInput, done: () => boolean, max = 900) => {
      for (let f = 0; f < max && !done(); f++) step(w, w.players.map((p, i) => inputs(p, i)));
    };
    const toward = (p: P, x: number, jumpOver = false): PlayerInput =>
      Math.abs(p.x - x) <= 1 ? NO_INPUT : { ...NO_INPUT, left: p.x > x, right: p.x < x, jump: jumpOver };
    const at_ = (p: P, x: number) => Math.abs(p.x - x) <= 1;
    /** Leva os dois a xs[i]; depois quem `flip` aperta baixo e espera assentar. */
    const goFlip = (w: World, xs: number[], flip: boolean[]) => {
      drive(w, (q, i) => toward(q, xs[i]), () => w.players.every((q, i) => at_(q, xs[i]) && q.onGround));
      expect(w.players.every((q, i) => at_(q, xs[i]))).toBe(true);
      step(w, w.players.map((_, i) => ({ ...NO_INPUT, down: flip[i] })));
      drive(w, () => NO_INPUT, () => w.players.every((q) => q.onGround), 120);
    };

    it("8-1 tem solução: pelo teto sobre os espinhos", () => {
      const w = createWorld(parseLevel(at("8-1")), 2);
      goFlip(w, [7 * TILE, 8 * TILE], [true, true]);
      expect(w.players.every((p) => p.gravDir === -1)).toBe(true);
      goFlip(w, [21 * TILE, 22 * TILE], [true, true]);
      expect(w.key.holder).not.toBeNull();
      finish(w);
    });

    it("8-2 tem solução: um no teto e outro no chão nos botões", () => {
      const w = createWorld(parseLevel(at("8-2")), 2);
      goFlip(w, [6 * TILE, 8 * TILE], [true, false]);
      drive(w, (q, i) => toward(q, [12 * TILE + 1, 14 * TILE + 1][i]), () => w.gates[0].open === 1, 600);
      expect(w.gates[0].open).toBe(1);
      goFlip(w, [22 * TILE, 23 * TILE], [true, false]);
      expect(w.players.every((p) => p.gravDir === 1)).toBe(true);
      finish(w);
    });



    it("9-1 tem solução: pelo portal", () => {
      finish(createWorld(parseLevel(at("9-1")), 2));
    });

    it("9-2 tem solução: quem pega a chave leva todos", () => {
      const w = createWorld(parseLevel(at("9-2")), 2);
      const b = w.players[1];
      drive(w, (q) => (q === b ? toward(q, 20 * TILE) : NO_INPUT), () => w.players.every((p) => p.x > 31 * TILE), 900);
      expect(w.key.holder).toBe(1);
      finish(w);
    });


  });

  describe("Mundo 10 — cores", () => {
    const at = (slug: string) => LEVELS.find((l) => l.slug === slug)!;
    type P = World["players"][number];
    const finish = (w: World) => {
      const walk = walker(w);
      for (let f = 0; f < 5000 && w.status === "playing"; f++) step(w, [walk(0, f), walk(1, f)]);
      expect(w.resets).toBe(0);
      expect(w.status).toBe("cleared");
    };
    const drive = (w: World, inputs: (p: P, i: number) => PlayerInput, done: () => boolean, max = 900) => {
      for (let f = 0; f < max && !done(); f++) step(w, w.players.map((p, i) => inputs(p, i)));
    };
    /** Só o jogador `i` anda com o bot genérico até `done`. */
    const solo = (w: World, i: number, done: () => boolean, max = 1500) => {
      const walk = walker(w);
      for (let f = 0; f < max && !done(); f++) step(w, w.players.map((_, j) => (j === i ? walk(j, f) : NO_INPUT)));
    };

    it("10-1 tem solução: cada um empurra a própria caixa para o buraco", () => {
      const w = createWorld(parseLevel(at("10-1")), 2);
      solo(w, 0, () => w.boxes[0].y === 9 * TILE);
      expect(w.boxes[0].y).toBe(9 * TILE);
      solo(w, 1, () => w.boxes[1].y === 9 * TILE, 2500);
      expect(w.boxes[1].y).toBe(9 * TILE);
      finish(w);
    });

    it("10-2 tem solução: a caixa azul pula levando o laranja", () => {
      const w = createWorld(parseLevel(at("10-2")), 2);
      const [a, b] = w.players;
      const box = w.boxes[0];
      const lastX = new Map<P, number>();
      const toward = (p: P, x: number, jump = false): PlayerInput => {
        const stuck = p.onGround && Math.abs(p.x - (lastX.get(p) ?? NaN)) < 0.1;
        lastX.set(p, p.x);
        if (Math.abs(p.x - x) <= 1) return { ...NO_INPUT, jump };
        return { ...NO_INPUT, left: p.x > x, right: p.x < x, jump: jump || stuck };
      };
      // b se posiciona ao lado da caixa; a sobe na caixa
      // a (laranja) sobe na caixa azul — ele não a empurra; b (o dono) para ao lado sem encostar
      drive(w, (q) => (q === a ? toward(q, 15 * TILE + 1) : NO_INPUT), () => a.onGround && Math.abs(a.y + a.h - box.y) < 0.01 && Math.abs(a.x - (15 * TILE + 1)) <= 1, 900);
      drive(w, (q) => (q === b ? toward(q, 13 * TILE) : NO_INPUT), () => Math.abs(b.x - 13 * TILE) <= 1 && b.onGround, 900);
      expect(a.y + a.h).toBe(box.y);
      // b pula (soltando antes, para ser uma nova apertada); no ápice da caixa, a pula para a direita
      step(w, [NO_INPUT, NO_INPUT]);
      step(w, [NO_INPUT, NO_INPUT]);
      step(w, [NO_INPUT, { ...NO_INPUT, jump: true }]);
      drive(w, () => NO_INPUT, () => box.vy >= -0.5, 30);
      drive(w, (q) => (q === a ? { ...NO_INPUT, right: true, jump: true } : NO_INPUT), () => a.onGround && a.y + a.h === 6 * TILE, 120);
      expect(a.y + a.h).toBe(6 * TILE);
      // a liga o botão da mola; b sobe pela mola
      drive(w, (q) => (q === a ? toward(q, 20 * TILE + 1) : NO_INPUT), () => w.switches[0].on, 300);
      drive(w, (q) => (q === b ? toward(q, 14 * TILE + 1) : NO_INPUT), () => b.vy < -1, 600);
      drive(w, (q) => (q === b ? { ...NO_INPUT, right: true, jump: q.vy < 0 } : NO_INPUT), () => b.onGround && b.y + b.h === 6 * TILE, 200);
      expect(b.y + b.h).toBe(6 * TILE);
      finish(w);
    });

  });

  describe("Mundos 11 e 12 — apagão e tamanho", () => {
    const at = (slug: string) => LEVELS.find((l) => l.slug === slug)!;
    type P = World["players"][number];
    const finish = (w: World) => {
      const walk = walker(w);
      for (let f = 0; f < 5000 && w.status === "playing"; f++) step(w, [walk(0, f), walk(1, f)]);
      expect(w.resets).toBe(0);
      expect(w.status).toBe("cleared");
    };
    const drive = (w: World, inputs: (p: P, i: number) => PlayerInput, done: () => boolean, max = 900) => {
      for (let f = 0; f < max && !done(); f++) step(w, w.players.map((p, i) => inputs(p, i)));
    };
    /** Só `p` se move: até o centro dele ficar em `cx` (px), sem pular. */
    const walkTo = (w: World, p: P, cx: number, max = 900) =>
      drive(w, (q) => (q !== p || Math.abs(q.x + q.w / 2 - cx) <= 1 ? NO_INPUT : { ...NO_INPUT, left: q.x + q.w / 2 > cx, right: q.x + q.w / 2 < cx }), () => Math.abs(p.x + p.w / 2 - cx) <= 1 && p.onGround, max);
    const waitFor = (w: World, done: () => boolean, max = 600) => drive(w, () => NO_INPUT, done, max);
    /** `p` pula (segurando) andando para a direita até pousar com os pés em `row`. */
    const jumpOnto = (w: World, p: P, row: number) =>
      drive(w, (q) => (q === p ? { ...NO_INPUT, right: true, jump: q.onGround || q.vy < 0 } : NO_INPUT), () => p.onGround && Math.abs(p.y + p.h - row * TILE) < 0.01, 300);
    const mid = (col: number) => col * TILE + TILE / 2;

    it("11-1 tem solução no apagão", () => finish(createWorld(parseLevel(at("11-1")), 2)));

    it("11-2 tem solução: ponte que cai no escuro", () => {
      const w = createWorld(parseLevel(at("11-2")), 2);
      const [a, b] = w.players;
      for (let f = 0; f < 300 && b.x + b.w < 10 * TILE - 2; f++) step(w, [a.x + a.w < b.x - 0.5 ? { ...NO_INPUT, right: true } : NO_INPUT, { ...NO_INPUT, right: true }]);
      for (let f = 0; f < 60 && a.x + a.w < b.x - 0.5; f++) step(w, [{ ...NO_INPUT, right: true }, NO_INPUT]);
      finish(w);
    });


    const growAndClimb = (w: World, p: P, switchCol: number, row: number, target = 2.3) => {
      walkTo(w, p, mid(switchCol));
      waitFor(w, () => p.scale >= target);
      jumpOnto(w, p, row);
      expect(p.y + p.h).toBeCloseTo(row * TILE, 5);
    };

    it("12-1 tem solução: crescer para subir", () => {
      const w = createWorld(parseLevel(at("12-1")), 2);
      for (const [i, p] of [w.players[1], w.players[0]].entries()) {
        growAndClimb(w, p, 9, 6);
        walkTo(w, p, mid(20 - i * 3));
      }
      finish(w);
    });

    it("12-2 tem solução: crescer, encolher e passar no túnel (os dois por etapa)", () => {
      const w = createWorld(parseLevel(at("12-2")), 2);
      const order = [w.players[1], w.players[0]];
      for (const [i, p] of order.entries()) {
        growAndClimb(w, p, 9, 6);
        walkTo(w, p, mid(17 - i * 2));
      }
      for (const [i, p] of order.entries()) {
        walkTo(w, p, mid(19));
        waitFor(w, () => p.scale <= 1.05);
        walkTo(w, p, mid(34 - i * 2));
        expect(p.x).toBeGreaterThan(31 * TILE);
      }
      finish(w);
    });
  });
});
