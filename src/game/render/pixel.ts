import type { Sprite } from "./sprites";

/** Ruído determinístico em [0, 1) por posição: o mesmo tile sempre ganha o mesmo detalhe. */
export function hash(a: number, b: number, salt = 0): number {
  let h = Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(salt + 1, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas 2D indisponível");
  return [c, ctx];
}

export function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

const cache = new WeakMap<Sprite, HTMLCanvasElement>();

/** Sprite rasterizado uma vez; desenhe com `drawImage` (sem suavização, fica nítido). */
export function spriteImage(s: Sprite): HTMLCanvasElement {
  let img = cache.get(s);
  if (!img) {
    const [c, ctx] = canvas(s.rows[0].length, s.rows.length);
    s.rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== "." && px(ctx, x, y, 1, 1, s.pal[ch])));
    cache.set(s, c);
    img = c;
  }
  return img;
}

// fonte 3×5 para letreiros
const FONT: Record<string, string> = {
  S: "111100111001111",
  A: "010101111101101",
  L: "100100100100111",
  O: "111101101101111",
  N: "101111111111101",
};

export function pixelText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  [...text].forEach((ch, i) => {
    const bits = FONT[ch];
    for (let k = 0; k < 15; k++) if (bits?.[k] === "1") px(ctx, x + i * 4 + (k % 3), y + Math.floor(k / 3), 1, 1, color);
  });
}
