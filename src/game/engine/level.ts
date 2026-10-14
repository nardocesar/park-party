import { DOOR_H, DOOR_W, KEY_SIZE, PLAYER_SIZE, SWITCH_H, TILE } from "./constants";

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
export type SwitchDef = { col: number; row: number; target: string; timer?: number; delay?: number };
/** Portão: bloco sólido que encolhe para cima quando aberto. `needAll`: exige todos os seus botões. */
export type GateDef = { id: string; col: number; row: number; w: number; h: number; needAll?: boolean };
/** Bloco que pisca (BlinkBlockComponent): `on`/`off` em segundos; `phase` adianta o ciclo. */
export type BlinkDef = { col: number; row: number; w: number; h: number; on: number; off: number; startOn?: boolean; phase?: number };
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
      x: s.col * TILE, y: (s.row + 1) * TILE - SWITCH_H, w: TILE, h: SWITCH_H, target: s.target,
      timer: s.timer ?? 0, delay: s.delay ?? 0,
    })),
    gates: (def.gates ?? []).map((g) => ({
      id: g.id, x: g.col * TILE, y: g.row * TILE, w: g.w * TILE, h: g.h * TILE, needAll: g.needAll ?? false,
    })),
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
