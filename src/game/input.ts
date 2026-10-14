import { NO_INPUT, type PlayerInput } from "./engine/world";

type KeyMap = { left: string; right: string; jump: string; down: string };

/** Teclado compartilhado: até 4 jogadores. O gamepad N soma com o jogador N. */
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

export function readInputs(down: Set<string>, playerCount: number): PlayerInput[] {
  return Array.from({ length: playerCount }, (_, i) => {
    const m = KEYMAPS[i];
    const pad = readGamepad(i);
    return {
      left: down.has(m.left) || pad.left,
      right: down.has(m.right) || pad.right,
      jump: down.has(m.jump) || pad.jump,
      down: down.has(m.down) || (pad.down ?? false),
    };
  });
}
