/**
 * Ajudas de roteiro para os testes de solução das fases (só usadas em testes).
 * Cada fase difícil é resolvida por uma sequência de trechos: andar, revezar, empilhar, etc.
 */
import { TILE } from "../engine/constants";
import { isSolidAt, parseLevel } from "../engine/level";
import { createWorld, NO_INPUT, step, type Player, type PlayerInput, type World } from "../engine/world";
import { LEVELS } from "../levels";

export const levelAt = (slug: string) => {
  const def = LEVELS.find((l) => l.slug === slug);
  if (!def) throw new Error(`fase ${slug} não existe`);
  return def;
};

export const worldAt = (slug: string, players = 2) => createWorld(parseLevel(levelAt(slug)), players);

/** Centro horizontal do tile `col`, em px. */
export const mid = (col: number) => col * TILE + TILE / 2;

/** Anda para a direita pulando quando trava, quando há buraco ou espinho à frente; vai até a porta aberta. */
export function walker(world: World) {
  const lastX = world.players.map((p) => p.x);
  const thornJumps = new Set<number>();
  return (i: number, f: number): PlayerInput => {
    const p = world.players[i];
    const stuck = Math.abs(p.x - lastX[i]) < 0.1;
    lastX[i] = p.x;
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
    const spikePit =
      p.onGround &&
      world.thorns.some((t) => t.speed === 0 && Math.floor(t.x / TILE) === ahead && Math.floor(t.y / TILE) === below);
    const crusher = world.thorns.find(
      (t) => t.dy > 0 && t.x < p.x + p.w + 6 && t.x + t.w > p.x - 2 && !(t.way === -1 && t.t < 0.6),
    );
    if (crusher && p.onGround && crusher.x >= p.x + p.w - 1) return NO_INPUT;
    const thornAhead = world.thorns.some(
      (t) => t.x > p.x + p.w - 2 && t.x < p.x + p.w + 6 && t.y < p.y + p.h && t.y + t.h > p.y + p.h - 4,
    );
    const thornAbove = world.thorns.some(
      (t) => t.x < p.x + p.w + 24 && t.x + t.w > p.x && t.y + t.h <= p.y && t.y + t.h > p.y - 40,
    );
    if (thornAhead && p.onGround) thornJumps.add(i);
    if (p.onGround && !thornAhead) thornJumps.delete(i);
    const rising = thornJumps.has(i) && !p.onGround && p.vy < 0;
    const nearCrusher = world.thorns.some((t) => t.dy > 0 && t.x < p.x + p.w + 2 * TILE && t.x + t.w > p.x - TILE);
    const unstick = stuck && f % 16 < 8 && !nearCrusher;
    const jump = !thornAbove && (unstick || gap || spikePit || thornAhead || rising);
    return { ...NO_INPUT, right: true, jump };
  };
}

/** Roda até `done` (checado antes de cada frame) ou `max` frames; cada jogador recebe `inputs(p, i)`. */
export function drive(w: World, inputs: (p: Player, i: number) => PlayerInput, done: () => boolean, max = 900) {
  for (let f = 0; f < max && !done(); f++) step(w, w.players.map((p, i) => inputs(p, i)));
  return done();
}

export const waitFor = (w: World, done: () => boolean, max = 600) => drive(w, () => NO_INPUT, done, max);

/** Entrada para levar `p` até o centro `cx`; pula se travar (degrau, trampolim desligado). */
export function steer(w: World) {
  const last = new Map<Player, number>();
  return (p: Player, cx: number, opts: { jump?: boolean; unstick?: boolean } = {}): PlayerInput => {
    const c = p.x + p.w / 2;
    const stuck = p.onGround && Math.abs(p.x - (last.get(p) ?? NaN)) < 0.1;
    last.set(p, p.x);
    if (Math.abs(c - cx) <= 1) return { ...NO_INPUT, jump: opts.jump ?? false };
    return { ...NO_INPUT, left: c > cx, right: c < cx, jump: (opts.jump ?? false) || ((opts.unstick ?? true) && stuck) };
  };
}

/** Leva cada jogador da lista até o centro correspondente (os outros parados). */
export function goTo(w: World, moves: [Player, number][], max = 1500, opts: { unstick?: boolean } = {}) {
  const s = steer(w);
  const at = (p: Player, cx: number) => Math.abs(p.x + p.w / 2 - cx) <= 1 && p.onGround;
  return drive(
    w,
    (p) => {
      const m = moves.find(([q]) => q === p);
      return m && !at(p, m[1]) ? s(p, m[1], opts) : NO_INPUT;
    },
    () => moves.every(([p, cx]) => at(p, cx)),
    max,
  );
}

/** `p` pula (segurando) andando para `dir` até pousar com os pés na linha `row`. */
export function jumpOnto(w: World, p: Player, row: number, dir: 1 | -1 = 1, max = 300) {
  return drive(
    w,
    (q) => (q === p ? { ...NO_INPUT, right: dir > 0, left: dir < 0, jump: q.onGround || q.vy < 0 } : NO_INPUT),
    () => p.onGround && Math.abs(p.y + p.h - row * TILE) < 0.01,
    max,
  );
}

/** `top` sobe na cabeça de `base` (que fica parado). */
export function climbOn(w: World, top: Player, base: Player, max = 600) {
  const s = steer(w);
  const on = () => top.onGround && Math.abs(top.y + top.h - base.y) < 0.01 && top.x < base.x + base.w && base.x < top.x + top.w;
  return drive(w, (p) => (p === top ? { ...s(p, base.x + base.w / 2), jump: !on() && p.onGround && Math.abs(p.x + p.w / 2 - (base.x + base.w / 2)) < 24 } : NO_INPUT), on, max);
}

/** Todos andam com o bot genérico até terminar a fase. */
export function finish(w: World, max = 6000) {
  const walk = walker(w);
  for (let f = 0; f < max && w.status === "playing"; f++) step(w, w.players.map((_, i) => walk(i, f)));
  return w.status;
}

/** Só os jogadores em `who` andam com o bot genérico até `done`. */
export function solo(w: World, who: number[], done: () => boolean, max = 2000) {
  const walk = walker(w);
  for (let f = 0; f < max && !done(); f++) step(w, w.players.map((_, j) => (who.includes(j) ? walk(j, f) : NO_INPUT)));
  return done();
}
