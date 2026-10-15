import type { GameEvent } from "./engine/world";

/**
 * Efeitos sonoros sintetizados (Web Audio), no estilo chiptune: nada de arquivos de áudio.
 * Cada som é uma sequência de notas; `at` posiciona a nota no tempo (padrão: logo após a anterior).
 */
/** Além dos eventos do jogo: reinício e os sons do lobby. */
export type Sfx = GameEvent | "restart" | "start" | "join" | "leave" | "pick";

type Note = {
  /** Frequência inicial (Hz); com `to`, desliza até ela. */
  f: number;
  to?: number;
  /** Duração (s). */
  d: number;
  wave?: OscillatorType | "noise";
  /** Volume relativo (0–1). */
  v?: number;
  at?: number;
};

const A5 = 880, C5 = 523, D6 = 1175, E5 = 659, G4 = 392, G5 = 784, G6 = 1568, C6 = 1047, E6 = 1319;

export const SOUNDS: Record<Sfx, Note[]> = {
  jump: [{ f: 360, to: 760, d: 0.09, wave: "square", v: 0.5 }],
  flip: [{ f: 760, to: 280, d: 0.12, wave: "square", v: 0.5 }],
  spring: [{ f: 180, to: 950, d: 0.2, wave: "triangle", v: 0.9 }],
  warp: [520, 780, 1040, 1560].map((f, i) => ({ f, d: 0.035, wave: "sine" as const, v: 0.7, at: i * 0.035 })),
  crumble: [{ f: 600, d: 0.16, wave: "noise", v: 0.5 }],
  switch: [
    { f: 1200, d: 0.03, wave: "square", v: 0.4 },
    { f: 800, d: 0.04, wave: "square", v: 0.4 },
  ],
  tick: [{ f: 1000, d: 0.04, wave: "square", v: 0.35 }],
  release: [G5, C6, E6, G6].map((f, i) => ({ f, d: 0.05, wave: "triangle" as const, v: 0.8, at: i * 0.05 })),
  key: [A5, D6, G6].map((f, i) => ({ f, d: 0.06, wave: "square" as const, v: 0.45, at: i * 0.06 })),
  keyPass: [D6, G6].map((f, i) => ({ f, d: 0.05, wave: "square" as const, v: 0.4, at: i * 0.05 })),
  door: [C5, E5, G5, C6].map((f, i) => ({ f, d: 0.07, wave: "triangle" as const, v: 0.9, at: i * 0.07 })),
  enter: [{ f: 660, to: 990, d: 0.1, wave: "sine", v: 0.7 }],
  clear: [
    { f: G4, d: 0.1, wave: "square", v: 0.45 },
    { f: C5, d: 0.1, wave: "square", v: 0.45 },
    { f: E5, d: 0.1, wave: "square", v: 0.45 },
    { f: G5, d: 0.2, wave: "square", v: 0.45 },
    { f: E5, d: 0.1, wave: "square", v: 0.45 },
    { f: G5, d: 0.5, wave: "square", v: 0.45 },
    { f: C6, d: 0.6, wave: "triangle", v: 0.6, at: 0.6 },
    { f: E6, d: 0.6, wave: "triangle", v: 0.35, at: 0.6 },
  ],
  death: [
    { f: 440, to: 90, d: 0.35, wave: "square", v: 0.5 },
    { f: 300, d: 0.2, wave: "noise", v: 0.35, at: 0 },
  ],
  restart: [{ f: 330, to: 200, d: 0.12, wave: "square", v: 0.4 }],
  // jingle da tela título: arpejo subindo e um acorde de saloon
  start: [
    ...[G4, C5, E5, G5].map((f, i) => ({ f, d: 0.08, wave: "square" as const, v: 0.45, at: i * 0.08 })),
    { f: C6, d: 0.45, wave: "triangle", v: 0.7, at: 0.32 },
    { f: E6, d: 0.45, wave: "triangle", v: 0.35, at: 0.32 },
  ],
  join: [C5, G5].map((f, i) => ({ f, d: 0.06, wave: "square" as const, v: 0.45, at: i * 0.06 })),
  leave: [G5, C5].map((f, i) => ({ f, d: 0.06, wave: "square" as const, v: 0.4, at: i * 0.06 })),
  pick: [{ f: 900, d: 0.03, wave: "square", v: 0.35 }],
};

export const soundLength = (notes: Note[]) => {
  let t = 0;
  let end = 0;
  for (const n of notes) {
    const start = n.at ?? t;
    t = start + n.d;
    end = Math.max(end, t);
  }
  return end;
};

const MUTE_KEY = "sunset-park:muted";
/** Chave antiga (antes de o jogo se chamar Sunset Park). */
const OLD_MUTE_KEY = "park-party:muted";
/** Intervalo mínimo entre repetições do mesmo som (evita metralhar em quadros seguidos). */
const MIN_GAP = 0.05;

export type Audio = {
  play: (sfx: Sfx) => void;
  /** Precisa de um gesto do usuário (tecla/clique) para o navegador liberar o som. */
  unlock: () => void;
  muted: () => boolean;
  setMuted: (muted: boolean) => void;
  dispose: () => void;
};

export function createAudio(): Audio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  const last = new Map<Sfx, number>();
  let muted = false;
  // depois do gesto, o contexto pode levar alguns ms para sair de "suspended"; notas agendadas tocam ao retomar
  let unlocked = false;
  try {
    muted = (localStorage.getItem(MUTE_KEY) ?? localStorage.getItem(OLD_MUTE_KEY)) === "1";
  } catch {}

  const ensure = () => {
    if (ctx || typeof AudioContext === "undefined") return ctx;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.22;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  };

  const note = (c: AudioContext, out: GainNode, n: Note, start: number) => {
    const gain = c.createGain();
    const peak = n.v ?? 1;
    // ataque curto e queda até o fim da nota (sem estalo)
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + n.d);
    gain.connect(out);
    if (n.wave === "noise") {
      const src = c.createBufferSource();
      src.buffer = noise;
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = n.f;
      src.connect(filter).connect(gain);
      src.start(start);
      src.stop(start + n.d);
      return;
    }
    const osc = c.createOscillator();
    osc.type = n.wave ?? "square";
    osc.frequency.setValueAtTime(n.f, start);
    if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, start + n.d);
    osc.connect(gain);
    osc.start(start);
    osc.stop(start + n.d + 0.01);
  };

  return {
    play(sfx) {
      if (muted) return;
      const c = ensure();
      if (!c || !master || !(c.state === "running" || (unlocked && c.state === "suspended"))) return;
      const now = c.currentTime;
      if (now - (last.get(sfx) ?? -1) < MIN_GAP) return;
      last.set(sfx, now);
      let t = now;
      for (const n of SOUNDS[sfx]) {
        const start = now + (n.at ?? t - now);
        note(c, master, n, start);
        t = start + n.d;
      }
    },
    unlock() {
      unlocked = true;
      const c = ensure();
      if (c && c.state === "suspended") void c.resume();
    },
    muted: () => muted,
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.22;
      try {
        localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
      } catch {}
    },
    dispose() {
      void ctx?.close();
      ctx = null;
      master = null;
    },
  };
}

// um só contexto de áudio para o app inteiro (o navegador só o libera após um gesto)
let shared: Audio | null = null;
export const sharedAudio = () => (shared ??= createAudio());
