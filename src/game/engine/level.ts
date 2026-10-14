import { DOOR_H, DOOR_W, KEY_SIZE, PLAYER_SIZE, TILE } from "./constants";

/**
 * Fase em ASCII:
 *   '#' bloco sólido   '.' vazio
 *   '1'..'8' spawn dos jogadores   'K' chave   'D' porta
 */
export type BoxDef = { col: number; row: number; w: number; h: number; need: number };
export type LevelDef = { name: string; map: string[]; boxes?: BoxDef[] };

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
  };
}

export function isSolidAt(level: Level, col: number, row: number): boolean {
  return level.solid[row]?.[col] ?? false;
}
