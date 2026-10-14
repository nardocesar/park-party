import {
  AIR_RESISTIVITY,
  BOX_SPEED,
  COYOTE_FRAMES,
  DOOR_H,
  DOOR_W,
  GRAVITY,
  GRAVITY_MAX,
  GATE_SPEED,
  GRAVITY_WEAK,
  JUMP_VELO,
  KEY_EXCLUDE_FRAMES,
  KEY_SIZE,
  LIFT_SPEED,
  PLAYER_SIZE,
  TILE,
  VIEW_W,
  WALK_SPEED,
} from "./constants";
import { isSolidAt, type Level } from "./level";

export type PlayerInput = { left: boolean; right: boolean; jump: boolean };
export const NO_INPUT: PlayerInput = { left: false, right: false, jump: false };

type Rect = { x: number; y: number; w: number; h: number };

export type Player = Rect & {
  kind: "player";
  index: number;
  vx: number;
  vy: number;
  onGround: boolean;
  coyote: number;
  jumpHeld: boolean;
  facing: 1 | -1;
  cleared: boolean;
};

export type Box = Rect & { kind: "box"; index: number; vy: number; need: number; pushers: number };

/** Plataforma cinemática: não colide, só carrega quem está em cima. */
export type Lift = Rect & { kind: "lift"; index: number; startY: number; travel: number; need: number; weight: number };

/** Tudo que é sólido e se move: jogadores, caixas e elevadores. */
type Body = Player | Box | Lift;
type Support = "tile" | Body | null;

export type Switch = Rect & { target: string; on: boolean };
/** `open` vai de 0 (fechado) a 1 (aberto); a parte sólida é o topo com altura h·(1−open). */
export type Gate = Rect & { id: string; open: number };

export type Key = Rect & { holder: number | null; excluded: number | null; excludeTimer: number; used: boolean };
export type Door = Rect & { open: boolean };

export type World = {
  level: Level;
  players: Player[];
  boxes: Box[];
  switches: Switch[];
  gates: Gate[];
  lifts: Lift[];
  key: Key;
  door: Door;
  cameraX: number;
  status: "playing" | "cleared";
  frame: number;
  resets: number;
};

export function createWorld(level: Level, playerCount: number): World {
  const world: World = {
    level,
    players: [],
    boxes: level.boxes.map((b, index) => ({ kind: "box", index, x: 0, y: 0, w: b.w, h: b.h, vy: 0, need: b.need, pushers: 0 })),
    switches: level.switches.map((sw) => ({ ...sw, on: false })),
    gates: level.gates.map((g) => ({ ...g, open: 0 })),
    lifts: level.lifts.map((l, index) => ({
      kind: "lift", index, x: l.x, y: l.y, w: l.w, h: l.h, startY: l.y, travel: l.travel, need: l.need, weight: 0,
    })),
    key: { x: 0, y: 0, w: KEY_SIZE, h: KEY_SIZE, holder: null, excluded: null, excludeTimer: 0, used: false },
    door: { x: level.door.x, y: level.door.y, w: DOOR_W, h: DOOR_H, open: false },
    cameraX: 0,
    status: "playing",
    frame: 0,
    resets: 0,
  };
  for (let i = 0; i < playerCount; i++) {
    world.players.push({
      kind: "player", index: i, x: 0, y: 0, w: PLAYER_SIZE, h: PLAYER_SIZE,
      vx: 0, vy: 0, onGround: false, coyote: 0, jumpHeld: false, facing: 1, cleared: false,
    });
  }
  placeEntities(world);
  return world;
}

/** Volta a fase ao estado inicial (morte de qualquer jogador reinicia todos). */
export function resetWorld(world: World) {
  world.resets++;
  placeEntities(world);
}

