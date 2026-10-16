import { describe, expect, it } from "vitest";
import { createClock, STEP_MS } from "./clock";

describe("relógio da partida", () => {
  it("sem amostra não está pronto", () => {
    expect(createClock().ready()).toBe(false);
  });

  it("estima o quadro do servidor e roda à frente meia volta + 2 quadros", () => {
    const c = createClock();
    // ping saiu em 1000, voltou em 1100 (RTT 100), servidor estava no quadro 30
    c.sample(1000, 1100, 30);
    expect(c.rtt()).toBe(100);
    // em 1100 o servidor já andou meia volta (50 ms = 3 quadros): ~33
    expect(c.serverFrame(1100)).toBeCloseTo(30 + 50 / STEP_MS, 6);
    // alvo = servidor (33) + meia volta (3) + folga (2) = 38
    expect(c.target(1105)).toBe(38);
  });

  it("usa a amostra de menor RTT entre as últimas 8", () => {
    const c = createClock();
    c.sample(1000, 1100, 30);
    c.sample(2000, 2400, 80); // amostra ruim, RTT 400
    expect(c.rtt()).toBe(100);
    expect(c.target(1105)).toBe(38);
  });

  it("clear descarta as amostras (volta de pausa)", () => {
    const c = createClock();
    c.sample(0, 100, 0);
    c.clear();
    expect(c.ready()).toBe(false);
  });
});
