"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { sharedAudio } from "@/game/audio";
import { MAX_PLAYERS, VIEW_H, VIEW_W } from "@/game/engine/constants";
import { deviceLabel, KEYMAPS, readDevice, type Device } from "@/game/input";
import { formatTeam, lobbyPress, type LobbyAction, type Team } from "@/game/lobby";
import { COWBOY_NAMES, COWBOYS, COWBOYS_WALK, drawBackground, PLAYER_COLORS, spriteImage } from "@/game/render";

const ACTIONS: LobbyAction[] = ["jump", "left", "right", "down"];
const PADS: Device[] = ["g0", "g1", "g2", "g3"];
/** Tecla → (teclado, ação). Teclado vai por evento: um toque rápido cabe entre dois quadros. */
const KEY_ACTIONS = new Map(
  KEYMAPS.flatMap((m, k) => ACTIONS.map((a) => [m[a], [`k${k}` as Device, a]] as const)),
);
/** Ampliação do canvas do fundo. */
const BG_SCALE = 4;
/** Botão Start do controle (layout padrão). */
const START = 9;

const padPressed = (i: number, b: number) => navigator.getGamepads?.()[i]?.buttons[b]?.pressed ?? false;
const anyPadButton = () =>
  [...(navigator.getGamepads?.() ?? [])].some((p) => p?.buttons.some((b) => b.pressed) ?? false);

/** Tela título + lobby estilo PICO PARK: cada jogador entra com o próprio pulo e escolhe o cowboy. */
export default function Lobby() {
  const router = useRouter();
  const [phase, setPhase] = useState<"title" | "lobby">("title");
  const [team, setTeam] = useState<Team>([]);
  const teamRef = useRef(team);
  const phaseRef = useRef(phase);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const goRef = useRef(() => {});

  useEffect(() => {
    const ctx = bgRef.current?.getContext("2d");
    const audio = sharedAudio();
    const update = (next: Team) => {
      teamRef.current = next;
      setTeam(next);
    };
    const enterLobby = () => {
      if (phaseRef.current !== "title") return;
      audio.unlock();
      audio.play("start");
      phaseRef.current = "lobby";
      setPhase("lobby");
      // botões já segurados ao sair do título não contam como "entrar"
      prev = snapshot();
    };
    const go = () => {
      if (teamRef.current.length < 2) return;
      audio.play("enter");
      router.push(`/fases?team=${formatTeam(teamRef.current)}`);
    };
    goRef.current = go;

    const snapshot = () => new Map(PADS.map((d) => [d, readDevice(new Set(), d)]));
    let prev = snapshot();
    let prevAnyPad = anyPadButton();
    let prevStart = false;

    const onKey = (e: KeyboardEvent) => {
      audio.unlock();
      if (phaseRef.current === "title") return enterLobby();
      const hit = KEY_ACTIONS.get(e.code);
      if (hit && !e.repeat) {
        e.preventDefault();
        const next = press(teamRef.current, ...hit);
        if (next !== teamRef.current) update(next);
      }
      if (e.code === "Enter") go();
      if (e.code === "Escape") {
        phaseRef.current = "title";
        setPhase("title");
        update([]);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", enterLobby);

    let raf = 0;
    const loop = (now: number) => {
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        // canvas 4× maior com camadas em posição fracionária: rola 1 px de tela por vez (sem pulos de 4 px)
        ctx.setTransform(BG_SCALE, 0, 0, BG_SCALE, 0, 0);
        drawBackground(ctx, now / 40, true);
      }
      const anyPad = anyPadButton();
      if (phaseRef.current === "title") {
        if (anyPad && !prevAnyPad) enterLobby();
      } else {
        const cur = snapshot();
        let next = teamRef.current;
        for (const d of PADS) {
          const was = prev.get(d)!;
          const is = cur.get(d)!;
          for (const a of ACTIONS) if (is[a] && !was[a]) next = press(next, d, a);
        }
        prev = cur;
        if (next !== teamRef.current) update(next);
        const start = [0, 1, 2, 3].some((i) => padPressed(i, START));
        if (start && !prevStart) go();
        prevStart = start;
      }
      prevAnyPad = anyPad;
      raf = requestAnimationFrame(loop);
    };
    const press = (t: Team, d: Device, a: LobbyAction) => {
      const next = lobbyPress(t, d, a);
      if (next.length > t.length) audio.play("join");
      else if (next.length < t.length) audio.play("leave");
      else if (next !== t) audio.play("pick");
      return next;
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", enterLobby);
    };
  }, [router]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden bg-dusk p-6 text-sand">
      <canvas
        ref={bgRef}
        width={VIEW_W * BG_SCALE}
        height={VIEW_H * BG_SCALE}
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover opacity-70 [image-rendering:pixelated]"
      />
      <div className="relative text-center drop-shadow-[0_3px_0_#1d1118]">
        <h1 className={`font-western text-gold ${phase === "title" ? "text-7xl sm:text-8xl" : "text-5xl"}`}>Park Party</h1>
        <p className="mt-2 text-sand">Peguem a chave, abram a porta e entrem juntos.</p>
      </div>

      {phase === "title" ? (
        <p className="relative animate-pulse font-western text-2xl text-sand drop-shadow-[0_2px_0_#1d1118]">
          aperte qualquer tecla
        </p>
      ) : (
        <section aria-label="Escolha dos cowboys" className="relative grid w-full max-w-4xl gap-5">
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: MAX_PLAYERS }, (_, i) => (
              <SeatCard key={i} index={i} seat={team[i]} />
            ))}
          </ol>
          <div className="grid gap-2 rounded-lg bg-dusk/80 p-3 text-center text-sm text-dust">
            <p>
              Entre apertando seu pulo: <b className="text-sand">W · ↑ · I · Num 8</b> ou o <b className="text-sand">botão A</b> do controle
            </p>
            <p>← → troca de cowboy · baixo sai · Esc volta</p>
          </div>
          <button
            type="button"
            onClick={() => goRef.current()}
            disabled={team.length < 2}
            className="mx-auto rounded bg-gold px-6 py-2 font-western text-xl text-dusk disabled:opacity-40"
          >
            {team.length < 2 ? "Precisa de 2 jogadores" : "Escolher fase (Enter)"}
          </button>
        </section>
      )}
    </main>
  );
}

