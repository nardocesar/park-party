import { describe, expect, it } from "vitest";
import { unlockedIds } from "./progress";

describe("desbloqueio de fases", () => {
  const levels = [{ id: 10 }, { id: 11 }, { id: 12 }];

  it("só a primeira fase abre sem nada concluído", () => {
    expect(unlockedIds(levels, new Set())).toEqual(new Set([10]));
  });

  it("concluir uma fase abre a seguinte", () => {
    expect(unlockedIds(levels, new Set([10]))).toEqual(new Set([10, 11]));
  });

  it("fase já concluída continua aberta, mesmo fora de ordem; fases puladas seguem fechadas", () => {
    expect(unlockedIds([...levels, { id: 13 }], new Set([11]))).toEqual(new Set([10, 11, 12]));
  });
});
