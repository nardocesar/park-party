import { TILE } from "../engine/constants";
import type { Level } from "../engine/level";
import { canvas, hash, px } from "./pixel";

/** O mapa é estático: desenhado uma vez por fase e reaproveitado a cada quadro. */
const cache = new WeakMap<Level, HTMLCanvasElement>();

export function tileLayer(level: Level): HTMLCanvasElement {
  let img = cache.get(level);
  if (!img) {
    img = build(level);
    cache.set(level, img);
  }
  return img;
}

function build(level: Level) {
  const [c, g] = canvas(level.width, level.height);
  // fora do mapa conta como sólido (bordas não ganham acabamento)
  const solid = (col: number, row: number) =>
    row < 0 || row >= level.rows || col < 0 || col >= level.cols || level.solid[row][col];

  // degrau isolado sobre o chão vira barril (e o chão embaixo continua com borda de areia)
  const barrelAt = (col: number, row: number) =>
    level.solid[row]?.[col] === true && !solid(col, row - 1) && !solid(col - 1, row) && !solid(col + 1, row) &&
    solid(col - 1, row + 1) && solid(col + 1, row + 1);

  for (let r = 0; r < level.rows; r++) {
    for (let col = 0; col < level.cols; col++) {
      if (!level.solid[r][col]) continue;
      const x = col * TILE;
      const y = r * TILE;
      const up = solid(col, r - 1);
      const down = solid(col, r + 1);
      const left = solid(col - 1, r);
      const right = solid(col + 1, r);

      if (!up && !down) {
        plank(g, x, y, col, r, !level.solid[r][col - 1], !level.solid[r][col + 1]);
      } else if (barrelAt(col, r)) {
        barrel(g, x, y);
      } else {
        const top = !up || barrelAt(col, r - 1);
        earth(g, x, y, col, r, { top, deep: !top && up && solid(col, r - 2) && !barrelAt(col, r - 2), ceiling: !down && up });
        if (!left) px(g, x, y, 1, TILE, "#5a2e14");
        if (!right) px(g, x + TILE - 1, y, 1, TILE, "#5a2e14");
      }
    }
  }
  return c;
}

function earth(
  g: CanvasRenderingContext2D, x: number, y: number, col: number, row: number,
  { top, deep, ceiling }: { top: boolean; deep: boolean; ceiling: boolean },
) {
  px(g, x, y, TILE, TILE, deep ? "#93532a" : "#a8612f");
  for (let i = 0; i < 6; i++) {
    px(g, x + Math.floor(hash(col, row, i) * 15), y + Math.floor(hash(col, row, i + 9) * 15), 2, 1, deep ? "#7c4220" : "#8c4c24");
  }
  if (deep) px(g, x, y + 7, TILE, 1, "#82461f");
  else px(g, x, y + 10, TILE, 1, "#93532a");
  if (top) {
    px(g, x, y, TILE, 3, "#e2a35c");
    px(g, x, y + 3, TILE, 1, "#c27a3e");
    for (let i = 0; i < 3; i++) {
      px(g, x + Math.floor(hash(col, row, 20 + i) * 14), y + 4 + Math.floor(hash(col, row, 30 + i) * 3), 2, 1, "#c98a4c");
    }
  }
  if (ceiling) {
    // rocha por baixo, com pontas
    px(g, x, y + TILE - 3, TILE, 3, "#6b3a1c");
    const tip = Math.floor(hash(col, row, 40) * 12);
    px(g, x + tip, y + TILE, 3, 1, "#6b3a1c");
    px(g, x + tip + 1, y + TILE, 1, 2, "#6b3a1c");
  }
}

function plank(g: CanvasRenderingContext2D, x: number, y: number, col: number, row: number, first: boolean, last: boolean) {
  px(g, x, y, TILE, TILE, "#8a5426");
  px(g, x, y, TILE, 2, "#c98b4a");
  px(g, x, y + 2, TILE, 1, "#a96c34");
  px(g, x, y + 7, TILE, 1, "#6b3d1a");
  px(g, x, y + 15, TILE, 1, "#4e2a10");
  for (let i = 0; i < 3; i++) {
    px(g, x + 2 + Math.floor(hash(col, row, i) * 11), y + 4 + Math.floor(hash(col, row, i + 5) * 9), 3, 1, "#764420");
  }
  for (const [dx, dy] of [[2, 4], [13, 4], [2, 11], [13, 11]]) px(g, x + dx, y + dy, 1, 1, "#3c2210");
  if (first) px(g, x, y, 1, TILE, "#4e2a10");
  if (last) px(g, x + TILE - 1, y, 1, TILE, "#4e2a10");
}

function barrel(g: CanvasRenderingContext2D, x: number, y: number) {
  px(g, x + 2, y, 12, TILE, "#9a5a28");
  px(g, x + 1, y + 2, 14, 12, "#9a5a28");
  px(g, x + 3, y + 1, 3, 14, "#b87436");
  px(g, x + 11, y + 1, 2, 14, "#7a4420");
  for (const hy of [3, 11]) {
    px(g, x + 1, y + hy, 14, 2, "#5c5f66");
    px(g, x + 2, y + hy, 12, 1, "#8a8e96");
  }
  px(g, x + 2, y, 12, 1, "#5a3214");
  px(g, x + 2, y + 15, 12, 1, "#3c2210");
}
