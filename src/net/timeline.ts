import type { Level } from "@/game/engine/level";
import { cloneWorld, hashWorld, worldFromJson } from "@/game/engine/snapshot";
import { createWorld, resetWorld, step, type GameEvent, type World } from "@/game/engine/world";
import { decodeInput } from "./bits";

/** Mudança de input: a partir do quadro `f`, o assento `seat` segura `bits`. */
export type Change = [f: number, seat: number, bits: number];

/** Quantos quadros, no máximo, a previsão corre à frente do confirmado. */
export const MAX_AHEAD = 60;

export type Timeline = ReturnType<typeof createTimeline>;

/**
 * Rollback. O quadro 0 é o mundo recém-criado; o quadro f é o estado depois do f-ésimo `step`.
 * O confirmado só avança com o que o servidor manda; a previsão parte dele a cada chamada,
 * com o input local real e o último input conhecido dos outros. `mySeat = -1` no servidor.
 */
export function createTimeline(level: Level, players: number, mySeat: number) {
  let confirmed = createWorld(level, players);
  let frame = 0;
  let bits = Array<number>(players).fill(0);
  /** Mudanças locais ainda à frente do confirmado, em ordem: [quadro, bits]. */
  let own: [number, number][] = [];
  /** Bits locais da última mudança que já ficou para trás do confirmado. */
  let ownSettled = 0;
  /** Último quadro cujos eventos já tocaram. */
  let sounded = 0;

  const settleOwn = () => {
    for (const [f, b] of own) if (f <= frame) ownSettled = b;
    own = own.filter(([f]) => f > frame);
  };

  return {
    frame: () => frame,
    world: () => confirmed,
    bits: () => [...bits],
    hash: () => hashWorld(confirmed),

    confirm(s: number, changes: Change[], resets: number[]) {
      for (let f = frame + 1; f <= s; f++) {
        for (const [cf, seat, b] of changes) if (cf === f) bits[seat] = b;
        if (resets.includes(f)) resetWorld(confirmed);
        step(confirmed, bits.map(decodeInput));
      }
      frame = Math.max(frame, s);
      settleOwn();
    },

    load(s: number, json: string, held: number[]) {
      confirmed = worldFromJson(json, level);
      frame = s;
      bits = [...held];
      sounded = Math.max(sounded, s);
      settleOwn();
    },

    setOwn(f: number, b: number) {
      const last = own.at(-1);
      if (last && last[0] === f) last[1] = b;
      else own.push([f, b]);
    },

    predict(target: number): { world: World; frame: number; events: GameEvent[] } {
      const to = Math.max(frame, Math.min(target, frame + MAX_AHEAD));
      const world = cloneWorld(confirmed);
      const held = [...bits];
      const events: GameEvent[] = [];
      let mine = ownSettled;
      let k = 0;
      for (let f = frame + 1; f <= to; f++) {
        while (k < own.length && own[k][0] <= f) mine = own[k++][1];
        if (mySeat >= 0) held[mySeat] = mine;
        step(world, held.map(decodeInput));
        if (f > sounded) events.push(...world.events);
      }
      sounded = Math.max(sounded, to);
      return { world, frame: to, events };
    },
  };
}
