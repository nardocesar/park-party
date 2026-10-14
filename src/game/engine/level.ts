import { DOOR_H, DOOR_W, FALL_WAIT, KEY_SIZE, PLAYER_SIZE, RAIL_SPEED, SWITCH_H, TILE } from "./constants";

/**
 * Fase em ASCII:
 *   '#' bloco sólido   '.' vazio
 *   '1'..'8' spawn dos jogadores   'K' chave   'D' porta
 */
export type BoxDef = { col: number; row: number; w: number; h: number; need: number };
/**
 * Botão de pressão: liga enquanto algo está em cima e abre o portão `target`.
 * `timer`: continua ligado N segundos depois de solto (SwitchComponent.m_TimerAddSecond).
 * `delay`: o efeito chega N segundos depois de pisado e fica (DelaySwitchComponent).
 */
export type SwitchDef = { col: number; row: number; target: string; timer?: number; delay?: number; ceiling?: boolean };
/** Portão: bloco sólido que encolhe para cima quando aberto. `needAll`: exige todos os seus botões. */
export type GateDef = { id: string; col: number; row: number; w: number; h: number; needAll?: boolean };
/** Bloco que pisca (BlinkBlockComponent): `on`/`off` em segundos; `phase` adianta o ciclo. */
export type BlinkDef = { col: number; row: number; w: number; h: number; on: number; off: number; startOn?: boolean; phase?: number };
/** Chão que cai (FallBoxComponent): cai `wait` s depois de pisado (padrão FALL_WAIT). */
export type FallDef = { col: number; row: number; w: number; h: number; wait?: number };
export type ThornDir = "up" | "down" | "left" | "right";
/**
 * Espinho (ThornComponent): mata ao toque na área da ponta (`dir`, padrão "up");
 * com `dx`/`dy` (tiles) vai e volta a `speed` px/frame.
 */
export type ThornDef = {
  col: number;
  row: number;
  w: number;
  h: number;
  dir?: ThornDir;
  dx?: number;
  dy?: number;
  speed?: number;
};
/**
 * Plataforma em trilho (LinePathLift / UpDownLift): percorre `path` (tiles, canto superior esquerdo).
 * `need` > 0: anda quando há esse peso em cima e volta quando sai (`returns`); `need` < 0 é relativo a
 * todos os jogadores (−1 = todos menos um); `need` = 0: vai e volta sozinha, esperando `wait` s nas pontas.
 */
export type RailDef = {
  path: [number, number][];
  w: number;
  need: number;
  speed?: number;
  returns?: boolean;
  wait?: number;
};
/** Parede que empurra (MoveWallComponent): espera, avança `dx` tiles, espera e volta. `w` em tiles (padrão: fina). */
export type PusherDef = { col: number; row: number; h: number; dx: number; w?: number };
/**
 * Vento (WindComponent): quem está na área recebe a velocidade (`fx`, `fy`) em px/frame; `fy` < 0 é
 * corrente para cima (sobe a |fy|). Com `target`, só sopra quando algum botão desse alvo está ligado.
 */
export type WindDef = { col: number; row: number; w: number; h: number; fx?: number; fy?: number; target?: string };
/**
 * Trampolim (JumpStandComponent): bloco de 1 tile que lança quem pisa com (`vx`, `vy`) px/frame.
 * Com `target`, só lança quando algum botão desse alvo está ligado.
 */
export type SpringDef = { col: number; row: number; w: number; vy: number; vx?: number; target?: string };
/** Portal (WarpComponent): quem toca vai para `to` (tile); `all` leva todos os jogadores. */
export type WarpDef = { col: number; row: number; w: number; h: number; to: [number, number]; all?: boolean };
/** Elevador com peso: desce `dy` tiles (negativo sobe) quando `need` jogadores estão em cima. */
export type LiftDef = { col: number; row: number; w: number; dy: number; need: number };
export type LevelDef = {
  name: string;
  map: string[];
  boxes?: BoxDef[];
  switches?: SwitchDef[];
  gates?: GateDef[];
  lifts?: LiftDef[];
  blinks?: BlinkDef[];
  falls?: FallDef[];
  thorns?: ThornDef[];
  rails?: RailDef[];
  pushers?: PusherDef[];
  winds?: WindDef[];
  springs?: SpringDef[];
  warps?: WarpDef[];
  /** Habilita inverter a gravidade com "baixo" (PlayerComponent.SetEnableReversalGravity). */
  flipGravity?: boolean;
  /** Corda que liga os jogadores em sequência (1–2–3…); comprimento em tiles. */
  rope?: { length: number };
};

export type Vec = { x: number; y: number };

export type Level = {
  name: string;
  cols: number;
  rows: number;
  width: number;
  height: number;
  solid: boolean[][];
  spawns: Vec[];
  key: Vec;
  door: Vec;
  /** Caixas em px; `need` é quantos jogadores precisam empurrar juntos. */
  boxes: { x: number; y: number; w: number; h: number; need: number }[];
  switches: { x: number; y: number; w: number; h: number; target: string; timer: number; delay: number }[];
  gates: { id: string; x: number; y: number; w: number; h: number; needAll: boolean }[];
  blinks: { x: number; y: number; w: number; h: number; on: number; off: number; startOn: boolean; phase: number }[];
  falls: { x: number; y: number; w: number; h: number; wait: number }[];
  thorns: { x: number; y: number; w: number; h: number; dir: ThornDir; dx: number; dy: number; speed: number }[];
  rails: { path: { x: number; y: number }[]; w: number; need: number; speed: number; returns: boolean; wait: number }[];
  pushers: { x: number; y: number; w: number | null; h: number; dx: number }[];
  winds: { x: number; y: number; w: number; h: number; fx: number; fy: number; target: string | null }[];
  springs: { x: number; y: number; w: number; h: number; vx: number; vy: number; target: string | null }[];
  warps: { x: number; y: number; w: number; h: number; to: { x: number; y: number }; all: boolean }[];
  flipGravity: boolean;
  lifts: { x: number; y: number; w: number; h: number; travel: number; need: number }[];
  /** Comprimento da corda em px, ou null sem corda. */
  rope: number | null;
};