function SeatCard({ index, seat }: { index: number; seat: Team[number] | undefined }) {
  if (!seat)
    return (
      <li className="flex h-48 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-plank-edge bg-dusk/70 text-dust">
        <span className="font-western text-lg">J{index + 1}</span>
        <span className="text-xs">aperte pulo</span>
      </li>
    );
  const color = PLAYER_COLORS[seat.cowboy];
  return (
    <li
      data-testid={`seat-${index}`}
      className="flex h-48 flex-col items-center justify-between rounded-lg border-4 bg-plank p-2 shadow-lg"
      style={{ borderColor: color }}
    >
      <span className="font-western text-sm" style={{ color }}>
        J{index + 1}
      </span>
      <Portrait cowboy={seat.cowboy} />
      <span className="flex w-full items-center justify-between font-western text-base">
        <span className="text-dust">◀</span>
        {COWBOY_NAMES[seat.cowboy]}
        <span className="text-dust">▶</span>
      </span>
      <span className="text-[11px] text-dust">{seat.devices.map(deviceLabel).join(" ou ")}</span>
    </li>
  );
}

/** Cowboy em pixel art, andando no lugar. */
function Portrait({ cowboy }: { cowboy: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    let step = 0;
    const draw = () => {
      ctx.clearRect(0, 0, 14, 16);
      ctx.drawImage(spriteImage((step++ % 2 ? COWBOYS_WALK : COWBOYS)[cowboy]), 0, 0);
    };
    draw();
    const id = setInterval(draw, 300);
    return () => clearInterval(id);
  }, [cowboy]);
  return <canvas ref={ref} width={14} height={16} className="h-24 w-[84px] [image-rendering:pixelated]" />;
}
