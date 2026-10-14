import {
  AIR_RESISTIVITY,
  BOX_SPEED,
  COYOTE_FRAMES,
  THORN_RECTS_UP,
  FPS,
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
  LIFT_WAIT_FRAMES,
  MOVEWALL_IDLE,
  MOVEWALL_RETURN_SPEED,
  MOVEWALL_SPEED,
  MOVEWALL_W,
  MOVEWALL_WAIT,
  RAIL_H,
  PLAYER_SIZE,
  ROPE_K,
  ROPE_RESULT_Y_MAX,
  TILE,
  VIEW_W,
  WALK_SPEED,
} from "./constants";
import { isSolidAt, type Level, type ThornDir } from "./level";

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
export type Lift = Rect & {
  kind: "lift";
  index: number;
  startY: number;
  travel: number;
  need: number;
  weight: number;
  /** Frames que ainda espera no fim do curso depois que o peso sai. */
  wait: number;
};

/** Chão que cai: depois de pisado espera e cai com gravidade até pousar. */
export type Fall = Rect & { kind: "fall"; index: number; vy: number; touched: boolean; timer: number };
/** Espinho: mata ao toque; anda de (x0,y0) a (x0+dx, y0+dy) e volta. */
export type Thorn = Rect & {
  dir: ThornDir;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  speed: number;
  t: number;
  way: 1 | -1;
};

/** Plataforma em trilho: `s` é a distância percorrida no caminho. */
export type Rail = Rect & { kind: "rail"; index: number; s: number; weight: number; wait: number; forward: boolean };
/** Parede que empurra: `offset` em px a partir da posição inicial `x0`. */
export type Pusher = Rect & { x0: number; offset: number; state: "idle" | "move" | "wait" | "return"; timer: number };

/** Tudo que é sólido e se move: jogadores, caixas, elevadores, chãos que caem e trilhos. */
type Body = Player | Box | Lift | Fall | Rail;
type Support = "tile" | Body | null;

export type Switch = Rect & {
  target: string;
  /** Saída do botão (o que os portões enxergam). */
  on: boolean;
  /** Algo está em cima agora. */
  pressed: boolean;
  timer: number;
  delay: number;
  /** Frames restantes ligado depois de solto (botão temporizado). */
  rest: number;
  /** Frames até o efeito chegar (botão com atraso); `latched` depois que chega. */
  countdown: number;
  latched: boolean;
};
export type Blink = Rect & { on: number; off: number; visible: boolean; timer: number };
/** `open` vai de 0 (fechado) a 1 (aberto); a parte sólida é o topo com altura h·(1−open). */
export type Gate = Rect & { id: string; open: number; needAll: boolean };

export type Key = Rect & { holder: number | null; excluded: number | null; excludeTimer: number; used: boolean };
export type Door = Rect & { open: boolean };

