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
  for (const b of world.blinks) {
    if (b.visible) {
      ctx.fillStyle = "#7c3aed";
      ctx.fillRect(b.x, b.y, b.w, b.h);
    } else {
      ctx.strokeStyle = "#a78bfa";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      ctx.setLineDash([]);
    }
  }
  for (const sw of world.switches) {
    ctx.fillStyle = sw.on ? "#16a34a" : sw.delay > 0 ? "#2563eb" : sw.timer > 0 ? "#d97706" : "#dc2626";
    const down = sw.pressed || sw.on;
    ctx.fillRect(sw.x + 2, sw.y + (down ? 2 : 0), sw.w - 4, sw.h - (down ? 2 : 0));
    if (sw.timer > 0 && sw.rest > 0 && !sw.pressed) {
      // barra do tempo restante
      ctx.fillStyle = "#d97706";
      ctx.fillRect(sw.x, sw.y - 4, (sw.w * sw.rest) / (sw.timer * 60), 2);
    }
    if (sw.delay > 0 && sw.countdown > 0) {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sw.x + sw.w / 2, sw.y - 6, 4, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * (1 - sw.countdown / (sw.delay * 60)));
      ctx.stroke();
    }
  }
  // vento: faixas que andam na direção do sopro (só quando ligado)
  for (const wd of world.level.winds) {
    const on = wd.target === null || world.switches.some((sw) => sw.target === wd.target && sw.on);
    ctx.fillStyle = on ? "rgba(56, 189, 248, 0.12)" : "rgba(148, 163, 184, 0.08)";
    ctx.fillRect(wd.x, wd.y, wd.w, wd.h);
    if (!on) continue;
    ctx.strokeStyle = "rgba(14, 165, 233, 0.45)";
    ctx.lineWidth = 1;
    const t = world.frame;
    for (let i = 0; i < (wd.w * wd.h) / 160; i++) {
      const seed = (i * 97) % 89;
      const len = 6;
      const x = wd.x + ((seed * 13 + t * wd.fx * 1.5) % wd.w + wd.w) % wd.w;
      const y = wd.y + ((seed * 7 + t * wd.fy * 1.5) % wd.h + wd.h) % wd.h;
      const dx = wd.fx === 0 ? 0 : Math.sign(wd.fx) * len;
      const dy = wd.fy === 0 ? 0 : Math.sign(wd.fy) * len;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx, y + dy);
      ctx.stroke();
    }
  }
  // trampolins: base, mola e plataforma (apagados quando o botão está desligado)
  for (const sp of world.level.springs) {
    const on = sp.target === null || world.switches.some((sw) => sw.target === sp.target && sw.on);
    ctx.fillStyle = "#3f3a36";
    ctx.fillRect(sp.x, sp.y + sp.h - 4, sp.w, 4);
    ctx.strokeStyle = on ? "#16a34a" : "#a8a29e";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = sp.x + 3; x < sp.x + sp.w - 3; x += 6) {
      ctx.moveTo(x, sp.y + sp.h - 4);
      ctx.lineTo(x + 3, sp.y + 4);
      ctx.lineTo(x + 6, sp.y + sp.h - 4);
    }
    ctx.stroke();
    ctx.fillStyle = on ? "#22c55e" : "#d6d3d1";
    ctx.fillRect(sp.x, sp.y, sp.w, 3);
  }
  // portais: anel na entrada, ponto no destino e linha tracejada entre eles
  for (const wp of world.level.warps) {
    const cx = wp.x + wp.w / 2;
    const cy = wp.y + wp.h / 2;
    const tx = wp.to.x + TILE / 2;
    const ty = wp.to.y + TILE / 2;
    ctx.strokeStyle = wp.all ? "rgba(217, 70, 239, 0.35)" : "rgba(124, 58, 237, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = wp.all ? "#d946ef" : "#7c3aed";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, wp.w / 2 - 1, wp.h / 2 - 1, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(tx, ty, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const [i, r] of world.rails.entries()) {
    const def = world.level.rails[i];
    // guia do caminho (pela borda superior central)
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    def.path.forEach((pt, j) => (j === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, pt.x + r.w / 2, pt.y + r.h / 2));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (def.need !== 0) {
      const need = def.need < 0 ? world.players.length + def.need : Math.min(def.need, world.players.length);
      ctx.fillStyle = "#eff6ff";
      ctx.font = "bold 7px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${Math.min(r.weight, need)}/${need}`, r.x + r.w / 2, r.y + r.h / 2 + 0.5);
    }
  }
  for (const [i, p] of world.pushers.entries()) {
    const dir = Math.sign(world.level.pushers[i].dx);
    ctx.fillStyle = "#57534e";
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = "#fbbf24";
    const cy = p.y + p.h / 2;
    const tip = dir > 0 ? p.x + p.w : p.x;
    ctx.beginPath();
    ctx.moveTo(tip + dir * 4, cy);
    ctx.lineTo(tip, cy - 3);
    ctx.lineTo(tip, cy + 3);
    ctx.fill();
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
  for (const f of world.falls) {
    const shake = f.touched && f.timer > 0 ? (world.frame % 4 < 2 ? 1 : -1) : 0;
    ctx.fillStyle = "#a16207";
    ctx.fillRect(f.x + shake, f.y, f.w, f.h);
    ctx.strokeStyle = "#713f12";
    ctx.lineWidth = 1;
    for (let x = f.x; x < f.x + f.w; x += TILE) ctx.strokeRect(x + 0.5 + shake, f.y + 0.5, TILE - 1, f.h - 1);
  }
  // haste dos esmagadores (espinhos que se movem na vertical apontando para baixo)
  ctx.fillStyle = "#78716c";
  for (const t of world.thorns) {
    if (t.dir === "down" && t.dy > 0) ctx.fillRect(t.x + t.w / 2 - 1, 0, 2, t.y);
  }
  ctx.fillStyle = "#dc2626";
  for (const t of world.thorns) {
    for (let cx = 0; cx < t.w; cx += TILE) {
      for (let cy = 0; cy < t.h; cy += TILE) drawSpike(ctx, t.x + cx, t.y + cy, t.dir);
    }
  }
  if (world.level.rope !== null) drawRope(ctx, world);
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
  if (p.gravDir < 0) {
    // de ponta-cabeça: espelha verticalmente em torno do centro
    ctx.save();
    ctx.translate(0, 2 * y + p.h);
    ctx.scale(1, -1);
  }
  ctx.fillStyle = PLAYER_COLORS[p.index % PLAYER_COLORS.length];
  ctx.beginPath();
  ctx.roundRect(x, y, p.w, p.h, 3);
  ctx.fill();
  // olhos para o lado em que anda
  ctx.fillStyle = "#1c1917";
  const eye = p.facing > 0 ? x + p.w - 6 : x + 3;
  ctx.fillRect(eye, y + 4, 2, 3);
  ctx.fillRect(eye + 3, y + 4, 2, 3);
  if (p.gravDir < 0) ctx.restore();
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
  if (b.color !== null) {
    // caixa colorida: cor do dono, sem número (só ele empurra)
    ctx.fillStyle = PLAYER_COLORS[b.color % PLAYER_COLORS.length];
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x, y, b.w, b.h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, b.w - 1, b.h - 1);
    ctx.fillStyle = "#1c1917";
    ctx.fillRect(x + b.w / 2 - 1, y + 3, 2, b.h - 6);
    return;
  }
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

