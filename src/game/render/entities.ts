import { PLAYER_SIZE, TILE } from "../engine/constants";
import type { ThornDir } from "../engine/level";
import { gateRect, type Box, type Player, type World } from "../engine/world";
import { hash, pixelText, px, spriteImage } from "./pixel";
import { CACTUS, COWBOYS, COWBOYS_WALK, KEY_SPRITE, PLAYER_COLORS } from "./sprites";

const OUTLINE = "#21130c";
const WOOD = "#8a5426";
const WOOD_DARK = "#5a3214";
const STEEL = "#9aa0a8";

const isOn = (world: World, target: string | null) =>
  target === null || world.switches.some((sw) => sw.target === target && sw.on);

function counter(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  ctx.fillStyle = "#ffe9a3";
  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

/** Cerca de madeira; só a parte ainda fechada (topo) é desenhada. */
export function drawGates(ctx: CanvasRenderingContext2D, world: World) {
  for (const gate of world.gates) {
    const r = gateRect(gate);
    if (r.h <= 0) continue;
    px(ctx, r.x, r.y, r.w, r.h, WOOD);
    for (let x = r.x + 3; x < r.x + r.w - 1; x += 4) px(ctx, x, r.y, 1, r.h, WOOD_DARK);
    for (let y = r.y + 3; y < r.y + r.h - 2; y += 10) px(ctx, r.x, y, r.w, 2, "#6b3d1a");
    px(ctx, r.x, r.y, r.w, 1, "#c98b4a");
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  }
}

/** Tábuas pintadas que aparecem e somem; apagadas ficam só tracejadas. */
export function drawBlinks(ctx: CanvasRenderingContext2D, world: World) {
  for (const b of world.blinks) {
    if (b.visible) {
      px(ctx, b.x, b.y, b.w, b.h, "#7a5aa0");
      px(ctx, b.x, b.y, b.w, 2, "#a88ad0");
      for (let y = b.y + 7; y < b.y + b.h; y += 8) px(ctx, b.x, y, b.w, 1, "#4e3670");
      for (let x = b.x; x < b.x + b.w; x += TILE) px(ctx, x, b.y, 1, b.h, "#4e3670");
    } else {
      ctx.strokeStyle = "#c4a8f0";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      ctx.setLineDash([]);
    }
  }
}

/** Placas de latão; a cor do botão é informação de jogo e continua a mesma. */
export function drawSwitches(ctx: CanvasRenderingContext2D, world: World) {
  for (const [i, sw] of world.switches.entries()) {
    const grow = world.level.switches[i].scale;
    if (grow !== 0) {
      // botão de escala: seta para cima (cresce) ou para baixo (encolhe)
      px(ctx, sw.x, sw.y + sw.h - 1, sw.w, 1, WOOD_DARK);
      ctx.fillStyle = grow > 0 ? "#0d9488" : "#9333ea";
      ctx.fillRect(sw.x + 1, sw.y, sw.w - 2, sw.h - 1);
      ctx.beginPath();
      const cx = sw.x + sw.w / 2;
      if (grow > 0) {
        ctx.moveTo(cx - 4, sw.y - 2);
        ctx.lineTo(cx, sw.y - 7);
        ctx.lineTo(cx + 4, sw.y - 2);
      } else {
        ctx.moveTo(cx - 4, sw.y - 7);
        ctx.lineTo(cx, sw.y - 2);
        ctx.lineTo(cx + 4, sw.y - 7);
      }
      ctx.fill();
      continue;
    }
    const color = sw.on ? "#16a34a" : sw.delay > 0 ? "#2563eb" : sw.timer > 0 ? "#d97706" : "#dc2626";
    const down = sw.pressed || sw.on ? 2 : 0;
    // base de latão e placa colorida por cima
    px(ctx, sw.x, sw.y + sw.h - 1, sw.w, 1, "#8a6a1a");
    px(ctx, sw.x + 1, sw.y + down, sw.w - 2, sw.h - 1 - down, "#c9a227");
    px(ctx, sw.x + 2, sw.y + down, sw.w - 4, Math.max(1, sw.h - 2 - down), color);
    px(ctx, sw.x + 3, sw.y + down, sw.w - 6, 1, "rgba(255,255,255,0.45)");
    if (sw.timer > 0 && sw.rest > 0 && !sw.pressed) {
      // barra do tempo restante
      px(ctx, sw.x, sw.y - 4, (sw.w * sw.rest) / (sw.timer * 60), 2, "#d97706");
    }
    if (sw.delay > 0 && sw.countdown > 0) {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sw.x + sw.w / 2, sw.y - 6, 4, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * (1 - sw.countdown / (sw.delay * 60)));
      ctx.stroke();
    }
  }
}

