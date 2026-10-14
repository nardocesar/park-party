import { describe, expect, it } from "vitest";
import { TILE } from "./engine/constants";
import { climbOn, crossBlinkBridge, drive, goFlip, steer, finish, goTo, jumpOnto, mid, passPiston, rapel, relay, rideRail, solo, stackHoist, waitFor, worldAt } from "./testing/bot";
import { NO_INPUT, step } from "./engine/world";

/** Fases difíceis: cada roteiro compõe trechos (empurrar, empilhar, elevador…) com 2 jogadores. */
describe("fases difíceis", () => {
  it("1-4: ponte que exige todos, caixas nos botões, torre pela chave, elevador de todos", () => {
    const w = createWorld2("1-4");
    const [a, b] = w.players;
    solo(w, [0, 1], () => w.gates[0].open === 1 && w.players.every((p) => p.x > 36 * TILE), 4000);
    expect(w.gates[0].open).toBe(1);
    // torre: a encosta no platô, b sobe nele e pula para o platô pela chave
    goTo(w, [[a, 39 * TILE - 8], [b, 37 * TILE]]);
    climbOn(w, b, a);
    jumpOnto(w, b, FLOOR - 1);
    goTo(w, [[b, mid(40)]]);
    expect(w.key.holder).toBe(1);
    // todos no elevador
    goTo(w, [[b, mid(45)], [a, mid(44)]]);
    waitFor(w, () => w.lifts[0].y === (FLOOR - 4) * TILE);
    expect(w.lifts[0].y).toBe((FLOOR - 4) * TILE);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });

  it("1-5: dois elevadores de todos e torre no patamar alto", () => {
    const w = createWorld2("1-5");
    const [a, b] = w.players;
    goTo(w, [[b, mid(12)], [a, mid(11)]]);
    waitFor(w, () => w.lifts[0].y === (FLOOR - 2) * TILE);
    goTo(w, [[b, mid(20)], [a, mid(19)]]);
    waitFor(w, () => w.lifts[1].y === (FLOOR - 4) * TILE);
    expect(w.lifts[1].y).toBe((FLOOR - 4) * TILE);
    goTo(w, [[a, 30 * TILE - 8], [b, mid(26)]]);
    climbOn(w, b, a);
    jumpOnto(w, b, 2);
    goTo(w, [[b, mid(31)]]);
    expect(w.key.holder).toBe(1);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });

  it("2-3: paredão, rapel pela chave, vala e paredão de novo", () => {
    const w = createWorld2("2-3");
    const [a, b] = w.players;
    expect(stackHoist(w, b, a, 12, FLOOR - 2)).toBe(true);
    // a terminou na frente: desce no poço; b segura e iça
    goTo(w, [[a, mid(24)], [b, mid(23)]], 900, { unstick: false });
    expect(rapel(w, a, b, 26, FLOOR + 1)).toBe(true);
    expect(w.key.holder).toBe(0);
    expect(w.resets).toBe(0);
    // atravessam juntos o poço e a vala; quem estiver na frente vira a base do segundo paredão
    solo(w, [0, 1], () => w.players.every((p) => p.x > 31 * TILE && p.onGround), 1500);
    const [front, back] = a.x > b.x ? [a, b] : [b, a];
    expect(stackHoist(w, front, back, 36, FLOOR - 2)).toBe(true);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });

  it("2-4: ponte que cai amarrados, rapel e paredão", () => {
    const w = createWorld2("2-4");
    const [a, b] = w.players;
    // colados atravessam a ponte que cai
    for (let f = 0; f < 300 && b.x + b.w < 8 * TILE - 2; f++)
      step(w, [a.x + a.w < b.x - 0.5 ? { ...NO_INPUT, right: true } : NO_INPUT, { ...NO_INPUT, right: true }]);
    for (let f = 0; f < 60 && a.x + a.w < b.x - 0.5; f++) step(w, [{ ...NO_INPUT, right: true }, NO_INPUT]);
    solo(w, [0, 1], () => w.players.every((p) => p.x > 16 * TILE && p.onGround), 900);
    expect(w.resets).toBe(0);
    goTo(w, [[b, mid(23)], [a, mid(22)]], 900, { unstick: false });
    expect(rapel(w, b, a, 25, FLOOR + 1)).toBe(true);
    expect(w.key.holder).toBe(1);
    solo(w, [0, 1], () => w.players.every((p) => p.x > 27 * TILE && p.onGround), 1500);
    const [front, back] = a.x > b.x ? [a, b] : [b, a];
    expect(stackHoist(w, front, back, 34, FLOOR - 2)).toBe(true);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });

  it("3-3: revezamento, ponte que pisca, revezamento e paredes rápidas", () => {
    const w = createWorld2("3-3");
    const [a, b] = w.players;
    expect(relay(w, b, a, 9, 15)).toBe(true);
    // a está na frente: os dois encostam na beira do buraco e atravessam na ponte
    goTo(w, [[a, mid(20)], [b, mid(19)]], 900, { unstick: false });
    crossBlinkBridge(w, 0, 50, 60);
    expect(w.resets).toBe(0);
    expect(relay(w, a, b, 30, 36)).toBe(true);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });

  it("3-4: três revezamentos de 0,9 s e duas pontes que piscam", () => {
    const w = createWorld2("3-4");
    const [a, b] = w.players;
    expect(relay(w, b, a, 8, 14)).toBe(true);
    goTo(w, [[a, mid(18)], [b, mid(17)]], 900, { unstick: false });
    crossBlinkBridge(w, 0, 50, 60);
    expect(w.resets).toBe(0);
    expect(relay(w, a, b, 29, 35)).toBe(true);
    goTo(w, [[b, mid(40)], [a, mid(39)]], 900, { unstick: false });
    crossBlinkBridge(w, 1, 45, 60);
    expect(w.resets).toBe(0);
    expect(relay(w, b, a, 51, 57)).toBe(true);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });

  /** Os dois encostam (a atrás de b) antes da ponte que cai em `col` e atravessam colados. */
  const tightBridge = (w: ReturnType<typeof createWorld2>, col: number) => {
    const [a, b] = w.players;
    for (let f = 0; f < 900 && b.x + b.w < col * TILE - 2; f++)
      step(w, [a.x + a.w < b.x - 0.5 ? { ...NO_INPUT, right: true } : NO_INPUT, { ...NO_INPUT, right: true }]);
    for (let f = 0; f < 60 && a.x + a.w < b.x - 0.5; f++) step(w, [{ ...NO_INPUT, right: true }, NO_INPUT]);
  };

  it("4-3: valas, esmagadores, ponte que cai e mais esmagadores", () => {
    const w = createWorld2("4-3");
    solo(w, [0, 1], () => w.players.every((p) => p.x > 22 * TILE && p.onGround), 3000);
    expect(w.resets).toBe(0);
    tightBridge(w, 26);
    solo(w, [0, 1], () => w.players.every((p) => p.x > 34 * TILE && p.onGround), 900);
    expect(w.resets).toBe(0);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });

  it("4-4: ponte longa sem pular, valas e esmagadores", () => {
    const w = createWorld2("4-4");
    tightBridge(w, 10);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });

  it("5-3: quatro pistões e a plataforma automática sobre espinhos", () => {
    const w = createWorld2("5-3");
    expect(passPiston(w, 0, 7, 14)).toBe(true);
    expect(passPiston(w, 1, 15, 22)).toBe(true);
    expect(w.resets).toBe(0);
    goTo(w, [[w.players[1], mid(23)], [w.players[0], mid(22)]], 600, { unstick: false });
    expect(rideRail(w, 0, [25, 24])).toBe(true);
    goTo(w, [[w.players[1], mid(41)], [w.players[0], mid(40)]], 600, { unstick: false });
    expect(w.resets).toBe(0);
    expect(passPiston(w, 2, 43, 50)).toBe(true);
    expect(passPiston(w, 3, 51, 58)).toBe(true);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });

  it("5-4: trilho de todos, pistões e elevador de todos", () => {
    const w = createWorld2("5-4");
    expect(rideRail(w, 0, [7, 8])).toBe(true);
    // descem juntos do trilho (que exige todos e volta quando alguém sai)
    goTo(w, [[w.players[1], mid(31)], [w.players[0], mid(30)]], 600, { unstick: false });
    expect(w.resets).toBe(0);
    expect(passPiston(w, 0, 34, 41)).toBe(true);
    expect(passPiston(w, 1, 42, 49)).toBe(true);
    goTo(w, [[w.players[0], mid(52)], [w.players[1], mid(53)]], 900, { unstick: false });
    waitFor(w, () => w.lifts[0].y === (FLOOR - 4) * TILE, 900);
    expect(w.lifts[0].y).toBe((FLOOR - 4) * TILE);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });

  const onRow = (p: { onGround: boolean; y: number; h: number }, row: number) => p.onGround && Math.abs(p.y + p.h - row * TILE) < 0.01;

  it("6-3: vento contrário sobre valas e revezamento no ventilador", () => {
    const w = createWorld2("6-3");
    solo(w, [0, 1], () => w.players.every((p) => p.x > 28 * TILE && p.onGround), 3000);
    expect(w.resets).toBe(0);
    const [front, back] = w.players[0].x > w.players[1].x ? [w.players[0], w.players[1]] : [w.players[1], w.players[0]];
    const s = steer();
    // quem está atrás segura o botão de baixo; o da frente sobe e liga o botão de cima
    drive(w, (q) => (q === back ? s(q, mid(30)) : q === front ? s(q, mid(34), { unstick: false }) : NO_INPUT), () => front.y < 2 * TILE, 900);
    drive(w, (q) => (q === front ? s(q, mid(40), { unstick: false }) : NO_INPUT), () => onRow(front, 3) && Math.abs(front.x + front.w / 2 - mid(40)) <= 1, 600);
    expect(w.switches[1].on).toBe(true);
    drive(w, (q) => (q === back ? s(q, mid(34), { unstick: false }) : NO_INPUT), () => back.y < 2 * TILE, 900);
    drive(w, (q) => (q === back ? s(q, mid(38), { unstick: false }) : NO_INPUT), () => onRow(back, 3), 300);
    expect(onRow(back, 3)).toBe(true);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });

  it("6-4: corrente e faixa lateral, depois vento contrário com esmagadores", () => {
    const w = createWorld2("6-4");
    const spots = [mid(9), mid(10)];
    const s = steer();
    drive(w, (q, i) => s(q, spots[i]), () => w.players.every((p, i) => Math.abs(p.x + p.w / 2 - spots[i]) <= 1 && p.onGround), 900);
    drive(w, (q, i) => ({ ...s(q, spots[i], { unstick: false }), jump: false }), () => w.players.every((p) => p.y < 4 * TILE), 300);
    drive(w, () => ({ ...NO_INPUT, right: true }), () => w.players.every((p) => onRow(p, FLOOR - 4)), 900);
    expect(w.resets).toBe(0);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });

  /** `p` vai até o trampolim da coluna `col` (pula nele se preciso) e, sem tocar nos controles, voa até pousar. */
  const bounce = (w: ReturnType<typeof createWorld2>, p: (typeof w.players)[number], col: number, hold = false) => {
    const s = steer();
    drive(w, (q) => (q === p ? s(q, mid(col)) : NO_INPUT), () => p.vy < -6, 900); // mola lança a −7 ou mais (pulo normal é −5,1)
    drive(w, (q) => (q === p && hold ? { ...NO_INPUT, right: true, jump: q.vy < 0 } : NO_INPUT), () => p.onGround && p.vy === 0, 200);
    return p.onGround;
  };

  it("7-3: corrente de trampolins diagonais sobre espinhos", () => {
    const w = createWorld2("7-3");
    const [a, b] = w.players;
    for (const col of [8, 15, 22, 29]) {
      const [front, back] = a.x > b.x ? [a, b] : [b, a];
      bounce(w, front, col);
      expect(w.resets).toBe(0);
      bounce(w, back, col);
      expect(w.resets).toBe(0);
    }
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });

  it("7-4: torre de molas com três trampolins e revezamentos", () => {
    const w = createWorld2("7-4");
    const [a, b] = w.players;
    const s = steer();
    const hold = (p: typeof a, col: number) => drive(w, (q) => (q === p ? s(q, mid(col)) : NO_INPUT), () => Math.abs(p.x + p.w / 2 - mid(col)) <= 1 && p.onGround, 900);
    bounce(w, b, 11, true);
    hold(b, 18); // sai do ponto de pouso
    bounce(w, a, 11, true);
    expect(onRow(a, FLOOR - 1) && onRow(b, FLOOR - 1)).toBe(true);
    // a segura o botão do meio; b sobe pela segunda mola e segura o do topo; a sobe
    hold(a, 16);
    bounce(w, b, 21, true);
    hold(b, 28);
    bounce(w, a, 21, true);
    expect(onRow(a, FLOOR - 5) && onRow(b, FLOOR - 5)).toBe(true);
    // a segura o botão "far" do topo; b voa pela terceira mola e segura o da plataforma; a voa
    hold(a, 26);
    bounce(w, b, 34);
    expect(w.resets).toBe(0);
    hold(b, 44);
    bounce(w, a, 34);
    expect(w.resets).toBe(0);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });

  it("8-3: seis inversões com a chave pendurada no meio", () => {
    const w = createWorld2("8-3");
    for (const col of [8, 17, 27, 37, 47, 57]) {
      expect(goFlip(w, [col - 1, col], [true, true])).toBe(true);
      expect(w.resets).toBe(0);
    }
    expect(w.key.holder).not.toBeNull();
    expect(w.players.every((p) => p.gravDir === 1)).toBe(true);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });

  it("8-4: dois espelhos de botões trocando de lado e o poço final pelo teto", () => {
    const w = createWorld2("8-4");
    const both = (cols: number[]) => {
      const byX = [...w.players].sort((p, q) => p.x - q.x);
      return goTo(w, byX.map((p, i) => [p, mid(cols[i])] as [(typeof byX)[number], number]), 1500, { unstick: false });
    };
    goFlip(w, [6, 7], [true, true]); // os dois no teto sobre o primeiro poço
    goFlip(w, [16, 17], [false, true]); // o da frente desce para o botão do chão
    both([17, 19]);
    waitFor(w, () => w.gates[0].open === 1, 200);
    expect(w.gates[0].open).toBe(1);
    // o de baixo sobe para passar os espinhos do chão; desce depois deles
    goFlip(w, [23, 24], [false, true]);
    goFlip(w, [31, 32], [false, true]);
    both([33, 35]);
    waitFor(w, () => w.gates[1].open === 1, 200);
    expect(w.gates[1].open).toBe(1);
    // o do teto desce antes dos espinhos do teto; os dois sobem para o poço final e descem depois
    goFlip(w, [39, 40], [true, false]);
    both([48, 51]);
    goFlip(w, [52, 53], [true, true]);
    goFlip(w, [59, 60], [true, true]);
    expect(w.resets).toBe(0);
    expect(w.players.every((p) => p.gravDir === 1)).toBe(true);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });

  /** `p` anda até `col` sem pular (passando por baixo de portais-armadilha). */
  const walkOnly = (w: ReturnType<typeof createWorld2>, p: (typeof w.players)[number], col: number) => {
    const s = steer();
    return drive(w, (q) => (q === p ? s(q, mid(col), { unstick: false }) : NO_INPUT), () => Math.abs(p.x + p.w / 2 - mid(col)) <= 1 && p.onGround, 900);
  };
  /** `p` anda para a direita e pula uma vez quando a borda direita passa de `jumpAtX` (px). */
  const jumpAt = (w: ReturnType<typeof createWorld2>, p: (typeof w.players)[number], jumpAtX: number, untilX: number) => {
    let jumped = false;
    return drive(
      w,
      (q) => {
        if (q !== p) return NO_INPUT;
        const jump = !jumped && q.onGround && q.x + q.w >= jumpAtX;
        if (jump) jumped = true;
        return { ...NO_INPUT, right: true, jump: jump || (!q.onGround && q.vy < 0) };
      },
      () => p.x > untilX && p.onGround,
      900,
    );
  };

  it("9-3: revezamento pelo portal, ponte que cai, esmagador e portal de todos", () => {
    const w = createWorld2("9-3");
    const [a, b] = w.players;
    const s = steer();
    // b segura o botão de baixo; a passa o portão e o portal e segura o botão do outro lado
    drive(w, (q) => (q === b ? s(q, mid(9)) : NO_INPUT), () => Math.abs(b.x + b.w / 2 - mid(9)) <= 1, 900);
    drive(w, (q) => (q === a ? s(q, mid(18)) : NO_INPUT), () => a.x > 23 * TILE, 900);
    walkOnly(w, a, 26);
    expect(w.switches[1].on).toBe(true);
    drive(w, (q) => (q === b ? s(q, mid(18)) : NO_INPUT), () => b.x > 23 * TILE, 900);
    expect(w.resets).toBe(0);
    // ponte que cai colados (b atrás de a)
    goTo(w, [[a, mid(28)], [b, mid(27)]], 900, { unstick: false });
    for (let f = 0; f < 60 && b.x + b.w < a.x - 0.5; f++) step(w, [NO_INPUT, { ...NO_INPUT, right: true }]);
    drive(w, () => ({ ...NO_INPUT, right: true }), () => w.players.every((p) => p.x > 36 * TILE), 300);
    expect(w.resets).toBe(0);
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });

  it("9-4: labirinto sem pular sob as armadilhas", () => {
    const w = createWorld2("9-4");
    const [a, b] = w.players;
    /** `p` anda para a direita sem pular até passar de `x` (px). */
    const walkPast = (p: (typeof w.players)[number], x: number) =>
      drive(w, (q) => (q === p ? { ...NO_INPUT, right: true } : NO_INPUT), () => p.x > x && p.onGround, 900);
    for (const p of [b, a]) {
      walkPast(p, 13 * TILE); // portal da sala 1
      walkOnly(w, p, 18);
      jumpAt(w, p, 19.4 * TILE, 21 * TILE); // pula o degrau longe das armadilhas
      walkPast(p, 27 * TILE); // portal para a sala 3
      expect(w.resets).toBe(0);
    }
    expect(finish(w)).toBe("cleared");
    expect(w.resets).toBe(0);
  });
});

const FLOOR = 8;
function createWorld2(slug: string) {
  return worldAt(slug, 2);
}
