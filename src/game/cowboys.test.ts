import { describe, expect, it } from "vitest";
import { nextFreeCowboy } from "./cowboys";

describe("próximo cowboy livre", () => {
  it("anda na direção pedida pulando os ocupados e dá a volta", () => {
    expect(nextFreeCowboy([], -1, 1)).toBe(0);
    expect(nextFreeCowboy([0, 1], 0, 1)).toBe(2);
    expect(nextFreeCowboy([0, 7], 0, -1)).toBe(6);
  });
  it("null quando os 8 estão ocupados", () => {
    expect(nextFreeCowboy([0, 1, 2, 3, 4, 5, 6, 7], 0, 1)).toBeNull();
  });
});
