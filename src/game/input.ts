import { NO_INPUT, type PlayerInput } from "./engine/world";

/** Teclas de um jogador: setas ou WASD. */
const KEYS: Record<keyof PlayerInput, string[]> = {
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  jump: ["ArrowUp", "KeyW"],
  down: ["ArrowDown", "KeyS"],
};

export function createKeyboard(target: Window) {
  const down = new Set<string>();
  const handled = new Set(Object.values(KEYS).flat());
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

/** Um jogador por dispositivo: setas ou WASD, mais qualquer controle conectado. */
export function readSoloInput(down: Set<string>): PlayerInput {
  const pads = [0, 1, 2, 3].map(readGamepad);
  const read = (k: keyof PlayerInput) => KEYS[k].some((c) => down.has(c)) || pads.some((p) => p[k]);
  return { left: read("left"), right: read("right"), jump: read("jump"), down: read("down") };
}