/** Vento: rajadas de poeira na direção do sopro (só quando ligado). */
export function drawWinds(ctx: CanvasRenderingContext2D, world: World) {
  for (const wd of world.level.winds) {
    const on = isOn(world, wd.target);
    ctx.fillStyle = on ? "rgba(240, 190, 120, 0.06)" : "rgba(120, 90, 60, 0.05)";
    ctx.fillRect(wd.x, wd.y, wd.w, wd.h);
    if (!on) continue;
    const t = world.frame;
    for (let i = 0; i < (wd.w * wd.h) / 160; i++) {
      const seed = (i * 97) % 89;
      const x = wd.x + ((((seed * 13 + t * wd.fx * 1.5) % wd.w) + wd.w) % wd.w);
      const y = wd.y + ((((seed * 7 + t * wd.fy * 1.5) % wd.h) + wd.h) % wd.h);
      const dx = wd.fx === 0 ? 0 : Math.sign(wd.fx);
      const dy = wd.fy === 0 ? 0 : Math.sign(wd.fy);
      // risco de poeira com um grão na ponta
      ctx.fillStyle = "rgba(255, 225, 170, 0.55)";
      for (let k = 0; k < 5; k++) ctx.fillRect(Math.round(x + dx * k), Math.round(y + dy * k), 1, 1);
      ctx.fillStyle = "rgba(255, 240, 210, 0.9)";
      ctx.fillRect(Math.round(x + dx * 6), Math.round(y + dy * 6), 1, 1);
    }
  }
}

/** Mola de carroça: base de madeira, espiral de aço e placa (apagada com o botão desligado). */
export function drawSprings(ctx: CanvasRenderingContext2D, world: World) {
  for (const sp of world.level.springs) {
    const on = isOn(world, sp.target);
    px(ctx, sp.x, sp.y + sp.h - 4, sp.w, 4, WOOD_DARK);
    px(ctx, sp.x, sp.y + sp.h - 4, sp.w, 1, "#8a5426");
    ctx.strokeStyle = on ? "#d8dce2" : "#7a7a7a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = sp.x + 3; x < sp.x + sp.w - 3; x += 6) {
      ctx.moveTo(x, sp.y + sp.h - 4);
      ctx.lineTo(x + 3, sp.y + 4);
      ctx.lineTo(x + 6, sp.y + sp.h - 4);
    }
    ctx.stroke();
    px(ctx, sp.x, sp.y, sp.w, 3, on ? "#f2c94c" : "#8a8e96");
    px(ctx, sp.x, sp.y + 2, sp.w, 1, on ? "#b8901f" : "#5c5f66");
  }
}