function drawRope(ctx: CanvasRenderingContext2D, world: World) {
  const chain = world.players.filter((p) => !p.cleared);
  const length = world.level.rope ?? 0;
  ctx.lineWidth = 1.5;
  for (let i = 0; i + 1 < chain.length; i++) {
    const a = chain[i];
    const b = chain[i + 1];
    const ax = a.x + a.w / 2;
    const ay = a.y + a.h / 2;
    const bx = b.x + b.w / 2;
    const by = b.y + b.h / 2;
    const d = Math.hypot(bx - ax, by - ay);
    // folgada: curva para baixo; esticada: reta e mais escura
    const sag = Math.max(0, length - d) * 0.5;
    ctx.strokeStyle = d >= length ? "#44403c" : "#78716c";
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + sag, bx, by);
    ctx.stroke();
  }
}

/** Espinho ocupando a metade da célula do lado da base (como a área mortal). */
function drawSpike(ctx: CanvasRenderingContext2D, x: number, y: number, dir: "up" | "down" | "left" | "right") {
  const h = TILE / 2 + 2;
  const pts: [number, number][] =
    dir === "up"
      ? [[x + 1, y + TILE], [x + TILE / 2, y + TILE - h], [x + TILE - 1, y + TILE]]
      : dir === "down"
        ? [[x + 1, y], [x + TILE / 2, y + h], [x + TILE - 1, y]]
        : dir === "right"
          ? [[x, y + 1], [x + h, y + TILE / 2], [x, y + TILE - 1]]
          : [[x + TILE, y + 1], [x + TILE - h, y + TILE / 2], [x + TILE, y + TILE - 1]];
  ctx.beginPath();
  ctx.moveTo(...pts[0]);
  ctx.lineTo(...pts[1]);
  ctx.lineTo(...pts[2]);
  ctx.fill();
}
