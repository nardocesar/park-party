/** Inputs pseudoaleatórios reprodutíveis: cada jogador segura uma combinação por 5–40 quadros. */
export function fuzzInputs(seed: number, players: number, frames: number): number[][] {
  let s = seed >>> 0;
  const rand = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const held = Array<number>(players).fill(0);
  const left = Array<number>(players).fill(0);
  const out: number[][] = [];
  for (let f = 0; f < frames; f++) {
    for (let p = 0; p < players; p++) {
      if (left[p]-- <= 0) {
        held[p] = Math.floor(rand() * 16);
        left[p] = 5 + Math.floor(rand() * 35);
      }
    }
    out.push([...held]);
  }
  return out;
}
