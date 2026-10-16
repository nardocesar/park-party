import { FPS } from "@/game/engine/constants";

export const STEP_MS = 1000 / FPS;
/** Folga, em quadros, para o input chegar ao servidor antes do quadro em que foi carimbado. */
export const LEAD_FRAMES = 2;
const SAMPLES = 8;

/**
 * Relógio da partida no cliente. Cada `pong` traz o quadro virtual (fracionário) do servidor no
 * instante da resposta; a amostra de menor RTT entre as últimas é a mais confiável.
 * `origin` é o instante local em que o servidor estava no quadro 0.
 */
export function createClock() {
  let samples: { rtt: number; origin: number }[] = [];
  const best = () => samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
  const serverFrame = (now: number) => (now - best().origin) / STEP_MS;

  return {
    ready: () => samples.length > 0,
    clear() {
      samples = [];
    },
    sample(sentAt: number, receivedAt: number, frame: number) {
      const rtt = receivedAt - sentAt;
      samples = [...samples, { rtt, origin: receivedAt - rtt / 2 - frame * STEP_MS }].slice(-SAMPLES);
    },
    rtt: () => (samples.length ? best().rtt : 0),
    serverFrame,
    /** Quadro que o cliente deve simular agora: o do servidor + meia volta + folga. */
    target(now: number) {
      return Math.floor(serverFrame(now) + best().rtt / 2 / STEP_MS) + LEAD_FRAMES;
    },
  };
}
