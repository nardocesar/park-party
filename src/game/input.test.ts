import { afterEach, describe, expect, it, vi } from "vitest";
import { readInputs } from "./input";

const pad = (axes: number[], pressed: number[]) => ({
  axes,
  buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: pressed.includes(i) })),
});

describe("entrada", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("teclado: cada jogador tem suas teclas", () => {
    vi.stubGlobal("navigator", { getGamepads: () => [] });
    const inputs = readInputs(new Set(["KeyD", "ArrowUp", "KeyJ"]), 4);
    expect(inputs[0]).toEqual({ left: false, right: true, jump: false, down: false });
    expect(inputs[1]).toEqual({ left: false, right: false, jump: true, down: false });
    expect(inputs[2]).toEqual({ left: true, right: false, jump: false, down: false });
    expect(inputs[3]).toEqual({ left: false, right: false, jump: false, down: false });
  });

  it("gamepad N soma com o jogador N (analógico, d-pad e botão A)", () => {
    vi.stubGlobal("navigator", { getGamepads: () => [pad([-0.9], []), pad([0], [15, 0])] });
    const inputs = readInputs(new Set(), 2);
    expect(inputs[0]).toEqual({ left: true, right: false, jump: false, down: false });
    expect(inputs[1]).toEqual({ left: false, right: true, jump: true, down: false });
  });

  it("zona morta do analógico ignora toque leve", () => {
    vi.stubGlobal("navigator", { getGamepads: () => [pad([0.2], [])] });
    expect(readInputs(new Set(), 1)[0]).toEqual({ left: false, right: false, jump: false, down: false });
  });

  it("baixo: S no teclado e d-pad/analógico para baixo no gamepad", () => {
    vi.stubGlobal("navigator", { getGamepads: () => [null, pad([0, 0.9], [])] });
    const inputs = readInputs(new Set(["KeyS"]), 2);
    expect(inputs[0].down).toBe(true);
    expect(inputs[1].down).toBe(true);
  });
});
