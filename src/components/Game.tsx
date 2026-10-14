"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { saveTime } from "@/app/play/[slug]/actions";
import { createAudio, type Audio } from "@/game/audio";
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

// um só contexto de áudio para todas as fases (o navegador só o libera após um gesto)
let sharedAudio: Audio | null = null;
const getAudio = () => (sharedAudio ??= createAudio());

export default function Game({ levelId, name, def, playerCount, nextHref, bestMs }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);
  const [resets, setResets] = useState(0);
  const [clearedMs, setClearedMs] = useState<number | null>(null);
  // a próxima fase só abre depois que a conclusão foi gravada (desbloqueio vem do banco)
  const [saved, setSaved] = useState(false);
  // começa "com som" no servidor; o estado salvo no navegador entra após montar
  const [muted, setMuted] = useState(false);
  const toggleMute = () => {
    const audio = getAudio();
    audio.setMuted(!audio.muted());
    setMuted(audio.muted());
  };

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

    const audio = getAudio();
    setMuted(audio.muted());
    const onKey = (e: KeyboardEvent) => {
      audio.unlock();
      if (e.code === "KeyR") {
        resetWorld(world);
        audio.play("restart");
      }
      if (e.code === "KeyM") {
        audio.setMuted(!audio.muted());
        setMuted(audio.muted());
      }
      if (e.code === "Escape") router.push("/");
      if (e.code === "Enter" && canAdvance && nextHref) router.push(nextHref);
    };
    window.addEventListener("keydown", onKey);

    const loop = (now: number) => {
      acc += Math.min(250, now - last);
      last = now;
      while (acc >= STEP_MS) {
        step(world, readInputs(keyboard.down, playerCount));
        for (const e of world.events) audio.play(e);
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
      <div className="flex items-center justify-between text-sm text-sand">
        <Link href="/" className="font-semibold hover:underline">
          ← Park Party
        </Link>
        <span className="font-western text-base text-gold">{name}</span>
        <span className="flex items-center gap-3">
          <span className="tabular-nums">
            {formatTime(elapsed)} · mortes {resets}
            {bestMs !== null && ` · recorde ${formatTime(bestMs)}`}
          </span>
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Ligar o som" : "Desligar o som"}
            aria-pressed={muted}
            className="rounded border border-plank-edge bg-plank px-2 py-0.5 text-xs hover:bg-plank-edge"
          >
            {muted ? "🔇 som" : "🔊 som"}
          </button>
        </span>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={VIEW_W * SCALE}
          height={VIEW_H * SCALE}
          className="block h-auto w-full rounded-lg border-4 border-plank-edge [image-rendering:pixelated]"
          data-testid="game-canvas"
        />
        {clearedMs !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-dusk/75 text-sand">
            <p className="font-western text-4xl text-gold">Fase concluída!</p>
            <p className="tabular-nums">{formatTime(clearedMs)}</p>
            {!saved ? (
              <p className="text-sm text-dust">Salvando…</p>
            ) : nextHref ? (
              <Link href={nextHref} className="rounded bg-gold px-4 py-2 font-semibold text-dusk">
                Próxima fase (Enter)
              </Link>
            ) : (
              <Link href="/" className="rounded bg-gold px-4 py-2 font-semibold text-dusk">
                Voltar ao menu
              </Link>
            )}
          </div>
        )}
      </div>

      <ul className="flex flex-wrap gap-4 text-xs text-dust">
        {Array.from({ length: playerCount }, (_, i) => (
          <li key={i} className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: PLAYER_COLORS[i] }} />
            J{i + 1}: {KEY_LABELS[i]} (ou gamepad {i + 1})
          </li>
        ))}
        <li>R reinicia · M som · Esc menu</li>
      </ul>
    </div>
  );
}
