import { VIEW_H, VIEW_W } from "../engine/constants";
import { lightLevel, type World } from "../engine/world";
import { drawBackground } from "./background";
import * as e from "./entities";
import { canvas } from "./pixel";
import { tileLayer } from "./tiles";

export { PLAYER_COLORS } from "./sprites";

export function render(ctx: CanvasRenderingContext2D, world: World) {
  const { level } = world;
  const cam = Math.round(world.cameraX);
  ctx.save();
  drawBackground(ctx, cam);
  // a fase tem 176 px de altura; alinha o chão à base da tela
  ctx.translate(-cam, VIEW_H - level.height);
  ctx.drawImage(tileLayer(level), 0, 0);

  e.drawGates(ctx, world);
  e.drawBlinks(ctx, world);
  e.drawSwitches(ctx, world);
  e.drawWinds(ctx, world);
  e.drawSprings(ctx, world);
  e.drawWarps(ctx, world);
  e.drawRails(ctx, world);
  e.drawPushers(ctx, world);
  e.drawLifts(ctx, world);
  e.drawDoor(ctx, world);
  for (const b of world.boxes) e.drawBox(ctx, b, Math.min(b.need, world.players.length));
  e.drawFalls(ctx, world);
  e.drawThorns(ctx, world);
  if (level.rope !== null) e.drawRope(ctx, world);
  const active = world.players.filter((p) => !p.cleared);
  // marcadores antes dos jogadores: numa torre, quem está em cima cobre o marcador de baixo
  for (const p of active) e.drawMarker(ctx, p);
  for (const p of active) e.drawPlayer(ctx, p, world.frame);
  if (!world.key.used) e.drawKey(ctx, world.key.x, world.key.y, world.frame);
  drawBlackout(ctx, world, cam);
  ctx.restore();
}

/** Apagão: noite fechada, menos o halo de lampião em volta de cada jogador. */
let darkLayer: [HTMLCanvasElement, CanvasRenderingContext2D] | null = null;
function drawBlackout(ctx: CanvasRenderingContext2D, world: World, cam: number) {
  const dark = 1 - lightLevel(world);
  if (dark <= 0) return;
  // camada própria: pinta o escuro e recorta os halos (destination-out une os buracos corretamente)
  darkLayer ??= canvas(VIEW_W, VIEW_H);
  const [layer, d] = darkLayer;
  const offsetY = VIEW_H - world.level.height;
  d.globalCompositeOperation = "source-over";
  d.clearRect(0, 0, VIEW_W, VIEW_H);
  d.fillStyle = `rgba(14, 10, 30, ${0.96 * dark})`;
  d.fillRect(0, 0, VIEW_W, VIEW_H);
  d.globalCompositeOperation = "destination-out";
  const halos = world.players.filter((p) => !p.cleared).map((p) => ({
    x: p.x + p.w / 2 - cam,
    y: p.y + p.h / 2 + offsetY,
    r: 16 * p.scale,
  }));
  for (const { x, y, r } of halos) {
    const grad = d.createRadialGradient(x, y, r * 0.6, x, y, r * 1.15);
    grad.addColorStop(0, "rgba(0,0,0,1)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    d.fillStyle = grad;
    d.beginPath();
    d.arc(x, y, r * 1.15, 0, Math.PI * 2);
    d.fill();
  }
  // luz quente do lampião
  d.globalCompositeOperation = "source-over";
  for (const { x, y, r } of halos) {
    const glow = d.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, `rgba(255, 170, 80, ${0.18 * dark})`);
    glow.addColorStop(1, "rgba(255, 170, 80, 0)");
    d.fillStyle = glow;
    d.beginPath();
    d.arc(x, y, r, 0, Math.PI * 2);
    d.fill();
  }
  ctx.drawImage(layer, cam, -offsetY);
}
