// Unidades: px lógicos, velocidades por frame a 60 Hz, Y para baixo.
// Origem de cada valor em docs/re/00-overview.md.

export const FPS = 60;
export const TILE = 16;

// Observado: Game.SideAction (const no global-metadata.dat)
export const GRAVITY = 0.65;
export const GRAVITY_WEAK = 0.5;
export const GRAVITY_MAX = 19.5;
export const AIR_RESISTIVITY = 0.98;
export const JUMP_VELO = -5.1;
export const ENABLE_JUMP_SEC = 0.07;

// Escolhas de design (valores FP do Quantum ainda desconhecidos)
export const COYOTE_FRAMES = Math.round(ENABLE_JUMP_SEC * FPS);
export const PLAYER_SIZE = 14;
export const WALK_SPEED = 1.5;
export const KEY_SIZE = 10;
export const KEY_EXCLUDE_FRAMES = Math.round(0.5 * FPS);
export const DOOR_W = 16;
export const DOOR_H = 24;
export const VIEW_W = 320;
export const VIEW_H = 180;
export const MAX_PLAYERS = 4;
export const BOX_SPEED = 0.75;
export const SWITCH_H = 4;
export const GATE_SPEED = 1;
export const LIFT_SPEED = 0.5;
export const LIFT_WAIT_FRAMES = 60;

// Observado: DistanceConstraintComponent (.cctor 0x21e6a40) — docs/re/02-rope.md
export const ROPE_K = 0.2;
/** RESULT_Y_MAX = 20.15 em unidades do jogo (jogador de colisão 46 de altura), convertido para px. */
export const ROPE_RESULT_Y_MAX = (20.15 * PLAYER_SIZE) / 46;

// Observado: FallBoxComponent.WAIT_TIME_DEFAULT (literal "0.22") — docs/re/04-fall-thorn.md
export const FALL_WAIT = 0.22;
/**
 * Área mortal do espinho apontando para cima, por célula (px, origem no canto superior esquerdo).
 * Observado: ThornComponent.CollisionTable (.cctor 0x20e5bf4) — base 24×6 a 2..8 da base da
 * célula e ponta 8×8 a 10..18, em unidades de célula 32; aqui ×0,5.
 */
export const THORN_RECTS_UP = [
  { x: 2, y: TILE - 4, w: 12, h: 3 },
  { x: 6, y: TILE - 9, w: 4, h: 4 },
];