/** Portal: boca de túnel de mina com anel brilhante; linha pontilhada até o destino. */
export function drawWarps(ctx: CanvasRenderingContext2D, world: World) {
  for (const wp of world.level.warps) {
    const cx = wp.x + wp.w / 2;
    const cy = wp.y + wp.h / 2;
    const tx = wp.to.x + TILE / 2;
    const ty = wp.to.y + TILE / 2;
    const ring = wp.all ? "#e879f9" : "#a78bfa";
    ctx.strokeStyle = wp.all ? "rgba(232, 121, 249, 0.4)" : "rgba(167, 139, 250, 0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.setLineDash([]);
    // escuro do túnel e escoras de madeira
    ctx.fillStyle = "#1a0f14";
    ctx.beginPath();
    ctx.ellipse(cx, cy, wp.w / 2 - 1, wp.h / 2 - 1, 0, 0, Math.PI * 2);
    ctx.fill();
    px(ctx, wp.x, wp.y + 1, 2, wp.h - 1, WOOD_DARK);
    px(ctx, wp.x + wp.w - 2, wp.y + 1, 2, wp.h - 1, WOOD_DARK);
    px(ctx, wp.x - 1, wp.y, wp.w + 2, 2, "#6b3d1a");
    ctx.strokeStyle = ring;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, wp.w / 2 - 3, wp.h / 2 - 3, (world.frame / 30) % Math.PI, 0, Math.PI * 1.6);
    ctx.stroke();
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(tx, ty, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Trilho: vagonete de mina; o contador mostra quantos estão a bordo. */
export function drawRails(ctx: CanvasRenderingContext2D, world: World) {
  for (const [i, r] of world.rails.entries()) {
    const def = world.level.rails[i];
    ctx.strokeStyle = "rgba(90, 50, 20, 0.7)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    def.path.forEach((pt, j) => (j === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, pt.x + r.w / 2, pt.y + r.h / 2));
    ctx.stroke();
    ctx.setLineDash([]);
    const x = Math.round(r.x);
    const y = Math.round(r.y);
    px(ctx, x, y, r.w, r.h, "#6b3d1a");
    px(ctx, x, y, r.w, 2, STEEL);
    px(ctx, x, y + r.h - 1, r.w, 1, "#3c2210");
    for (let k = x + 4; k < x + r.w - 2; k += 8) px(ctx, k, y + 3, 1, 1, "#c0c4ca");
    for (const wx of [x + 3, x + r.w - 7]) {
      px(ctx, wx, y + r.h, 4, 2, "#2a2a2a");
      px(ctx, wx + 1, y + r.h + 2, 2, 1, "#2a2a2a");
    }
    if (def.need !== 0) {
      const need = def.need < 0 ? world.players.length + def.need : Math.min(def.need, world.players.length);
      counter(ctx, `${Math.min(r.weight, need)}/${need}`, x + r.w / 2, y + r.h / 2 + 1, 7);
    }
  }
}

/** Parede que empurra: aríete de tora com ponta de aço. */
export function drawPushers(ctx: CanvasRenderingContext2D, world: World) {
  for (const [i, p] of world.pushers.entries()) {
    const dir = Math.sign(world.level.pushers[i].dx);
    const x = Math.round(p.x);
    px(ctx, x, p.y, p.w, p.h, WOOD);
    for (let y = p.y + 5; y < p.y + p.h; y += 9) px(ctx, x, y, p.w, 1, WOOD_DARK);
    px(ctx, x, p.y, 1, p.h, "#a96c34");
    const tip = dir > 0 ? x + p.w - 2 : x;
    px(ctx, tip, p.y, 2, p.h, STEEL);
    const cy = p.y + p.h / 2;
    const edge = dir > 0 ? x + p.w : x;
    ctx.fillStyle = "#f2c94c";
    ctx.beginPath();
    ctx.moveTo(edge + dir * 4, cy);
    ctx.lineTo(edge, cy - 3);
    ctx.lineTo(edge, cy + 3);
    ctx.fill();
  }
}

/** Elevador de mina pendurado em cordas. */
export function drawLifts(ctx: CanvasRenderingContext2D, world: World) {
  for (const l of world.lifts) {
    const need = Math.min(l.need, world.players.length);
    const y = Math.round(l.y);
    px(ctx, l.x + 2, -TILE, 1, y + TILE, "#8a6a3a");
    px(ctx, l.x + l.w - 3, -TILE, 1, y + TILE, "#8a6a3a");
    px(ctx, l.x, y, l.w, l.h, "#7a4a22");
    px(ctx, l.x, y, l.w, 2, "#c98b4a");
    for (let x = l.x + TILE; x < l.x + l.w; x += TILE) px(ctx, x, y, 1, l.h, WOOD_DARK);
    px(ctx, l.x, y + l.h - 1, l.w, 1, "#3c2210");
    counter(ctx, `${Math.min(l.weight, need)}/${need}`, l.x + l.w / 2, y + l.h / 2 + 1, 9);
  }
}

/** Saloon: portas vaivém fechadas com cadeado; abertas mostram a luz de dentro. */
export function drawDoor(ctx: CanvasRenderingContext2D, { door }: World) {
  const { x, y, w, h } = door;
  px(ctx, x - 2, y - 2, w + 4, h + 2, WOOD_DARK);
  px(ctx, x, y, w, h, door.open ? "#f2a53b" : "#2a140c");
  if (door.open) {
    px(ctx, x + 2, y + 2, w - 4, h - 2, "#ffd27a");
    px(ctx, x, y + 6, 2, 12, "#b0703a");
    px(ctx, x + w - 2, y + 6, 2, 12, "#b0703a");
  } else {
    px(ctx, x + 1, y + 7, 6, 11, "#b0703a");
    px(ctx, x + 9, y + 7, 6, 11, "#b0703a");
    px(ctx, x + 1, y + 7, 6, 1, "#d89a58");
    px(ctx, x + 9, y + 7, 6, 1, "#d89a58");
    for (const sx of [x + 3, x + 5, x + 11, x + 13]) px(ctx, sx, y + 9, 1, 8, "#7a4420");
    // cadeado
    px(ctx, x + w / 2 - 2, y + 11, 4, 3, "#ffd23f");
    px(ctx, x + w / 2 - 1, y + 9, 2, 2, "#b8901f");
  }
  px(ctx, x - 6, y - 9, w + 12, 7, "#3c2210");
  pixelText(ctx, "SALOON", x - 4, y - 8, "#ffd06a");
}

export function drawBox(ctx: CanvasRenderingContext2D, b: Box, need: number) {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  if (b.color !== null) {
    // caixote pintado na cor do dono, sem número (só ele empurra)
    px(ctx, x, y, b.w, b.h, PLAYER_COLORS[b.color % PLAYER_COLORS.length]);
    for (let k = y + 5; k < y + b.h - 1; k += 5) px(ctx, x + 1, k, b.w - 2, 1, "rgba(0,0,0,0.25)");
    px(ctx, x + b.w / 2 - 1, y + 3, 2, b.h - 6, OUTLINE);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, b.w - 1, b.h - 1);
    return;
  }
  px(ctx, x, y, b.w, b.h, "#b07a40");
  for (let k = y + 5; k < y + b.h - 2; k += 5) px(ctx, x + 2, k, b.w - 4, 1, "#8a5a2c");
  ctx.strokeStyle = "#6b4220";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, b.w - 2, b.h - 2);
  for (const [cx, cy] of [[x, y], [x + b.w - 3, y], [x, y + b.h - 3], [x + b.w - 3, y + b.h - 3]]) px(ctx, cx, cy, 3, 3, STEEL);
  // número marcado a fogo: quantos ainda faltam para a caixa andar
  const left = Math.max(0, need - b.pushers);
  ctx.fillStyle = left === 0 ? "#2f6b2c" : "#3c2210";
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(left === 0 ? need : left), x + b.w / 2, y + b.h / 2 + 1);
}

