import { VIEW_H, VIEW_W } from "../engine/constants";
import { canvas, hash, px } from "./pixel";

/** Pôr do sol em três camadas: céu fixo, mesas e cidade com paralaxe. */
type Layers = { sky: HTMLCanvasElement; mesas: HTMLCanvasElement; town: HTMLCanvasElement };
let layers: Layers | null = null;

const SKY = ["#2b1846", "#46205a", "#6b2a63", "#963663", "#c2475a", "#e2654a", "#f48c45", "#fbb453", "#fdd27a"];
const BAND = 15;

function sky() {
  const [c, g] = canvas(VIEW_W, VIEW_H);
  SKY.forEach((col, i) => {
    px(g, 0, i * BAND, VIEW_W, BAND, col);
    const next = SKY[i + 1];
    // transição pontilhada entre faixas
    if (next) {
      for (let y = 0; y < 4; y++) {
        for (let x = y % 2; x < VIEW_W; x += 2) if (y >= 2 || x % 4 < 2) px(g, x, i * BAND + BAND - 4 + y, 1, 1, next);
      }
    }
  });
  px(g, 0, SKY.length * BAND, VIEW_W, VIEW_H, SKY[SKY.length - 1]);
  for (let i = 0; i < 26; i++) {
    px(g, Math.floor(hash(i, 1) * VIEW_W), Math.floor(hash(i, 2) * 34), 1, 1, hash(i, 3) > 0.5 ? "#f7e8ff" : "#b99ad8");
  }
  // sol com cortes horizontais na metade de baixo
  const sx = 214, sy = 104, r = 40;
  for (let y = -r; y <= r; y++) {
    if (y > 6 && (y - 6) % 7 < Math.min(4, 1 + Math.floor((y - 6) / 9))) continue;
    const w = Math.floor(Math.sqrt(r * r - y * y));
    px(g, sx - w, sy + y, w * 2, 1, y < -12 ? "#ffe9a3" : y < 10 ? "#ffd06a" : "#ffad4d");
  }
  return c;
}

function poly(g: CanvasRenderingContext2D, pts: number[]) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fill();
}

/** Camadas com paralaxe se repetem a cada VIEW_W px; as bordas fecham na mesma altura. */
function mesas() {
  const [c, g] = canvas(VIEW_W, VIEW_H);
  g.fillStyle = "#a8434c";
  poly(g, [0, 180, 0, 96, 10, 92, 40, 92, 48, 102, 70, 104, 76, 124, 76, 180]);
  poly(g, [96, 180, 104, 88, 112, 84, 146, 84, 152, 94, 160, 124, 160, 180]);
  poly(g, [250, 180, 258, 98, 268, 95, 300, 95, 306, 104, 320, 106, 320, 180]);
  px(g, 0, 124, VIEW_W, 56, "#a8434c");
  g.fillStyle = "#8e3444";
  poly(g, [60, 180, 66, 108, 92, 106, 100, 126, 100, 180]);
  poly(g, [180, 180, 186, 112, 204, 110, 214, 126, 214, 180]);
  px(g, 0, 126, VIEW_W, 54, "#8e3444");
  for (const [x, y, w] of [[10, 92, 30], [112, 84, 34], [268, 95, 32], [66, 108, 26]]) px(g, x, y, w, 1, "#d8705a");
  return c;
}

function town() {
  const [c, g] = canvas(VIEW_W, VIEW_H);
  const S = "#4a1f37";
  px(g, 0, 132, VIEW_W, 48, S);
  const building = (x: number, w: number, h: number, sign: boolean, seed: number) => {
    px(g, x, 148 - h, w, h, S);
    if (sign) {
      px(g, x - 1, 148 - h - 6, w + 2, 6, S);
      px(g, x + w / 2 - 3, 148 - h - 9, 6, 3, S);
    }
    for (let wx = x + 3, i = 0; wx < x + w - 3; wx += 7, i++) if (hash(seed, i) > 0.35) px(g, wx, 148 - h + 6, 3, 4, "#f2a53b");
  };
  building(4, 30, 34, true, 1);
  building(38, 22, 26, false, 2);
  building(64, 34, 40, true, 3);
  // caixa d'água
  px(g, 110, 102, 18, 12, S);
  px(g, 108, 100, 22, 3, S);
  px(g, 112, 114, 2, 34, S);
  px(g, 124, 114, 2, 34, S);
  px(g, 113, 124, 12, 1, S);
  building(134, 26, 30, true, 4);
  // moinho
  px(g, 176, 100, 2, 48, S);
  px(g, 171, 105, 12, 2, S);
  px(g, 176, 95, 2, 12, S);
  for (const [x, y] of [[172, 101], [180, 107], [180, 101], [172, 107]]) px(g, x, y, 2, 2, S);
  building(250, 28, 32, true, 5);
  building(282, 38, 24, false, 6);
  // urubus
  for (const [x, y] of [[150, 52], [162, 46], [92, 60]]) {
    px(g, x, y, 2, 1, "#3a1530");
    px(g, x + 2, y + 1, 2, 1, "#3a1530");
    px(g, x + 4, y, 2, 1, "#3a1530");
  }
  return c;
}

function tiled(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, offset: number) {
  const x = -(((offset % VIEW_W) + VIEW_W) % VIEW_W);
  ctx.drawImage(img, x, 0);
  ctx.drawImage(img, x + VIEW_W, 0);
}

/** Desenha o fundo em coordenadas de tela, antes da translação da câmera. */
export function drawBackground(ctx: CanvasRenderingContext2D, cam: number) {
  layers ??= { sky: sky(), mesas: mesas(), town: town() };
  ctx.drawImage(layers.sky, 0, 0);
  tiled(ctx, layers.mesas, Math.round(cam * 0.1));
  tiled(ctx, layers.town, Math.round(cam * 0.3));
}