function placeEntities(world: World) {
  const { level } = world;
  for (const p of world.players) {
    const spawn = level.spawns[p.index] ?? {
      x: level.spawns[level.spawns.length - 1].x + (p.index - level.spawns.length + 1) * TILE,
      y: level.spawns[level.spawns.length - 1].y,
    };
    Object.assign(p, { x: spawn.x, y: spawn.y, vx: 0, vy: 0, onGround: false, coyote: 0, jumpHeld: false, cleared: false });
  }
  for (const b of world.boxes) placeBox(world, b);
  for (const sw of world.switches) sw.on = false;
  for (const g of world.gates) g.open = 0;
  for (const l of world.lifts) Object.assign(l, { y: l.startY, weight: 0 });
  Object.assign(world.key, { x: level.key.x, y: level.key.y, holder: null, excluded: null, excludeTimer: 0, used: false });
  world.door.open = false;
  world.status = "playing";
  updateCamera(world);
}

function placeBox(world: World, b: Box) {
  const def = world.level.boxes[b.index];
  Object.assign(b, { x: def.x, y: def.y, vy: 0, pushers: 0 });
}

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const EPS = 0.01;
const verticalOverlap = (a: Rect, b: Rect) => a.y < b.y + b.h && b.y < a.y + a.h;

function tileHit(level: Level, r: Rect): boolean {
  const c0 = Math.floor(r.x / TILE);
  const c1 = Math.ceil((r.x + r.w) / TILE) - 1;
  const r0 = Math.floor(r.y / TILE);
  const r1 = Math.ceil((r.y + r.h) / TILE) - 1;
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) if (isSolidAt(level, col, row)) return true;
  }
  return false;
}

const active = (world: World) => world.players.filter((p) => !p.cleared);
const bodies = (world: World): Body[] => [...active(world), ...world.boxes, ...world.lifts];
export const gateRect = (g: Gate): Rect => ({ x: g.x, y: g.y, w: g.w, h: g.h * (1 - g.open) });
const gateRects = (world: World) => world.gates.map(gateRect).filter((r) => r.h > 0);

/** O que está logo abaixo do corpo: "tile", outro corpo, ou null. */
function supportOf(world: World, body: Body): Support {
  const probe = { x: body.x, y: body.y + body.h, w: body.w, h: EPS };
  if (tileHit(world.level, probe) || gateRects(world).some((g) => overlaps(probe, g))) return "tile";
  for (const o of bodies(world)) if (o !== body && overlaps(probe, o)) return o;
  return null;
}

/**
 * Move um eixo em subpassos de no máximo 4 px e encosta no primeiro obstáculo.
 * `ignore` são corpos atravessáveis neste movimento (quem está em cima de mim).
 */
function moveAxis(world: World, body: Body, d: number, axis: "x" | "y", ignore: Set<Body>, bounds?: [number, number]) {
  let hit = false;
  const steps = Math.ceil(Math.abs(d) / 4);
  const size = axis === "x" ? body.w : body.h;
  for (let i = 0; i < steps && !hit; i++) {
    const delta = d / steps;
    body[axis] += delta;
    if (axis === "x" && bounds) {
      if (body.x < bounds[0]) { body.x = bounds[0]; hit = true; }
      if (body.x > bounds[1]) { body.x = bounds[1]; hit = true; }
    }
    if (tileHit(world.level, body)) {
      body[axis] = delta > 0 ? Math.floor((body[axis] + size) / TILE) * TILE - size : Math.ceil(body[axis] / TILE) * TILE;
      hit = true;
    }
    for (const o of [...bodies(world), ...gateRects(world)]) {
      if (o === body || ignore.has(o as Body) || !overlaps(body, o)) continue;
      body[axis] = delta > 0 ? o[axis] - size : o[axis] + (axis === "x" ? o.w : o.h);
      hit = true;
    }
  }
  return { hit };
}

function updateCamera(world: World) {
  const ps = active(world);
  if (ps.length === 0) return;
  const center = ps.reduce((s, p) => s + p.x + p.w / 2, 0) / ps.length;
  const max = Math.max(0, world.level.width - VIEW_W);
  world.cameraX = Math.min(max, Math.max(0, center - VIEW_W / 2));
}

