"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { saveTime } from "@/app/play/[slug]/actions";
import { FPS, VIEW_H, VIEW_W } from "@/game/engine/constants";
import { parseLevel, type LevelDef } from "@/game/engine/level";
import { createWorld, resetWorld, step, type World } from "@/game/engine/world";
import { createKeyboard, KEY_LABELS, readInputs } from "@/game/input";
import { PLAYER_COLORS, render } from "@/game/render";

const SCALE = 3;
const STEP_MS = 1000 / FPS;

type Props = {
  levelId: number;
  name: string;
  def: LevelDef;
  playerCount: number;
  nextHref: string | null;
  bestMs: number | null;
};

declare global {
  interface Window {
    __parkParty?: { world: World };
  }
}

const formatTime = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

export default function Game({ levelId, name, def, playerCount, nextHref, bestMs }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);
  const [resets, setResets] = useState(0);
  const [clearedMs, setClearedMs] = useState<number | null>(null);
  // a próxima fase só abre depois que a conclusão foi gravada (desbloqueio vem do banco)
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);

    const world = createWorld(parseLevel(def), playerCount);
    window.__parkParty = { world };
    const keyboard = createKeyboard(window);
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let finished = false;
    let canAdvance = false;
    let hudTimer = 0;

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyR") resetWorld(world);
      if (e.code === "Escape") router.push("/");
      if (e.code === "Enter" && canAdvance && nextHref) router.push(nextHref);
    };
    window.addEventListener("keydown", onKey);

    const loop = (now: number) => {
      acc += Math.min(250, now - last);
      last = now;
      while (acc >= STEP_MS) {
        step(world, readInputs(keyboard.down, playerCount));
        acc -= STEP_MS;
      }
      render(ctx, world);

      if (world.status === "cleared" && !finished) {
        finished = true;
        const ms = Math.round(world.frame * STEP_MS);
        setClearedMs(ms);
        saveTime(levelId, playerCount, ms)
          .catch(() => {})
          .finally(() => {
            canAdvance = true;
            setSaved(true);
          });
      }
      if (now - hudTimer > 200) {
        hudTimer = now;
        setElapsed(world.frame * STEP_MS);
        setResets(world.resets);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      keyboard.dispose();
      window.removeEventListener("keydown", onKey);
      delete window.__parkParty;
    };
  }, [def, playerCount, levelId, nextHref, router]);

  return (
    <div className="flex w-full max-w-[960px] flex-col gap-3">
      <div className="flex items-center justify-between text-sm text-stone-700">
        <Link href="/" className="font-semibold hover:underline">
          ← Park Party
        </Link>
        <span className="font-semibold">{name}</span>
        <span className="tabular-nums">
          {formatTime(elapsed)} · mortes {resets}
          {bestMs !== null && ` · recorde ${formatTime(bestMs)}`}
        </span>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={VIEW_W * SCALE}
          height={VIEW_H * SCALE}
          className="block h-auto w-full rounded-lg border-4 border-stone-800 [image-rendering:pixelated]"
          data-testid="game-canvas"
        />
        {clearedMs !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-stone-900/70 text-white">
            <p className="text-3xl font-bold">Fase concluída!</p>
            <p className="tabular-nums">{formatTime(clearedMs)}</p>
            {!saved ? (
              <p className="text-sm text-stone-300">Salvando…</p>
            ) : nextHref ? (
              <Link href={nextHref} className="rounded bg-amber-400 px-4 py-2 font-semibold text-stone-900">
                Próxima fase (Enter)
              </Link>
            ) : (
              <Link href="/" className="rounded bg-amber-400 px-4 py-2 font-semibold text-stone-900">
                Voltar ao menu
              </Link>
            )}
          </div>
        )}
      </div>

      <ul className="flex flex-wrap gap-4 text-xs text-stone-600">
        {Array.from({ length: playerCount }, (_, i) => (
          <li key={i} className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: PLAYER_COLORS[i] }} />
            J{i + 1}: {KEY_LABELS[i]} (ou gamepad {i + 1})
          </li>
        ))}
        <li>R reinicia · Esc menu</li>
      </ul>
    </div>
  );
}
