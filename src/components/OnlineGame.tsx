"use client";

import { useEffect, useRef, useState } from "react";
import { getBestTime } from "@/app/room/[code]/actions";
import { sharedAudio } from "@/game/audio";
import { VIEW_H, VIEW_W } from "@/game/engine/constants";
import { parseLevel } from "@/game/engine/level";
import type { World } from "@/game/engine/world";
import { createKeyboard, readSoloInput } from "@/game/input";
import { LEVELS } from "@/game/levels";
import { PLAYER_COLORS, render } from "@/game/render";
import { encodeInput } from "@/net/bits";
import { createClock, STEP_MS } from "@/net/clock";
import type { ClientMsg, ServerMsg } from "@/net/protocol";
import { createTimeline, MAX_AHEAD } from "@/net/timeline";

const SCALE = 3;
const PING_MS = 1000;

type Start = Extract<ServerMsg, { t: "start" }>;
type Props = {
  start: Start;
  you: string;
  isHost: boolean;
  nicks: Record<string, string>;
  send: (msg: ClientMsg) => void;
  subscribe: (listener: (msg: ServerMsg) => void) => () => void;
};

declare global {
  interface Window {
    __sunsetPark?: { world: World };
  }
}

const formatTime = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

/** Partida online: aplica o próprio input na hora, prevê os outros e corrige com o servidor. */
export default function OnlineGame({ start, you, isHost, nicks, send, subscribe }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState({ elapsed: 0, resets: 0, countdown: 0 });
  const [paused, setPaused] = useState<string[] | null>(null);
  const [cleared, setCleared] = useState<{ timeMs: number; bestMs: number | null } | null>(null);
  const [bestMs, setBestMs] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const def = LEVELS.find((l) => l.slug === start.slug)!;

  useEffect(() => {
    getBestTime(start.slug, start.seats.length).then(setBestMs, () => {});
  }, [start]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);

    const level = parseLevel(LEVELS.find((l) => l.slug === start.slug)!);
    const mySeat = start.seats.findIndex((s) => s.id === you);
    const tl = createTimeline(level, start.seats.length, mySeat);
    const clock = createClock();
    const looks = start.seats.map((s) => s.cowboy);
    const keyboard = createKeyboard(window);
    const audio = sharedAudio();
    setMuted(audio.muted());
    let frame = 0;
    let lastBits = 0;
    let isPaused = false;
    let hudAt = 0;
    let raf = 0;

    const ping = () => send({ t: "ping", at: performance.now() });
    const sendBits = (bits: number) => {
      lastBits = bits;
      const f = Math.max(frame, tl.frame() + 1);
      tl.setOwn(f, bits);
      send({ t: "input", f, bits });
    };

    const unsubscribe = subscribe((msg) => {
      switch (msg.t) {
        case "tick":
          tl.confirm(msg.s, msg.changes, msg.resets);
          break;
        case "hash":
          if (tl.frame() === msg.s && tl.hash() !== msg.h) send({ t: "resync" });
          break;
        case "snapshot":
          tl.load(msg.s, msg.world, msg.bits);
          frame = Math.max(frame, msg.s);
          break;
        case "pong":
          clock.sample(msg.at, performance.now(), msg.frame);
          break;
        case "paused":
          isPaused = true;
          setPaused(msg.ids);
          break;
        case "resume":
          isPaused = false;
          setPaused(null);
          clock.clear();
          ping();
          break;
        case "cleared":
          setCleared({ timeMs: msg.timeMs, bestMs: msg.bestMs });
          break;
      }
    });
    const pinger = setInterval(ping, PING_MS);
    ping();

    const onKey = (e: KeyboardEvent) => {
      audio.unlock();
      if (e.code === "KeyR") send({ t: "restart" });
      if (e.code === "KeyM") {
        audio.setMuted(!audio.muted());
        setMuted(audio.muted());
      }
      if (e.code === "Escape" && isHost) send({ t: "toLobby" });
    };
    // aba escondida não roda o laço: solta tudo para o cowboy não andar sozinho para os outros
    const onVisibility = () => {
      if (document.hidden && lastBits !== 0) sendBits(0);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);

    const loop = (now: number) => {
      if (!isPaused && clock.ready() && !document.hidden) {
        frame = Math.max(frame, Math.min(clock.target(now), tl.frame() + MAX_AHEAD));
        const bits = encodeInput(readSoloInput(keyboard.down));
        if (bits !== lastBits) sendBits(bits);
      }
      const { world, events } = tl.predict(frame);
      window.__sunsetPark = { world };
      for (const e of events) audio.play(e);
      render(ctx, world, looks);
      if (now - hudAt > 200) {
        hudAt = now;
        const startsIn = clock.ready() ? (tl.frame() - clock.serverFrame(now)) * STEP_MS : 0;
        setHud({ elapsed: world.frame * STEP_MS, resets: world.resets, countdown: startsIn > 0 ? Math.ceil(startsIn / 1000) : 0 });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(pinger);
      unsubscribe();
      keyboard.dispose();
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      delete window.__sunsetPark;
    };
  }, [start, you, isHost, send, subscribe]);

  const toggleMute = () => {
    const audio = sharedAudio();
    audio.setMuted(!audio.muted());
    setMuted(audio.muted());
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-dusk p-4">
      <div className="flex w-full max-w-[960px] flex-col gap-3">
        <div className="flex items-center justify-between text-sm text-sand">
          <span className="font-western text-base text-gold">
            {start.slug} · {def.name}
          </span>
          <span className="flex items-center gap-3">
            <span className="tabular-nums">
              {formatTime(hud.elapsed)} · deaths {hud.resets}
              {bestMs !== null && ` · best ${formatTime(bestMs)}`}
            </span>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Turn sound on" : "Turn sound off"}
              aria-pressed={muted}
              className="rounded border border-plank-edge bg-plank px-2 py-0.5 text-xs hover:bg-plank-edge"
            >
              {muted ? "🔇 sound" : "🔊 sound"}
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
          {hud.countdown > 0 && !paused && (
            <div className="absolute inset-0 flex items-center justify-center font-western text-8xl text-gold drop-shadow-[0_4px_0_#1d1118]">
              {hud.countdown}
            </div>
          )}
          {paused && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-dusk/75 text-sand">
              <p className="font-western text-3xl text-gold">Paused</p>
              <p>Waiting for {paused.map((id) => nicks[id] ?? "a player").join(", ")} to reconnect (up to 30 s)…</p>
            </div>
          )}
          {cleared && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-dusk/75 text-sand">
              <p className="font-western text-4xl text-gold">Level clear!</p>
              <p className="tabular-nums">
                {formatTime(cleared.timeMs)}
                {cleared.bestMs !== null && ` · best ${formatTime(cleared.bestMs)}`}
              </p>
              <p className="text-sm text-dust">Back to the room in a few seconds…</p>
            </div>
          )}
        </div>

        <ul className="flex flex-wrap gap-4 text-xs text-dust">
          {start.seats.map((s) => (
            <li key={s.id} className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: PLAYER_COLORS[s.cowboy] }} />
              {nicks[s.id] ?? "?"}
              {s.id === you && " (you)"}
            </li>
          ))}
          <li>← → ↑ or WASD · R restart · M sound{isHost && " · Esc back to room"}</li>
        </ul>
      </div>
    </main>
  );
}