/**
 * Quantos jogadores empurram a caixa na direção `dir`: quem encosta na lateral apertando
 * para ela, mais quem encosta nesses (fila), todos apertando na mesma direção.
 */
function countPushers(box: Box, dir: 1 | -1, ps: Player[], inputs: PlayerInput[], support: Map<Body, Support>) {
  const pressing = ps.filter((p) => {
    const input = inputs[p.index] ?? NO_INPUT;
    return (dir > 0 ? input.right && !input.left : input.left && !input.right) && support.get(p) !== box;
  });
  const touches = (back: Rect, front: Rect) =>
    verticalOverlap(back, front) && Math.abs(dir > 0 ? back.x + back.w - front.x : front.x + front.w - back.x) < EPS;
  const chain: Rect[] = [box];
  const counted = new Set<Player>();
  for (let i = 0; i < chain.length; i++) {
    for (const p of pressing) {
      if (counted.has(p) || !touches(p, chain[i])) continue;
      counted.add(p);
      chain.push(p);
    }
  }
  return counted.size;
}

export function step(world: World, inputs: PlayerInput[]) {
  if (world.status !== "playing") return;
  world.frame++;
  const ps = active(world);
  const support = new Map<Body, Support>();
  for (const b of bodies(world)) support.set(b, supportOf(world, b));
  const ridersOf = (body: Body) => new Set(bodies(world).filter((o) => support.get(o) === body));
  const displacement = new Map<Body, { dx: number; dy: number }>();

  // 1. Controle e gravidade dos jogadores
  for (const p of ps) {
    const input = inputs[p.index] ?? NO_INPUT;
    const grounded = support.get(p) !== null;
    p.coyote = grounded ? COYOTE_FRAMES : Math.max(0, p.coyote - 1);

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) {
      p.vx = dir * WALK_SPEED;
      p.facing = dir as 1 | -1;
    } else {
      p.vx = grounded ? 0 : p.vx * AIR_RESISTIVITY;
    }

    if (input.jump && !p.jumpHeld && p.coyote > 0) {
      p.vy = JUMP_VELO;
      p.coyote = 0;
    }
    p.jumpHeld = input.jump;
    const g = input.jump && p.vy < 0 ? GRAVITY_WEAK : GRAVITY;
    p.vy = Math.min(GRAVITY_MAX, p.vy + g);
  }

  // 2. Elevadores: o peso é quem está em cima, direta ou indiretamente (empilhado)
  for (const l of world.lifts) {
    const stack = new Set<Body>([l]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const b of bodies(world)) {
        const s = support.get(b);
        if (!stack.has(b) && s && s !== "tile" && stack.has(s)) {
          stack.add(b);
          grew = true;
        }
      }
    }
    l.weight = [...stack].filter((b) => b.kind === "player").length;
    const target = l.startY + (l.weight >= Math.min(l.need, world.players.length) ? l.travel : 0);
    const y0 = l.y;
    l.y += Math.max(-LIFT_SPEED, Math.min(LIFT_SPEED, target - l.y));
    displacement.set(l, { dx: 0, dy: l.y - y0 });
  }

  // 3. Caixas: andam se houver empurradores suficientes; caem sem apoio
  const required = (b: Box) => Math.min(b.need, world.players.length);
  for (const b of world.boxes) {
    const right = countPushers(b, 1, ps, inputs, support);
    const left = countPushers(b, -1, ps, inputs, support);
    b.pushers = Math.max(right, left);
    const dir = (right >= required(b) ? 1 : 0) - (left >= required(b) ? 1 : 0);
    const x0 = b.x;
    const y0 = b.y;
    const riders = ridersOf(b);
    if (dir !== 0) moveAxis(world, b, dir * BOX_SPEED, "x", riders);
    b.vy = Math.min(GRAVITY_MAX, b.vy + GRAVITY);
    if (moveAxis(world, b, b.vy, "y", new Set()).hit) b.vy = 0;
    if (b.y > world.level.height + TILE * 2) placeBox(world, b);
    displacement.set(b, { dx: b.x - x0, dy: b.y - y0 });
  }

  // 4. Jogadores de baixo para cima: quem está em cima herda o deslocamento do suporte
  const camBounds: [number, number] | undefined =
    world.level.width > VIEW_W ? [world.cameraX, world.cameraX + VIEW_W - PLAYER_SIZE] : undefined;
  const order = [...ps].sort((a, b) => b.y + b.h - (a.y + a.h));
  for (const p of order) {
    const riders = ridersOf(p);
    const s = support.get(p);
    const carry = s && s !== "tile" ? displacement.get(s) : undefined;
    const x0 = p.x;
    const y0 = p.y;
    if (carry) {
      moveAxis(world, p, carry.dx, "x", riders, camBounds);
      if (carry.dy !== 0) moveAxis(world, p, carry.dy, "y", carry.dy < 0 ? riders : new Set([s as Body]));
    }
    moveAxis(world, p, p.vx, "x", riders, camBounds);
    const { hit } = moveAxis(world, p, p.vy, "y", p.vy < 0 ? riders : new Set());
    if (hit) p.vy = 0;
    p.onGround = supportOf(world, p) !== null;
    displacement.set(p, { dx: p.x - x0, dy: p.y - y0 });
  }

  // 5. Morte: cair do mapa reinicia a fase
  if (ps.some((p) => p.y > world.level.height + TILE * 2)) {
    resetWorld(world);
    return;
  }

  updateSwitches(world);
  updateKey(world);
  updateDoor(world);
  updateCamera(world);
}

