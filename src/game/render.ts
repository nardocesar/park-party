import { TILE, VIEW_H, VIEW_W } from "./engine/constants";
import type { Player, World } from "./engine/world";

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

  drawDoor(ctx, world);
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