export function parseLevel(def: LevelDef): Level {
  const rows = def.map.length;
  const cols = Math.max(...def.map.map((r) => r.length));
  const solid: boolean[][] = [];
  const spawnByDigit: [number, Vec][] = [];
  let key: Vec | null = null;
  let door: Vec | null = null;

  def.map.forEach((line, row) => {
    solid.push([]);
    for (let col = 0; col < cols; col++) {
      const ch = line[col] ?? ".";
      solid[row].push(ch === "#");
      const bottom = (row + 1) * TILE;
      if (ch >= "1" && ch <= "8") {
        spawnByDigit.push([Number(ch), { x: col * TILE + (TILE - PLAYER_SIZE) / 2, y: bottom - PLAYER_SIZE }]);
      } else if (ch === "K") {
        key = { x: col * TILE + (TILE - KEY_SIZE) / 2, y: row * TILE + (TILE - KEY_SIZE) / 2 };
      } else if (ch === "D") {
        door = { x: col * TILE + (TILE - DOOR_W) / 2, y: bottom - DOOR_H };
      }
    }
  });

  if (!key || !door || spawnByDigit.length === 0) {
    // fases de teste sem chave/porta ganham posições fora do mapa
    key ??= { x: -1000, y: -1000 };
    door ??= { x: -2000, y: -2000 };
    if (spawnByDigit.length === 0) throw new Error(`Fase ${def.name} sem spawn`);
  }

  return {
    name: def.name,
    cols,
    rows,
    width: cols * TILE,
    height: rows * TILE,
    solid,
    spawns: spawnByDigit.sort((a, b) => a[0] - b[0]).map(([, v]) => v),
    key,
    door,
    boxes: (def.boxes ?? []).map((b) => ({ x: b.col * TILE, y: b.row * TILE, w: b.w * TILE, h: b.h * TILE, need: b.need })),
    switches: (def.switches ?? []).map((s) => ({
      x: s.col * TILE, y: s.ceiling ? s.row * TILE : (s.row + 1) * TILE - SWITCH_H, w: TILE, h: SWITCH_H, target: s.target,
      timer: s.timer ?? 0, delay: s.delay ?? 0,
    })),
    gates: (def.gates ?? []).map((g) => ({
      id: g.id, x: g.col * TILE, y: g.row * TILE, w: g.w * TILE, h: g.h * TILE, needAll: g.needAll ?? false,
    })),
    falls: (def.falls ?? []).map((f) => ({
      x: f.col * TILE, y: f.row * TILE, w: f.w * TILE, h: f.h * TILE, wait: f.wait ?? FALL_WAIT,
    })),
    thorns: (def.thorns ?? []).map((t) => ({
      x: t.col * TILE, y: t.row * TILE, w: t.w * TILE, h: t.h * TILE, dir: t.dir ?? "up",
      dx: (t.dx ?? 0) * TILE, dy: (t.dy ?? 0) * TILE, speed: t.speed ?? 0,
    })),
    rails: (def.rails ?? []).map((r) => ({
      path: r.path.map(([c, row]) => ({ x: c * TILE, y: row * TILE })),
      w: r.w * TILE, need: r.need, speed: r.speed ?? RAIL_SPEED, returns: r.returns ?? true, wait: r.wait ?? 0,
    })),
    pushers: (def.pushers ?? []).map((p) => ({
      x: p.col * TILE, y: p.row * TILE, w: p.w ? p.w * TILE : null, h: p.h * TILE, dx: p.dx * TILE,
    })),
    winds: (def.winds ?? []).map((wd) => ({
      x: wd.col * TILE, y: wd.row * TILE, w: wd.w * TILE, h: wd.h * TILE, fx: wd.fx ?? 0, fy: wd.fy ?? 0, target: wd.target ?? null,
    })),
    springs: (def.springs ?? []).map((sp) => ({
      x: sp.col * TILE, y: sp.row * TILE, w: sp.w * TILE, h: TILE, vx: sp.vx ?? 0, vy: sp.vy, target: sp.target ?? null,
    })),
    warps: (def.warps ?? []).map((wp) => ({
      x: wp.col * TILE, y: wp.row * TILE, w: wp.w * TILE, h: wp.h * TILE,
      to: { x: wp.to[0] * TILE, y: wp.to[1] * TILE }, all: wp.all ?? false,
    })),
    flipGravity: def.flipGravity ?? false,
    blinks: (def.blinks ?? []).map((b) => ({
      x: b.col * TILE, y: b.row * TILE, w: b.w * TILE, h: b.h * TILE,
      on: b.on, off: b.off, startOn: b.startOn ?? true, phase: b.phase ?? 0,
    })),
    rope: def.rope ? def.rope.length * TILE : null,
    lifts: (def.lifts ?? []).map((l) => ({
      x: l.col * TILE, y: l.row * TILE, w: l.w * TILE, h: TILE, travel: l.dy * TILE, need: l.need,
    })),
  };
}

export function isSolidAt(level: Level, col: number, row: number): boolean {
  return level.solid[row]?.[col] ?? false;
}
