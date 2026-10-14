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
    expect(inputs[0]).toEqual({ left: false, right: true, jump: false });
    expect(inputs[1]).toEqual({ left: false, right: false, jump: true });
    expect(inputs[2]).toEqual({ left: true, right: false, jump: false });
    expect(inputs[3]).toEqual({ left: false, right: false, jump: false });
  });

  it("gamepad N soma com o jogador N (analógico, d-pad e botão A)", () => {
    vi.stubGlobal("navigator", { getGamepads: () => [pad([-0.9], []), pad([0], [15, 0])] });
    const inputs = readInputs(new Set(), 2);
    expect(inputs[0]).toEqual({ left: true, right: false, jump: false });
    expect(inputs[1]).toEqual({ left: false, right: true, jump: true });
  });

  it("zona morta do analógico ignora toque leve", () => {
    vi.stubGlobal("navigator", { getGamepads: () => [pad([0.2], [])] });
    expect(readInputs(new Set(), 1)[0]).toEqual({ left: false, right: false, jump: false });
  });
});
