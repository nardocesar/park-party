import { NO_INPUT, type PlayerInput } from "./engine/world";

type KeyMap = { left: string; right: string; jump: string; down: string };

/**
 * Teclado compartilhado: até 4 jogadores. Até 4 jogadores, o controle N soma com o jogador N;
 * com mais de 4, os controles 1–4 viram os jogadores 5–8 (um teclado não aguenta 8 pessoas).
 */
export const KEYMAPS: KeyMap[] = [
  { left: "KeyA", right: "KeyD", jump: "KeyW", down: "KeyS" },
  { left: "ArrowLeft", right: "ArrowRight", jump: "ArrowUp", down: "ArrowDown" },
  { left: "KeyJ", right: "KeyL", jump: "KeyI", down: "KeyK" },
  { left: "Numpad4", right: "Numpad6", jump: "Numpad8", down: "Numpad5" },
];

export const KEY_LABELS = ["A D + W (S)", "← → + ↑ (↓)", "J L + I (K)", "Num 4 6 + 8 (5)"];

export function createKeyboard(target: Window) {
  const down = new Set<string>();
  const handled = new Set(KEYMAPS.flatMap((m) => [m.left, m.right, m.jump, m.down]));
  const onDown = (e: KeyboardEvent) => {
    if (handled.has(e.code)) e.preventDefault();
    down.add(e.code);
  };
  const onUp = (e: KeyboardEvent) => down.delete(e.code);
  const onBlur = () => down.clear();
  target.addEventListener("keydown", onDown);
  target.addEventListener("keyup", onUp);
  target.addEventListener("blur", onBlur);
  return {
    down,
    dispose() {
      target.removeEventListener("keydown", onDown);
      target.removeEventListener("keyup", onUp);
      target.removeEventListener("blur", onBlur);
    },
  };
}

function readGamepad(index: number): PlayerInput {
  const pad = typeof navigator !== "undefined" ? navigator.getGamepads?.()[index] : null;
  if (!pad) return NO_INPUT;
  const x = pad.axes[0] ?? 0;
  const y = pad.axes[1] ?? 0;
  const pressed = (b: number) => pad.buttons[b]?.pressed ?? false;
  return { left: x < -0.4 || pressed(14), right: x > 0.4 || pressed(15), jump: pressed(0), down: y > 0.6 || pressed(13) };
}

/** Qual controle (0–3) comanda o jogador `i`, ou null. */
const padFor = (i: number, playerCount: number) => (playerCount > KEYMAPS.length ? (i >= KEYMAPS.length ? i - KEYMAPS.length : null) : i);

export function readInputs(down: Set<string>, playerCount: number): PlayerInput[] {
  return Array.from({ length: playerCount }, (_, i) => {
    const m = KEYMAPS[i];
    const p = padFor(i, playerCount);
    const pad = p === null ? NO_INPUT : readGamepad(p);
    const key = (code: string | undefined) => code !== undefined && down.has(code);
    return {
      left: key(m?.left) || pad.left,
      right: key(m?.right) || pad.right,
      jump: key(m?.jump) || pad.jump,
      down: key(m?.down) || (pad.down ?? false),
    };
  });
}

/** Legenda dos controles do jogador `i` numa partida de `playerCount`. */
export function inputLabel(i: number, playerCount: number) {
  const p = padFor(i, playerCount);
  const keys = KEY_LABELS[i];
  if (keys && p !== null) return `${keys} ou controle ${p + 1}`;
  return keys ?? `controle ${(p ?? 0) + 1}`;
}