/** Chão que cai: tábuas podres que tremem antes de despencar. */
export function drawFalls(ctx: CanvasRenderingContext2D, world: World) {
  for (const f of world.falls) {
    const shake = f.touched && f.timer > 0 ? (world.frame % 4 < 2 ? 1 : -1) : 0;
    const x = f.x + shake;
    px(ctx, x, f.y, f.w, f.h, "#8a7050");
    px(ctx, x, f.y, f.w, 2, "#b09a72");
    for (let k = 0; k < f.w; k += TILE) {
      px(ctx, x + k, f.y, 1, f.h, "#4e3c26");
      const crack = Math.floor(hash(f.x + k, f.y) * 10) + 3;
      px(ctx, x + k + crack, f.y + 3, 1, 4, "#4e3c26");
      px(ctx, x + k + crack + 1, f.y + 7, 1, 3, "#4e3c26");
    }
    px(ctx, x, f.y + f.h - 1, f.w, 1, "#4e3c26");
  }
}

const ANGLE: Record<ThornDir, number> = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };

/** Espinhos parados viram cactos; os que se movem são pontas de aço numa viga. */
export function drawThorns(ctx: CanvasRenderingContext2D, world: World) {
  // corrente dos esmagadores (espinhos que descem do teto)
  for (const t of world.thorns) {
    if (t.dir !== "down" || t.dy <= 0) continue;
    const cx = Math.round(t.x + t.w / 2);
    for (let y = 0; y < t.y; y += 4) px(ctx, cx - 1, y, 2, 3, y % 8 === 0 ? "#8a8e96" : "#5c5f66");
  }
  const cactus = spriteImage(CACTUS);
  for (const t of world.thorns) {
    for (let cx = 0; cx < t.w; cx += TILE) {
      for (let cy = 0; cy < t.h; cy += TILE) {
        const x = Math.round(t.x + cx);
        const y = Math.round(t.y + cy);
        if (t.speed === 0) {
          ctx.save();
          ctx.translate(x + TILE / 2, y + TILE / 2);
          ctx.rotate(ANGLE[t.dir]);
          ctx.drawImage(cactus, -TILE / 2, TILE / 2 - CACTUS.rows.length);
          ctx.restore();
        } else {
          steelSpike(ctx, x, y, t.dir);
        }
      }
    }
  }
}

