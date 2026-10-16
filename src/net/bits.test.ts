import { describe, expect, it } from "vitest";
import { decodeInput, DOWN, encodeInput, JUMP, LEFT, RIGHT } from "./bits";

describe("input em bits", () => {
  it("ida e volta para as 16 combinações", () => {
    for (let b = 0; b < 16; b++) expect(encodeInput(decodeInput(b))).toBe(b);
  });
  it("cada tecla tem um bit", () => {
    expect(decodeInput(LEFT | JUMP)).toEqual({ left: true, right: false, jump: true, down: false });
    expect(encodeInput({ left: false, right: true, jump: false })).toBe(RIGHT);
    expect(encodeInput({ left: false, right: false, jump: false, down: true })).toBe(DOWN);
  });
});
