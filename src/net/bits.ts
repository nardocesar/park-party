import type { PlayerInput } from "@/game/engine/world";

export const LEFT = 1;
export const RIGHT = 2;
export const JUMP = 4;
export const DOWN = 8;

/** Input de um jogador em 4 bits: é o que trafega na rede. */
export const encodeInput = (i: PlayerInput) =>
  (i.left ? LEFT : 0) | (i.right ? RIGHT : 0) | (i.jump ? JUMP : 0) | (i.down ? DOWN : 0);

export const decodeInput = (bits: number): PlayerInput => ({
  left: (bits & LEFT) !== 0,
  right: (bits & RIGHT) !== 0,
  jump: (bits & JUMP) !== 0,
  down: (bits & DOWN) !== 0,
});
