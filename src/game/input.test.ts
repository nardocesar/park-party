import { afterEach, describe, expect, it, vi } from "vitest";
import { deviceLabel, inputLabel, readInputs } from "./input";

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

  it("com mais de 4 jogadores: teclado nos jogadores 1–4 e os controles nos jogadores 5–8", () => {
    vi.stubGlobal("navigator", { getGamepads: () => [pad([0.9], []), null, pad([0], [0])] });
    const inputs = readInputs(new Set(["KeyA"]), 7);
    expect(inputs).toHaveLength(7);
    expect(inputs[0]).toEqual({ left: true, right: false, jump: false, down: false }); // só o teclado
    expect(inputs[4]).toEqual({ left: false, right: true, jump: false, down: false }); // controle 1
    expect(inputs[5]).toEqual({ left: false, right: false, jump: false, down: false }); // controle 2 ausente
    expect(inputs[6]).toEqual({ left: false, right: false, jump: true, down: false }); // controle 3
  });

  it("legenda de cada jogador segue a mesma regra", () => {
    expect(inputLabel(0, 4)).toBe("A D + W (S) ou controle 1");
    expect(inputLabel(0, 6)).toBe("A D + W (S)");
    expect(inputLabel(4, 6)).toBe("controle 1");
    expect(inputLabel(7, 8)).toBe("controle 4");
  });

  it("dispositivos explícitos (vindos do lobby): cada jogador ouve só o seu", () => {
    vi.stubGlobal("navigator", { getGamepads: () => [pad([0], [0])] });
    const inputs = readInputs(new Set(["KeyD", "ArrowLeft"]), [["g0"], ["k0"]]);
    expect(inputs[0]).toEqual({ left: false, right: false, jump: true, down: false });
    expect(inputs[1]).toEqual({ left: false, right: true, jump: false, down: false });
  });

  it("legenda por dispositivo", () => {
    expect(deviceLabel("k1")).toBe("← → + ↑ (↓)");
    expect(deviceLabel("g2")).toBe("controle 3");
  });
});
