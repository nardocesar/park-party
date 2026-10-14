import { TILE, VIEW_H, VIEW_W } from "./engine/constants";
import { gateRect, type Box, type Player, type World } from "./engine/world";

export const PLAYER_COLORS = ["#f97316", "#38bdf8", "#f472b6", "#4ade80"];

const BG = "#f4efe4";
const BLOCK = "#3f3a36";
const DOOR = "#7c5a3a";
const KEY = "#facc15";

export function render(ctx: CanvasRenderingContext2D, world: World) {
  const { level } = world;
  const cam = Math.round(world.cameraX);
  ctx.save();
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // a fase tem 176 px de altura; alinha o chão à base da tela
  ctx.translate(-cam, VIEW_H - level.height);

  const c0 = Math.floor(cam / TILE);
  const c1 = Math.ceil((cam + VIEW_W) / TILE);
  ctx.fillStyle = BLOCK;
  for (let r = 0; r < level.rows; r++) {
    for (let c = c0; c <= c1; c++) if (level.solid[r]?.[c]) ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
  }

  for (const g of world.gates) {
    const r = gateRect(g);
    ctx.fillStyle = "#57534e";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = "#a8a29e";
    for (let y = r.y + 3; y < r.y + r.h - 1; y += 6) ctx.fillRect(r.x + 3, y, r.w - 6, 2);
  }
  for (const sw of world.switches) {
    ctx.fillStyle = sw.on ? "#16a34a" : "#dc2626";
    ctx.fillRect(sw.x + 2, sw.y + (sw.on ? 2 : 0), sw.w - 4, sw.h - (sw.on ? 2 : 0));
  }
  for (const l of world.lifts) {
    const need = Math.min(l.need, world.players.length);
    ctx.fillStyle = "#0e7490";
    ctx.fillRect(l.x, Math.round(l.y), l.w, l.h);
    ctx.fillStyle = "#ecfeff";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${Math.min(l.weight, need)}/${need}`, l.x + l.w / 2, Math.round(l.y) + l.h / 2 + 1);
  }
  drawDoor(ctx, world);
  for (const b of world.boxes) drawBox(ctx, b, Math.min(b.need, world.players.length));
  for (const p of world.players) if (!p.cleared) drawPlayer(ctx, p);
  if (!world.key.used) drawKey(ctx, world.key.x, world.key.y);
  ctx.restore();
}

function drawDoor(ctx: CanvasRenderingContext2D, { door }: World) {
  ctx.fillStyle = DOOR;
  ctx.fillRect(door.x, door.y, door.w, door.h);
  ctx.fillStyle = door.open ? "#1c1917" : "#a07a52";
  ctx.fillRect(door.x + 3, door.y + 3, door.w - 6, door.h - 3);
  if (!door.open) {
    ctx.fillStyle = KEY;
    ctx.fillRect(door.x + door.w / 2 - 1, door.y + door.h / 2, 2, 3);
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: Player) {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  ctx.fillStyle = PLAYER_COLORS[p.index % PLAYER_COLORS.length];
  ctx.beginPath();
  ctx.roundRect(x, y, p.w, p.h, 3);
  ctx.fill();
  // olhos para o lado em que anda
  ctx.fillStyle = "#1c1917";
  const eye = p.facing > 0 ? x + p.w - 6 : x + 3;
  ctx.fillRect(eye, y + 4, 2, 3);
  ctx.fillRect(eye + 3, y + 4, 2, 3);
}

function drawKey(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = KEY;
  ctx.beginPath();
  ctx.arc(x + 3, y + 5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x + 5, y + 4, 5, 2);
  ctx.fillRect(x + 8, y + 6, 2, 2);
}

function drawBox(ctx: CanvasRenderingContext2D, b: Box, need: number) {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  ctx.fillStyle = "#b08a5a";
  ctx.fillRect(x, y, b.w, b.h);
  ctx.strokeStyle = "#6b4f2e";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, b.w - 2, b.h - 2);
  // quantos ainda faltam para a caixa andar
  const left = Math.max(0, need - b.pushers);
  ctx.fillStyle = left === 0 ? "#166534" : "#1c1917";
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(left === 0 ? need : left), x + b.w / 2, y + b.h / 2 + 1);
}
