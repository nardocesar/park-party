import { MAX_PLAYERS } from "./engine/constants";

/** Próximo cowboy livre a partir de `from`, andando `dir` (dá a volta); null se não houver. */
export function nextFreeCowboy(taken: number[], from: number, dir: 1 | -1): number | null {
  const used = new Set(taken);
  for (let k = 1; k <= MAX_PLAYERS; k++) {
    const c = (((from + dir * k) % MAX_PLAYERS) + MAX_PLAYERS) % MAX_PLAYERS;
    if (!used.has(c)) return c;
  }
  return null;
}
