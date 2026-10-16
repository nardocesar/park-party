import { afterEach, describe, expect, it, vi } from "vitest";
import { readSoloInput } from "./input";

const pad = (axes: number[], pressed: number[]) => ({
  axes,
  buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: pressed.includes(i) })),
});
const NONE = { left: false, right: false, jump: false, down: false };

describe("entrada (um jogador por dispositivo)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("setas ou WASD, mais qualquer controle", () => {
    vi.stubGlobal("navigator", { getGamepads: () => [null, pad([0.9, 0], [0])] });
    expect(readSoloInput(new Set(["KeyA"]))).toEqual({ left: true, right: true, jump: true, down: false });
    vi.stubGlobal("navigator", { getGamepads: () => [] });
    expect(readSoloInput(new Set(["ArrowUp", "ArrowDown"]))).toEqual({ left: false, right: false, jump: true, down: true });
  });

  it("controle: analógico, d-pad e botão A", () => {
    vi.stubGlobal("navigator", { getGamepads: () => [pad([-0.9], [])] });
    expect(readSoloInput(new Set())).toEqual({ ...NONE, left: true });
    vi.stubGlobal("navigator", { getGamepads: () => [pad([0], [15, 0])] });
    expect(readSoloInput(new Set())).toEqual({ ...NONE, right: true, jump: true });
  });

  it("zona morta do analógico ignora toque leve", () => {
    vi.stubGlobal("navigator", { getGamepads: () => [pad([0.2], [])] });
    expect(readSoloInput(new Set())).toEqual(NONE);
  });

  it("baixo: S no teclado e d-pad/analógico para baixo no controle", () => {
    vi.stubGlobal("navigator", { getGamepads: () => [] });
    expect(readSoloInput(new Set(["KeyS"]))).toEqual({ ...NONE, down: true });
    vi.stubGlobal("navigator", { getGamepads: () => [pad([0, 0.9], [])] });
    expect(readSoloInput(new Set())).toEqual({ ...NONE, down: true });
    vi.stubGlobal("navigator", { getGamepads: () => [pad([0, 0], [13])] });
    expect(readSoloInput(new Set())).toEqual({ ...NONE, down: true });
  });

  it("sem navegador (servidor): só o teclado conta", () => {
    vi.stubGlobal("navigator", undefined);
    expect(readSoloInput(new Set(["KeyD"]))).toEqual({ ...NONE, right: true });
  });
});
