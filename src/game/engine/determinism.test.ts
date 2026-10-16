import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Funções com resultado idêntico em qualquer engine JS (IEEE 754 com arredondamento correto). */
const ALLOWED = new Set(["abs", "ceil", "floor", "max", "min", "round", "sign", "sqrt", "trunc", "imul"]);

describe("determinismo da engine", () => {
  it("só usa funções Math determinísticas (a simulação roda igual no servidor e em todo navegador)", () => {
    const dir = path.join(__dirname);
    const used = readdirSync(dir)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
      .flatMap((f) => [...readFileSync(path.join(dir, f), "utf8").matchAll(/Math\.(\w+)/g)].map((m) => `${f}: Math.${m[1]}`))
      .filter((u) => !ALLOWED.has(u.split("Math.")[1]));
    expect(used).toEqual([]);
  });
});
