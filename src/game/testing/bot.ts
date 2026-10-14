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
export function steer() {
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
  const s = steer();
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
  const s = steer();
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

/** Anda para um lado (sem pular) até `done`. */
const go = (dir: 1 | -1): PlayerInput => ({ ...NO_INPUT, right: dir > 0, left: dir < 0 });

/**
 * Paredão com corda: `base` vai até o degrau duplo e encosta no paredão (borda em `wallCol`);
 * `climber` sobe no degrau, na cabeça da base e no paredão (pés na linha `topRow`); depois anda
 * no alto içando a base pela corda.
 */
export function stackHoist(w: World, base: Player, climber: Player, wallCol: number, topRow: number) {
  const walk = walker(w);
  const bi = w.players.indexOf(base);
  const ci = w.players.indexOf(climber);
  const onTop = (p: Player) => p.onGround && Math.abs(p.y + p.h - topRow * TILE) < 0.01;
  for (let f = 0; f < 900 && !(base.onGround && base.x + base.w >= wallCol * TILE - 0.5); f++)
    step(w, w.players.map((_, i) => (i === bi ? walk(i, f) : NO_INPUT)));
  for (let f = 0; f < 900 && !onTop(climber); f++) step(w, w.players.map((_, i) => (i === ci ? walk(i, f) : NO_INPUT)));
  drive(w, (p) => (p === climber ? go(1) : NO_INPUT), () => onTop(base), 600);
  return onTop(base) && onTop(climber);
}

/**
 * Rapel: `holder` acompanha `faller` de perto até ele cair no poço (coluna `shaftCol`); depois o
 * holder anda para trás içando o faller de volta à superfície (pés na linha `surfaceRow`).
 */
export function rapel(w: World, faller: Player, holder: Player, shaftCol: number, surfaceRow: number) {
  waitFor(w, () => faller.onGround && holder.onGround, 60);
  drive(
    w,
    (p) => (p === faller ? go(1) : p === holder && holder.x + holder.w < faller.x - 18 ? go(1) : NO_INPUT),
    () => !faller.onGround && faller.x > shaftCol * TILE - 4,
    900,
  );
  waitFor(w, () => false, 120);
  drive(w, (p) => (p === holder ? go(-1) : NO_INPUT), () => faller.onGround && Math.abs(faller.y + faller.h - surfaceRow * TILE) < 0.01, 900);
  return faller.onGround && Math.abs(faller.y + faller.h - surfaceRow * TILE) < 0.01;
}

/**
 * Revezamento num portão com botões temporizados dos dois lados: `lead` segura o botão da esquerda
 * (`left`), `runner` passa pelo portão e segura o da direita (`right`), e `lead` passa (até `right + 2`).
 */
export function relay(w: World, lead: Player, runner: Player, left: number, right: number) {
  const s = steer();
  const center = (col: number) => mid(col);
  const at = (p: Player, col: number) => Math.abs(p.x + p.w / 2 - center(col)) <= 1;
  drive(w, (p) => (p === lead && !at(p, left) ? s(p, center(left)) : NO_INPUT), () => at(lead, left), 900);
  drive(w, (p) => (p === runner && !at(p, right) ? s(p, center(right)) : NO_INPUT), () => at(runner, right), 900);
  drive(w, (p) => (p === lead && !at(p, right + 2) ? s(p, center(right + 2)) : NO_INPUT), () => at(lead, right + 2), 900);
  return at(runner, right) && at(lead, right + 2);
}

/** Espera o bloco que pisca `blink` aparecer com pelo menos `frames` de folga e todos andam `walk` frames. */
export function crossBlinkBridge(w: World, blinkIndex: number, frames = 70, walkFrames = 70) {
  const b = w.blinks[blinkIndex];
  waitFor(w, () => b.visible && b.timer > frames, 900);
  drive(w, () => ({ ...NO_INPUT, right: true }), () => false, walkFrames);
}

/** Espera o pistão `index` recolher (parado com folga) e todos passam até `pastCol`. */
export function passPiston(w: World, index: number, waitCol: number, pastCol: number) {
  const piston = w.pushers[index];
  const byX = [...w.players].sort((p, q) => q.x - p.x); // o da frente fica mais perto do pistão
  goTo(w, byX.map((p, i) => [p, mid(waitCol - i)] as [Player, number]), 1500, { unstick: false });
  waitFor(w, () => piston.state === "idle" && piston.timer > 80, 900);
  // cada um para assim que passa de `pastCol` (não segue andando enquanto espera o outro)
  const walk = walker(w);
  const past = (p: Player) => p.x > pastCol * TILE && p.onGround;
  for (let f = 0; f < 600 && !w.players.every(past); f++) step(w, w.players.map((p, i) => (past(p) ? NO_INPUT : walk(i, f))));
  return w.players.every(past);
}

const railLength = (w: World, index: number) => {
  const path = w.level.rails[index].path;
  let t = 0;
  for (let i = 1; i < path.length; i++) t += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  return t;
};

/** Todos sobem no trilho `index` (nas colunas `cols`) e esperam ele chegar ao fim. */
export function rideRail(w: World, index: number, cols: number[], max = 4000) {
  const rail = w.rails[index];
  const def = w.level.rails[index];
  if (def.need === 0) waitFor(w, () => rail.s === 0 && rail.wait > 30, 1500);
  // quem está mais à frente fica com a coluna mais à frente (ninguém precisa passar pelo outro)
  const byX = [...w.players].sort((p, q) => p.x - q.x);
  const sortedCols = [...cols].sort((x, y) => x - y);
  goTo(w, byX.map((p, i) => [p, mid(sortedCols[i])] as [Player, number]), def.need === 0 ? 90 : 1500, { unstick: false });
  const end = railLength(w, index);
  waitFor(w, () => rail.s === end && (def.need !== 0 || rail.wait > 0), max);
  return rail.s === end;
}

/** Leva os jogadores aos centros `cols` (na ordem em que estão) e quem tem `flip[i]` aperta "baixo". */
export function goFlip(w: World, cols: number[], flip: boolean[]) {
  const byX = [...w.players].sort((p, q) => p.x - q.x);
  const ok = goTo(w, byX.map((p, i) => [p, mid(cols[i])] as [Player, number]), 1500, { unstick: false });
  step(w, w.players.map((p) => ({ ...NO_INPUT, down: flip[byX.indexOf(p)] })));
  waitFor(w, () => w.players.every((q) => q.onGround), 120);
  return ok;
}
