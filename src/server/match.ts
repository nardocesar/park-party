import type { Level } from "@/game/engine/level";
import { worldToJson } from "@/game/engine/snapshot";
import { STEP_MS } from "@/net/clock";
import type { ServerMsg } from "@/net/protocol";
import { createTimeline, type Change } from "@/net/timeline";

/** Contagem antes do primeiro quadro e na volta de uma pausa: tempo para todos sincronizarem. */
export const COUNTDOWN_MS = 3_000;
/** Input carimbado mais longe que isso no futuro só vem de cliente adulterado. */
export const MAX_FUTURE = 120;
export const TICK_EVERY = 2;
export const HASH_EVERY = 60;
/** Teto de quadros numa chamada: servidor engasgado não trava o processo. */
const MAX_CATCH_UP = 60;

export type Match = ReturnType<typeof createMatch>;

/**
 * Partida autoritativa. O quadro f fica devido em `t0 + f * STEP_MS`; inputs chegam carimbados
 * com o quadro do cliente e, se atrasados, valem no próximo quadro do servidor.
 */
export function createMatch(level: Level, players: number, now: number) {
  const tl = createTimeline(level, players, -1);
  let t0 = now + COUNTDOWN_MS;
  let paused = false;
  let pending: Change[] = [];
  let resets: number[] = [];
  let outChanges: Change[] = [];
  let outResets: number[] = [];
  let lastSent = 0;
  const lastAt = Array<number>(players).fill(0);

  const virtualFrame = (now: number) => (now - t0) / STEP_MS;

  return {
    world: () => tl.world(),
    frame: () => tl.frame(),
    virtualFrame,

    input(seat: number, f: number, bits: number, now: number): boolean {
      if (f > virtualFrame(now) + MAX_FUTURE) return false;
      // nunca no passado e nunca antes de um input anterior do mesmo assento
      const fAt = Math.max(f, tl.frame() + 1, lastAt[seat]);
      lastAt[seat] = fAt;
      pending = [...pending.filter(([pf, ps]) => !(pf === fAt && ps === seat)), [fAt, seat, bits]];
      return true;
    },

    restart() {
      const fAt = tl.frame() + 1;
      if (!resets.includes(fAt)) resets.push(fAt);
    },

    pause() {
      paused = true;
    },

    resume(now: number): ServerMsg {
      paused = false;
      t0 = now + COUNTDOWN_MS - tl.frame() * STEP_MS;
      return { t: "resume", s: tl.frame(), inMs: COUNTDOWN_MS };
    },

    snapshot(): ServerMsg {
      return { t: "snapshot", s: tl.frame(), world: worldToJson(tl.world()), bits: tl.bits() };
    },

    tick(now: number): ServerMsg[] {
      if (paused) return [];
      const due = Math.min(Math.floor(virtualFrame(now)), tl.frame() + MAX_CATCH_UP);
      while (tl.frame() < due && tl.world().status === "playing") {
        const f = tl.frame() + 1;
        const changes = pending.filter(([pf]) => pf === f);
        pending = pending.filter(([pf]) => pf !== f);
        const rs = resets.filter((r) => r === f);
        resets = resets.filter((r) => r !== f);
        tl.confirm(f, changes, rs);
        outChanges.push(...changes);
        outResets.push(...rs);
      }
      const s = tl.frame();
      const ended = tl.world().status === "cleared";
      if (s === lastSent || (s - lastSent < TICK_EVERY && !ended)) return [];
      const msgs: ServerMsg[] = [{ t: "tick", s, changes: outChanges, resets: outResets }];
      if (Math.floor(s / HASH_EVERY) > Math.floor(lastSent / HASH_EVERY)) msgs.push({ t: "hash", s, h: tl.hash() });
      outChanges = [];
      outResets = [];
      lastSent = s;
      return msgs;
    },
  };
}
