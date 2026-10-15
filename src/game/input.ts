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

/** Teclado `k0`–`k3` (os mapas acima) ou controle `g0`–`g3`. */
export type Device = `${"k" | "g"}${0 | 1 | 2 | 3}`;
export const DEVICES: Device[] = ["k0", "k1", "k2", "k3", "g0", "g1", "g2", "g3"];

/** Qual controle (0–3) comanda o jogador `i`, ou null. */
const padFor = (i: number, playerCount: number) => (playerCount > KEYMAPS.length ? (i >= KEYMAPS.length ? i - KEYMAPS.length : null) : i);

/** Dispositivos do jogador `i` sem lobby: teclado N + controle N (com mais de 4, controles nos jogadores 5–8). */
export function defaultDevices(i: number, playerCount: number): Device[] {
  const p = padFor(i, playerCount);
  return [...(i < KEYMAPS.length ? [`k${i}` as Device] : []), ...(p === null ? [] : [`g${p}` as Device])];
}

export function readDevice(down: Set<string>, d: Device): PlayerInput {
  const n = Number(d[1]);
  if (d[0] === "g") return readGamepad(n);
  const m = KEYMAPS[n];
  return { left: down.has(m.left), right: down.has(m.right), jump: down.has(m.jump), down: down.has(m.down) };
}

/** Entrada de cada jogador: soma dos seus dispositivos (ou a regra padrão para `playerCount` jogadores). */
export function readInputs(down: Set<string>, players: number | Device[][]): PlayerInput[] {
  const devices = typeof players === "number" ? Array.from({ length: players }, (_, i) => defaultDevices(i, players)) : players;
  return devices.map((ds) =>
    ds.map((d) => readDevice(down, d)).reduce(
      (a, b) => ({ left: a.left || b.left, right: a.right || b.right, jump: a.jump || b.jump, down: a.down || (b.down ?? false) }),
      NO_INPUT,
    ),
  );
}

export const deviceLabel = (d: Device) => (d[0] === "k" ? KEY_LABELS[Number(d[1])] : `controle ${Number(d[1]) + 1}`);

/** Legenda dos controles do jogador `i` numa partida de `playerCount`. */
export function inputLabel(i: number, playerCount: number) {
  return defaultDevices(i, playerCount).map(deviceLabel).join(" ou ");
}
