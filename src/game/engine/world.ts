import {
  AIR_RESISTIVITY,
  COYOTE_FRAMES,
  DOOR_H,
  DOOR_W,
  GRAVITY,
  GRAVITY_MAX,
  GRAVITY_WEAK,
  JUMP_VELO,
  KEY_EXCLUDE_FRAMES,
  KEY_SIZE,
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
  index: number;
  vx: number;
  vy: number;
  onGround: boolean;
  coyote: number;
  jumpHeld: boolean;
  facing: 1 | -1;
  cleared: boolean;
};

export type Key = Rect & { holder: number | null; excluded: number | null; excludeTimer: number; used: boolean };
export type Door = Rect & { open: boolean };

export type World = {
  level: Level;
  players: Player[];
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
    key: { x: 0, y: 0, w: KEY_SIZE, h: KEY_SIZE, holder: null, excluded: null, excludeTimer: 0, used: false },
    door: { x: level.door.x, y: level.door.y, w: DOOR_W, h: DOOR_H, open: false },
    cameraX: 0,
    status: "playing",
    frame: 0,
    resets: 0,
  };
  for (let i = 0; i < playerCount; i++) {
    world.players.push({
      index: i, x: 0, y: 0, w: PLAYER_SIZE, h: PLAYER_SIZE,
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
  Object.assign(world.key, { x: level.key.x, y: level.key.y, holder: null, excluded: null, excludeTimer: 0, used: false });
  world.door.open = false;
  world.status = "playing";
  updateCamera(world);
}

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

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

/** O que está logo abaixo do jogador: "tile", índice de outro jogador, ou null. */
function supportOf(world: World, p: Player): "tile" | number | null {
  const probe = { x: p.x, y: p.y + p.h, w: p.w, h: 0.01 };
  if (tileHit(world.level, probe)) return "tile";
  for (const o of active(world)) if (o !== p && overlaps(probe, o)) return o.index;
  return null;
}

/**
 * Move um eixo em subpassos de no máximo 4 px e encosta no primeiro obstáculo.
 * `ignore` são jogadores atravessáveis neste movimento (quem está em cima de mim).
 */
function moveAxis(world: World, p: Player, d: number, axis: "x" | "y", ignore: Set<number>, bounds?: [number, number]) {
  let moved = 0;
  let hit = false;
  const steps = Math.ceil(Math.abs(d) / 4);
  for (let i = 0; i < steps && !hit; i++) {
    const delta = d / steps;
    p[axis] += delta;
    moved += delta;
    if (axis === "x" && bounds) {
      if (p.x < bounds[0]) { moved += bounds[0] - p.x; p.x = bounds[0]; hit = true; }
      if (p.x > bounds[1]) { moved -= p.x - bounds[1]; p.x = bounds[1]; hit = true; }
    }
    const size = axis === "x" ? p.w : p.h;
    if (tileHit(world.level, p)) {
      const before = p[axis];
      p[axis] = delta > 0 ? Math.floor((p[axis] + size) / TILE) * TILE - size : Math.ceil(p[axis] / TILE) * TILE;
      moved += p[axis] - before;
      hit = true;
    }
    for (const o of active(world)) {
      if (o === p || ignore.has(o.index) || !overlaps(p, o)) continue;
      const before = p[axis];
      p[axis] = delta > 0 ? o[axis] - size : o[axis] + (axis === "x" ? o.w : o.h);
      moved += p[axis] - before;
      hit = true;
    }
  }
  return { moved, hit };
}

function updateCamera(world: World) {
  const ps = active(world);
  if (ps.length === 0) return;
  const center = ps.reduce((s, p) => s + p.x + p.w / 2, 0) / ps.length;
  const max = Math.max(0, world.level.width - VIEW_W);
  world.cameraX = Math.min(max, Math.max(0, center - VIEW_W / 2));
}

export function step(world: World, inputs: PlayerInput[]) {
  if (world.status !== "playing") return;
  world.frame++;
  const ps = active(world);

  // 1. Suporte no início do frame, controle e gravidade
  const support = new Map<number, "tile" | number | null>();
  for (const p of ps) {
    const input = inputs[p.index] ?? NO_INPUT;
    const s = supportOf(world, p);
    support.set(p.index, s);
    p.coyote = s !== null ? COYOTE_FRAMES : Math.max(0, p.coyote - 1);

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) {
      p.vx = dir * WALK_SPEED;
      p.facing = dir as 1 | -1;
    } else {
      p.vx = s !== null ? 0 : p.vx * AIR_RESISTIVITY;
    }

    if (input.jump && !p.jumpHeld && p.coyote > 0) {
      p.vy = JUMP_VELO;
      p.coyote = 0;
    }
    p.jumpHeld = input.jump;
    const g = input.jump && p.vy < 0 ? GRAVITY_WEAK : GRAVITY;
    p.vy = Math.min(GRAVITY_MAX, p.vy + g);
  }

  // 2. Movimento de baixo para cima: quem está em cima herda o deslocamento do suporte
  const camBounds: [number, number] | undefined =
    world.level.width > VIEW_W ? [world.cameraX, world.cameraX + VIEW_W - PLAYER_SIZE] : undefined;
  const displacement = new Map<number, { dx: number; dy: number }>();
  const order = [...ps].sort((a, b) => b.y + b.h - (a.y + a.h));
  for (const p of order) {
    const riders = new Set(ps.filter((o) => support.get(o.index) === p.index).map((o) => o.index));
    const s = support.get(p.index);
    const carry = typeof s === "number" ? displacement.get(s) : undefined;
    const x0 = p.x;
    const y0 = p.y;
    if (carry) {
      moveAxis(world, p, carry.dx, "x", riders, camBounds);
      if (carry.dy < 0) moveAxis(world, p, carry.dy, "y", riders);
    }
    moveAxis(world, p, p.vx, "x", riders, camBounds);
    const { hit } = moveAxis(world, p, p.vy, "y", p.vy < 0 ? riders : new Set());
    if (hit) p.vy = 0;
    p.onGround = supportOf(world, p) !== null;
    displacement.set(p.index, { dx: p.x - x0, dy: p.y - y0 });
  }

  // 3. Morte: cair do mapa reinicia a fase
  if (ps.some((p) => p.y > world.level.height + TILE * 2)) {
    resetWorld(world);
    return;
  }

  updateKey(world);
  updateDoor(world);
  updateCamera(world);
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