function steelSpike(ctx: CanvasRenderingContext2D, x: number, y: number, dir: ThornDir) {
  ctx.save();
  ctx.translate(x + TILE / 2, y + TILE / 2);
  ctx.rotate(ANGLE[dir]);
  // em coordenadas de "ponta para cima" com origem no centro da célula
  px(ctx, -8, 5, 16, 3, "#8a2a1e");
  px(ctx, -8, 5, 16, 1, "#b84a32");
  for (const ox of [-8, 0]) {
    ctx.fillStyle = "#c0c4ca";
    ctx.beginPath();
    ctx.moveTo(ox + 1, 5);
    ctx.lineTo(ox + 4, -4);
    ctx.lineTo(ox + 7, 5);
    ctx.fill();
    px(ctx, ox + 4, -2, 1, 6, "#eef0f3");
  }
  ctx.restore();
}

/** Corda como laço trançado: folgada é clara, esticada escurece. */
export function drawRope(ctx: CanvasRenderingContext2D, world: World) {
  const chain = world.players.filter((p) => !p.cleared);
  const length = world.level.rope ?? 0;
  for (let i = 0; i + 1 < chain.length; i++) {
    const a = chain[i];
    const b = chain[i + 1];
    const ax = a.x + a.w / 2;
    const ay = a.y + a.h / 2;
    const bx = b.x + b.w / 2;
    const by = b.y + b.h / 2;
    const d = Math.hypot(bx - ax, by - ay);
    const sag = Math.max(0, length - d) * 0.5;
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + sag, bx, by);
      ctx.stroke();
    };
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#4a2e14";
    path();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = d >= length ? "#a0783e" : "#e0bc7a";
    ctx.setLineDash([2, 1]);
    path();
    ctx.setLineDash([]);
  }
}

/** Setinha na cor do jogador acima do chapéu: identifica cada um no meio do grupo. */
export function drawMarker(ctx: CanvasRenderingContext2D, p: Player) {
  const k = p.h / PLAYER_SIZE;
  const cx = Math.round(p.x + p.w / 2);
  const top = Math.round(p.y - 2 * k);
  const color = PLAYER_COLORS[p.index % PLAYER_COLORS.length];
  ctx.save();
  if (p.gravDir < 0) {
    ctx.translate(0, 2 * Math.round(p.y) + p.h);
    ctx.scale(1, -1);
  }
  px(ctx, cx - 3, top - 6, 7, 1, OUTLINE);
  px(ctx, cx - 3, top - 5, 7, 1, color);
  px(ctx, cx - 2, top - 4, 5, 1, color);
  px(ctx, cx - 1, top - 3, 3, 1, color);
  px(ctx, cx, top - 2, 1, 1, color);
  ctx.restore();
}

export function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, frame: number) {
  const walking = p.onGround && Math.abs(p.vx) > 0.2 && Math.floor(frame / 6) % 2 === 1;
  const img = spriteImage((walking ? COWBOYS_WALK : COWBOYS)[p.index % COWBOYS.length]);
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const k = p.h / PLAYER_SIZE;
  ctx.save();
  // de ponta-cabeça: espelha em torno do centro; olhando para a esquerda: espelha na horizontal
  if (p.gravDir < 0) {
    ctx.translate(0, 2 * y + p.h);
    ctx.scale(1, -1);
  }
  if (p.facing < 0) {
    ctx.translate(2 * x + p.w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, x, y - 2 * k, p.w, p.h + 2 * k);
  ctx.restore();
}

export function drawKey(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  ctx.drawImage(spriteImage(KEY_SPRITE), Math.round(x) - 1, Math.round(y) + 1);
  // brilho piscando
  if (frame % 40 < 20) px(ctx, Math.round(x) + 11, Math.round(y) - 1, 1, 1, "#fff6c2");
  else px(ctx, Math.round(x) - 2, Math.round(y), 1, 1, "#fff6c2");
}