function updateSwitches(world: World) {
  const things = bodies(world);
  for (const sw of world.switches) sw.on = things.some((b) => overlaps(b, sw));
  for (const g of world.gates) {
    const opening = world.switches.some((sw) => sw.on && sw.target === g.id);
    if (opening) {
      g.open = Math.min(1, g.open + GATE_SPEED / g.h);
      continue;
    }
    // fecha sem esmagar: não cresce sobre um corpo
    const next = { ...g, open: Math.max(0, g.open - GATE_SPEED / g.h) };
    if (!things.some((b) => overlaps(b, gateRect(next)))) g.open = next.open;
  }
}

function updateKey(world: World) {
  const { key } = world;
  if (key.used) return;
  if (key.excludeTimer > 0 && --key.excludeTimer === 0) key.excluded = null;

  for (const p of active(world)) {
    if (p.index === key.holder || p.index === key.excluded || !overlaps(p, key)) continue;
    if (key.holder !== null) {
      key.excluded = key.holder;
      key.excludeTimer = KEY_EXCLUDE_FRAMES;
    }
    key.holder = p.index;
    break;
  }

  if (key.holder !== null) {
    const h = world.players[key.holder];
    const tx = h.x + h.w / 2 - key.w / 2;
    const ty = h.y - key.h - 2;
    key.x += (tx - key.x) * 0.3;
    key.y += (ty - key.y) * 0.3;
  }

  if (key.y > world.level.height) {
    Object.assign(key, { x: world.level.key.x, y: world.level.key.y, holder: null, excluded: null, excludeTimer: 0 });
  }
}

function updateDoor(world: World) {
  const { door, key } = world;
  if (!door.open && key.holder !== null && overlaps(world.players[key.holder], door)) {
    door.open = true;
    key.used = true;
    key.holder = null;
  }
  if (!door.open) return;
  for (const p of active(world)) {
    const cx = p.x + p.w / 2;
    if (cx > door.x && cx < door.x + door.w && overlaps(p, door)) p.cleared = true;
  }
  if (world.players.every((p) => p.cleared)) world.status = "cleared";
}