export type World = {
  level: Level;
  players: Player[];
  boxes: Box[];
  switches: Switch[];
  gates: Gate[];
  blinks: Blink[];
  falls: Fall[];
  thorns: Thorn[];
  rails: Rail[];
  pushers: Pusher[];
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
    switches: level.switches.map((sw) => ({ ...sw, on: false, pressed: false, rest: 0, countdown: 0, latched: false })),
    gates: level.gates.map((g) => ({ ...g, open: 0 })),
    falls: level.falls.map((f, index) => ({ kind: "fall", index, x: f.x, y: f.y, w: f.w, h: f.h, vy: 0, touched: false, timer: 0 })),
    thorns: level.thorns.map((t) => ({ ...t, x0: t.x, y0: t.y, t: 0, way: 1 })),
    rails: level.rails.map((r, index) => ({
      kind: "rail", index, x: r.path[0].x, y: r.path[0].y, w: r.w, h: RAIL_H, s: 0, weight: 0, wait: 0, forward: true,
    })),
    pushers: level.pushers.map((p) => ({ x: p.x, y: p.y, w: p.w ?? MOVEWALL_W, h: p.h, x0: p.x, offset: 0, state: "idle", timer: 0 })),
    blinks: level.blinks.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h, on: b.on, off: b.off, visible: true, timer: 0 })),
    lifts: level.lifts.map((l, index) => ({
      kind: "lift", index, x: l.x, y: l.y, w: l.w, h: l.h, startY: l.y, travel: l.travel, need: l.need, weight: 0, wait: 0,
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
  for (const sw of world.switches) Object.assign(sw, { on: false, pressed: false, rest: 0, countdown: 0, latched: false });
  for (const g of world.gates) g.open = 0;
  world.blinks.forEach((b, i) => {
    const def = level.blinks[i];
    b.visible = def.startOn;
    b.timer = Math.max(1, Math.round(((b.visible ? def.on : def.off) - def.phase) * FPS));
  });
  for (const l of world.lifts) Object.assign(l, { y: l.startY, weight: 0, wait: 0 });
  world.falls.forEach((f, i) => Object.assign(f, { x: level.falls[i].x, y: level.falls[i].y, vy: 0, touched: false, timer: 0 }));
  for (const t of world.thorns) Object.assign(t, { x: t.x0, y: t.y0, t: 0, way: 1 });
  world.rails.forEach((r, i) => Object.assign(r, { ...level.rails[i].path[0], s: 0, weight: 0, wait: 0, forward: true }));
  for (const p of world.pushers) Object.assign(p, { x: p.x0, offset: 0, state: "idle", timer: Math.round(MOVEWALL_IDLE * FPS) });
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
const bodies = (world: World): Body[] => [...active(world), ...world.boxes, ...world.lifts, ...world.falls, ...world.rails];
export const gateRect = (g: Gate): Rect => ({ x: g.x, y: g.y, w: g.w, h: g.h * (1 - g.open) });
/** Sólidos sem física além dos tiles: portões (parte fechada), blocos que piscam visíveis e paredes que empurram. */
const gateRects = (world: World): Rect[] => [
  ...world.gates.map(gateRect).filter((r) => r.h > 0),
  ...world.blinks.filter((b) => b.visible),
  ...world.pushers,
  ...world.level.springs,
];

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
function moveAxis(world: World, body: Body, d: number, axis: "x" | "y", ignore: Set<object>, bounds?: [number, number]) {
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
      if (o === body || ignore.has(o) || !overlaps(body, o)) continue;
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
  /** Quem está em cima do corpo, direta ou indiretamente (empilhado). */
  const stackOf = (base: Body): Body[] => {
    const stack = new Set<Body>([base]);
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
    stack.delete(base);
    return [...stack];
  };
  const displacement = new Map<Body, { dx: number; dy: number }>();

  // vento e trampolins acionados por botão: "ligado" se não tem alvo ou se um botão do alvo está ligado
  const powered = (target: string | null) => target === null || world.switches.some((sw) => sw.target === target && sw.on);
  const windOf = (p: Player) => {
    let fx = 0;
    let fy = 0;
    for (const wd of world.level.winds) {
      if (powered(wd.target) && overlaps(p, wd)) {
        fx += wd.fx;
        fy = Math.min(fy, wd.fy);
      }
    }
    return { fx, fy };
  };
  const wind = new Map<Player, { fx: number; fy: number }>();

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

    // trampolim (JumpStandComponent.notifyJump): quem está em cima recebe a velocidade de lançamento
    const feet = { x: p.x, y: p.y + p.h, w: p.w, h: EPS };
    const spring = world.level.springs.find((sp) => powered(sp.target) && overlaps(feet, sp));
    if (spring) {
      p.vy = spring.vy;
      if (spring.vx !== 0) p.vx = spring.vx;
      p.coyote = 0;
    }
    // vento (WindComponent.OnCollided): velocidade externa enquanto estiver na área
    const wv = windOf(p);
    wind.set(p, wv);
    if (wv.fy < 0) p.vy = Math.min(p.vy, wv.fy);
  }

  // 2. Elevadores: o peso é quem está em cima, direta ou indiretamente (empilhado)
  for (const l of world.lifts) {
    l.weight = stackOf(l).filter((b) => b.kind === "player").length;
    const loaded = l.weight >= Math.min(l.need, world.players.length);
    if (loaded) l.wait = LIFT_WAIT_FRAMES;
    else if (l.wait > 0) l.wait--;
    const target = l.startY + (loaded || l.wait > 0 ? l.travel : 0);
    const y0 = l.y;
    l.y += Math.max(-LIFT_SPEED, Math.min(LIFT_SPEED, target - l.y));
    displacement.set(l, { dx: 0, dy: l.y - y0 });
  }

  // 2a. Trilhos (LinePathLift/UpDownLift) e paredes que empurram (MoveWall)
  let crushed = false;
  for (const r of world.rails) {
    const def = world.level.rails[r.index];
    r.weight = stackOf(r).filter((b) => b.kind === "player").length;
    const total = pathLength(def.path);
    let target = r.s;
    if (def.need === 0) {
      if (r.wait > 0) r.wait--;
      else target = r.forward ? total : 0;
    } else {
      const need = def.need < 0 ? world.players.length + def.need : Math.min(def.need, world.players.length);
      target = r.weight >= need ? total : def.returns ? 0 : r.s;
    }
    const before = r.s;
    r.s += Math.max(-def.speed, Math.min(def.speed, target - r.s));
    if (def.need === 0 && r.s !== before && (r.s === 0 || r.s === total)) {
      r.forward = r.s === 0;
      r.wait = Math.round(def.wait * FPS);
    }
    const pos = pointAt(def.path, r.s);
    const dx = pos.x - r.x;
    const dy = pos.y - r.y;
    r.x = pos.x;
    r.y = pos.y;
    displacement.set(r, { dx, dy });
    crushed ||= pushOut(world, r, dx, dy, ridersOf(r));
  }
  for (const p of world.pushers) {
    const def = world.level.pushers[world.pushers.indexOf(p)];
    const dir = Math.sign(def.dx);
    const before = p.offset;
    if (p.timer > 0) p.timer--;
    else if (p.state === "idle") p.state = "move";
    else if (p.state === "move") {
      p.offset += dir * MOVEWALL_SPEED;
      if (Math.abs(p.offset) >= Math.abs(def.dx)) {
        p.offset = def.dx;
        p.state = "wait";
        p.timer = Math.round(MOVEWALL_WAIT * FPS);
      }
    } else if (p.state === "wait") p.state = "return";
    else {
      p.offset -= dir * MOVEWALL_RETURN_SPEED;
      if (p.offset * dir <= 0) {
        p.offset = 0;
        p.state = "idle";
        p.timer = Math.round(MOVEWALL_IDLE * FPS);
      }
    }
    p.x = p.x0 + p.offset;
    crushed ||= pushOut(world, p, p.offset - before, 0, new Set());
  }
  if (crushed) {
    resetWorld(world);
    return;
  }

  // 2b. Chãos que caem (FallBoxComponent): pisados por cima, esperam e caem até pousar
  for (const f of world.falls) {
    if (!f.touched && bodies(world).some((b) => support.get(b) === f)) {
      f.touched = true;
      f.timer = Math.round(world.level.falls[f.index].wait * FPS);
    }
    const y0 = f.y;
    if (f.touched && f.timer > 0) f.timer--;
    else if (f.touched && f.y < world.level.height + TILE * 4) {
      f.vy = Math.min(GRAVITY_MAX, f.vy + GRAVITY);
      if (moveAxis(world, f, f.vy, "y", ridersOf(f)).hit) f.vy = 0;
    }
    displacement.set(f, { dx: 0, dy: f.y - y0 });
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
    if (dir !== 0) {
      moveAxis(world, b, dir * BOX_SPEED, "x", riders);
      snapIntoHole(world, b);
    }
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
    moveAxis(world, p, p.vx + (wind.get(p)?.fx ?? 0), "x", riders, camBounds);
    const { hit } = moveAxis(world, p, p.vy, "y", p.vy < 0 ? riders : new Set());
    if (hit) p.vy = 0;
    p.onGround = supportOf(world, p) !== null;
    displacement.set(p, { dx: p.x - x0, dy: p.y - y0 });
  }

  if (world.level.rope !== null) applyRope(world, world.level.rope, camBounds);

  // 5. Morte: cair do mapa ou tocar espinho reinicia a fase
  moveThorns(world);
  const deadly = world.thorns.flatMap(thornRects);
  if (ps.some((p) => p.y > world.level.height + TILE * 2 || deadly.some((d) => overlaps(p, d)))) {
    resetWorld(world);
    return;
  }

  updateSwitches(world);
  updateKey(world);
  updateDoor(world);
  updateCamera(world);
}

/**
 * A caixa anda em passos fracionários e nunca alinharia exatamente com um buraco da sua largura,
 * ficando apoiada por uma fração de pixel. Se a posição alinhada ao tile mais próximo (a menos de um
 * passo) não tem apoio nem colisão, encaixa nela para cair.
 */
function snapIntoHole(world: World, b: Box) {
  const snapped = Math.round(b.x / TILE) * TILE;
  if (snapped === b.x || Math.abs(snapped - b.x) > BOX_SPEED) return;
  const x = b.x;
  b.x = snapped;
  const blocked = tileHit(world.level, b) || bodies(world).some((o) => o !== b && overlaps(b, o));
  if (blocked || supportOf(world, b) !== null) b.x = x;
}

/** Áreas mortais do espinho: base e ponta em cada célula, giradas conforme a direção. */
export function thornRects(t: Thorn): Rect[] {
  const rotate = (r: Rect): Rect => {
    switch (t.dir) {
      case "up":
        return r;
      case "down":
        return { x: r.x, y: TILE - r.y - r.h, w: r.w, h: r.h };
      case "right":
        return { x: TILE - r.y - r.h, y: r.x, w: r.h, h: r.w };
      case "left":
        return { x: r.y, y: r.x, w: r.h, h: r.w };
    }
  };
  const out: Rect[] = [];
  for (let cx = 0; cx < t.w; cx += TILE) {
    for (let cy = 0; cy < t.h; cy += TILE) {
      for (const r of THORN_RECTS_UP.map(rotate)) out.push({ x: t.x + cx + r.x, y: t.y + cy + r.y, w: r.w, h: r.h });
    }
  }
  return out;
}

function pathLength(path: { x: number; y: number }[]) {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  return total;
}

function pointAt(path: { x: number; y: number }[], s: number) {
  for (let i = 1; i < path.length; i++) {
    const seg = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    if (s <= seg || i === path.length - 1) {
      const t = seg === 0 ? 0 : Math.min(1, s / seg);
      return { x: path[i - 1].x + (path[i].x - path[i - 1].x) * t, y: path[i - 1].y + (path[i].y - path[i - 1].y) * t };
    }
    s -= seg;
  }
  return { ...path[0] };
}

/**
 * Sólido cinemático (trilho, parede) acabou de se mover: empurra para fora quem ficou sobreposto, no
 * sentido do movimento. Quem não consegue sair (preso contra algo) é esmagado: retorna true se for jogador.
 */
function pushOut(world: World, mover: Rect, dx: number, dy: number, ignore: Set<Body>): boolean {
  let crushed = false;
  for (const b of bodies(world)) {
    if (b === mover || ignore.has(b) || (b.kind !== "player" && b.kind !== "box") || !overlaps(b, mover)) continue;
    if (dx !== 0) moveAxis(world, b, dx > 0 ? mover.x + mover.w - b.x : mover.x - (b.x + b.w), "x", new Set([mover]));
    if (dy !== 0) moveAxis(world, b, dy > 0 ? mover.y + mover.h - b.y : mover.y - (b.y + b.h), "y", new Set([mover]));
    if (overlaps(b, mover) && b.kind === "player") crushed = true;
  }
  return crushed;
}

function moveThorns(world: World) {
  for (const t of world.thorns) {
    const length = Math.hypot(t.dx, t.dy);
    if (length === 0 || t.speed === 0) continue;
    t.t = Math.min(1, Math.max(0, t.t + (t.way * t.speed) / length));
    if (t.t === 1 || t.t === 0) t.way = t.t === 1 ? -1 : 1;
    t.x = t.x0 + t.dx * t.t;
    t.y = t.y0 + t.dy * t.t;
  }
}

/**
 * Corda (DistanceConstraintComponent): liga os jogadores ativos em sequência pelo índice. Cada par
 * só puxa quando a distância entre os centros passa do comprimento; a força é ROPE_K × excesso na
 * direção do vizinho, dividida entre os dois. Quem está no chão e segura alguém pendurado não é
 * arrastado (ancora) nem puxado para baixo. Puxão horizontal contra parede vira subida.
 */
function applyRope(world: World, length: number, camBounds?: [number, number]) {
  const chain = active(world);
  const pull = new Map<Player, { dx: number; dy: number }>();
  const center = (p: Player) => ({ x: p.x + p.w / 2, y: p.y + p.h / 2 });
  for (let i = 0; i + 1 < chain.length; i++) {
    const a = chain[i];
    const b = chain[i + 1];
    const ca = center(a);
    const cb = center(b);
    const d = Math.hypot(cb.x - ca.x, cb.y - ca.y);
    if (d <= length) continue;
    const ux = (cb.x - ca.x) / d;
    const uy = (cb.y - ca.y) / d;
    const aAnchor = a.onGround && !b.onGround;
    const bAnchor = b.onGround && !a.onGround;
    const shareA = aAnchor ? 0 : bAnchor ? 1 : 0.5;
    const f = ROPE_K * (d - length);
    for (const [p, share, sx, sy] of [
      [a, shareA, ux, uy],
      [b, 1 - shareA, -ux, -uy],
    ] as const) {
      const acc = pull.get(p) ?? { dx: 0, dy: 0 };
      acc.dx += f * share * sx;
      acc.dy += f * share * sy;
      pull.set(p, acc);
    }
  }
  for (const [p, { dx, dy: rawDy }] of pull) {
    let dy = rawDy;
    if (p.onGround && dy > 0) dy = 0; // no chão não é puxado para baixo
    const { hit } = moveAxis(world, p, dx, "x", new Set(), camBounds);
    if (hit && Math.abs(dx) > 0 && dy <= 0) dy -= Math.abs(dx); // contra a parede: sobe
    dy = Math.max(-ROPE_RESULT_Y_MAX, Math.min(ROPE_RESULT_Y_MAX, dy));
    moveAxis(world, p, dy, "y", new Set());
    if (dy < 0 && p.vy > 0) p.vy = 0;
    if (dx !== 0 && Math.sign(dx) !== Math.sign(p.vx) && !p.onGround) p.vx = 0;
    p.onGround = supportOf(world, p) !== null;
  }
}

function updateSwitches(world: World) {
  const things = bodies(world);
  for (const sw of world.switches) {
    const wasPressed = sw.pressed;
    sw.pressed = things.some((b) => overlaps(b, sw));
    if (sw.delay > 0) {
      if (sw.pressed && !wasPressed && sw.countdown === 0 && !sw.latched) sw.countdown = Math.round(sw.delay * FPS);
      if (sw.countdown > 0 && --sw.countdown === 0) sw.latched = true;
      sw.on = sw.latched;
    } else if (sw.timer > 0) {
      if (sw.pressed) sw.rest = Math.round(sw.timer * FPS);
      else if (sw.rest > 0) sw.rest--;
      sw.on = sw.pressed || sw.rest > 0;
    } else {
      sw.on = sw.pressed;
    }
  }
  for (const g of world.gates) {
    const mine = world.switches.filter((sw) => sw.target === g.id);
    const opening = mine.length > 0 && (g.needAll ? mine.every((sw) => sw.on) : mine.some((sw) => sw.on));
    if (opening) {
      g.open = Math.min(1, g.open + GATE_SPEED / g.h);
      continue;
    }
    // fecha sem esmagar: não cresce sobre um corpo
    const next = { ...g, open: Math.max(0, g.open - GATE_SPEED / g.h) };
    if (!things.some((b) => overlaps(b, gateRect(next)))) g.open = next.open;
  }
  // blocos que piscam: só reaparecem se o espaço estiver livre (BlinkBlockComponent.func_default)
  for (const b of world.blinks) {
    if (--b.timer > 0) continue;
    if (b.visible) {
      b.visible = false;
      b.timer = Math.round(b.off * FPS);
    } else if (!things.some((o) => overlaps(o, b))) {
      b.visible = true;
      b.timer = Math.round(b.on * FPS);
    } else {
      b.timer = 0;
    }
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
