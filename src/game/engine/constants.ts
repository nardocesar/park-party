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
