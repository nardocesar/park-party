import { describe, expect, it } from "vitest";
import { GRAVITY, JUMP_VELO, PLAYER_SIZE, TILE } from "./constants";
import { parseLevel } from "./level";
import { createWorld, NO_INPUT, step, type PlayerInput } from "./world";

const RIGHT: PlayerInput = { ...NO_INPUT, right: true };
const LEFT: PlayerInput = { ...NO_INPUT, left: true };
const JUMP: PlayerInput = { ...NO_INPUT, jump: true };

function run(world: ReturnType<typeof createWorld>, frames: number, inputs: PlayerInput[] | ((f: number) => PlayerInput[])) {
  for (let f = 0; f < frames; f++) step(world, typeof inputs === "function" ? inputs(f) : inputs);
}

const FLAT = parseLevel({
  name: "flat",
  map: [
    "#..................#",
    "#..................#",
    "#..................#",
    "#..................#",
    "#.1.2..............#",
    "####################",
  ],
});

describe("movimento e pulo", () => {
  it("cai e pousa no chão", () => {
    const w = createWorld(FLAT, 1);
    w.players[0].y -= 20;
    run(w, 60, [NO_INPUT]);
    const p = w.players[0];
    expect(p.onGround).toBe(true);
    expect(p.y + p.h).toBe(5 * TILE);
    expect(p.vy).toBe(0);
  });

  it("anda para a direita e para ao soltar", () => {
    const w = createWorld(FLAT, 1);
    const x0 = w.players[0].x;
    run(w, 10, [RIGHT]);
    expect(w.players[0].x).toBeGreaterThan(x0 + 10);
    const x1 = w.players[0].x;
    run(w, 5, [NO_INPUT]);
    expect(w.players[0].x).toBe(x1);
  });

  it("parede bloqueia o movimento", () => {
    const w = createWorld(FLAT, 1);
    run(w, 120, [LEFT]);
    expect(w.players[0].x).toBe(TILE);
  });

  it("pulo segurado chega ~26px e pulo tocado ~20px (GRAVITY_WEAK vs GRAVITY)", () => {
    const apex = (hold: boolean) => {
      const w = createWorld(FLAT, 1);
      const y0 = w.players[0].y;
      let minY = y0;
      for (let f = 0; f < 60; f++) {
        step(w, [hold || f === 0 ? JUMP : NO_INPUT]);
        minY = Math.min(minY, w.players[0].y);
      }
      return y0 - minY;
    };
    const tapped = apex(false);
    const held = apex(true);
    expect(tapped).toBeGreaterThan(17);
    expect(tapped).toBeLessThan(23);
    expect(held).toBeGreaterThan(22);
    expect(held).toBeLessThan(30);
    expect(JUMP_VELO).toBeLessThan(0);
    expect(GRAVITY).toBeCloseTo(0.65);
  });

  it("não pula de novo segurando o botão (precisa soltar)", () => {
    const w = createWorld(FLAT, 1);
    run(w, 90, [JUMP]);
    expect(w.players[0].onGround).toBe(true);
  });

  it("coyote time: pula até ~4 frames depois de sair da borda", () => {
    const level = parseLevel({
      name: "ledge",
      map: [
        "#..........#",
        "#..........#",
        "#..........#",
        "#.1........#",
        "####.......#",
        "#..........#",
        "#..........#",
        "############",
      ],
    });
    const w = createWorld(level, 1);
    // anda até cair da borda
    let left = -1;
    for (let f = 0; f < 120 && left < 0; f++) {
      step(w, [RIGHT]);
      if (!w.players[0].onGround) left = f;
    }
    expect(left).toBeGreaterThan(0);
    step(w, [RIGHT]);
    step(w, [{ ...RIGHT, jump: true }]);
    expect(w.players[0].vy).toBeLessThan(0);
  });
});

describe("empilhar jogadores", () => {
  it("jogador pousa em cima de outro", () => {
    const w = createWorld(FLAT, 2);
    const [a, b] = w.players;
    b.x = a.x;
    b.y = a.y - 40;
    run(w, 60, [NO_INPUT, NO_INPUT]);
    expect(b.y + b.h).toBe(a.y);
    expect(b.onGround).toBe(true);
  });

  it("jogador de cima é carregado quando o de baixo anda", () => {
    const w = createWorld(FLAT, 2);
    const [a, b] = w.players;
    b.x = a.x;
    b.y = a.y - PLAYER_SIZE;
    run(w, 2, [NO_INPUT, NO_INPUT]);
    const dxA = a.x;
    run(w, 10, [RIGHT, NO_INPUT]);
    expect(a.x - dxA).toBeGreaterThan(10);
    expect(b.x).toBe(a.x);
  });

  it("jogadores se bloqueiam horizontalmente", () => {
    const w = createWorld(FLAT, 2);
    const [a, b] = w.players;
    run(w, 60, [RIGHT, NO_INPUT]);
    expect(a.x + a.w).toBeLessThanOrEqual(b.x);
  });

  const WALL2 = parseLevel({
    name: "wall2",
    map: [
      "#............#",
      "#............#",
      "#............#",
      "#............#",
      "#.......######",
      "#.1.2...######",
      "##############",
    ],
  });

  it("sozinho não sobe parede de 2 tiles", () => {
    const w = createWorld(WALL2, 1);
    run(w, 200, (f) => [{ ...RIGHT, jump: f % 30 < 15 }]);
    expect(w.players[0].x + w.players[0].w).toBeLessThanOrEqual(8 * TILE);
  });

  it("subindo em outro jogador, sobe parede de 2 tiles", () => {
    const w = createWorld(WALL2, 2);
    const [a, b] = w.players;
    // a fica parado encostado na parede; b sobe em a e pula para a parede
    a.x = 8 * TILE - a.w;
    b.x = a.x;
    b.y = a.y - PLAYER_SIZE - 2;
    run(w, 10, [NO_INPUT, NO_INPUT]);
    run(w, 60, (f) => [NO_INPUT, { ...RIGHT, jump: f < 12 }]);
    expect(b.y + b.h).toBe(4 * TILE);
    expect(b.x).toBeGreaterThan(8 * TILE);
  });
});

describe("chave, porta e vitória", () => {
  const ROOM = parseLevel({
    name: "room",
    map: [
      "#..................#",
      "#..................#",
      "#..................#",
      "#..................#",
      "#.1.2....K.......D.#",
      "####################",
    ],
  });

  it("jogador pega a chave ao encostar e ela o acompanha", () => {
    const w = createWorld(ROOM, 1);
    run(w, 80, [RIGHT]);
    expect(w.key.holder).toBe(0);
    const p = w.players[0];
    run(w, 30, [RIGHT]);
    expect(Math.abs(w.key.x + w.key.w / 2 - (p.x + p.w / 2))).toBeLessThan(TILE);
  });

  it("outro jogador toma a chave ao encostar; o anterior fica excluído por um tempo", () => {
    const w = createWorld(ROOM, 2);
    w.key.holder = 0;
    w.key.x = w.players[0].x;
    w.key.y = w.players[0].y - w.key.h;
    // b encosta na chave
    w.players[1].x = w.key.x;
    w.players[1].y = w.key.y;
    step(w, [NO_INPUT, NO_INPUT]);
    expect(w.key.holder).toBe(1);
    expect(w.key.excluded).toBe(0);
  });

  it("porta abre com a chave e a fase termina quando todos entram", () => {
    const w = createWorld(ROOM, 2);
    expect(w.door.open).toBe(false);
    run(w, 400, [RIGHT, RIGHT]);
    expect(w.door.open).toBe(true);
    expect(w.players.every((p) => p.cleared)).toBe(true);
    expect(w.status).toBe("cleared");
  });

  it("um jogador só não termina a fase com dois", () => {
    const w = createWorld(ROOM, 2);
    run(w, 400, [NO_INPUT, RIGHT]);
    expect(w.door.open).toBe(true);
    expect(w.players[1].cleared).toBe(true);
    expect(w.status).toBe("playing");
  });
});

describe("morte e reset", () => {
  const PIT = parseLevel({
    name: "pit",
    map: [
      "#..........",
      "#..........",
      "#.1.2......",
      "######.....",
    ],
  });

  it("cair do mapa reinicia a fase para todos", () => {
    const w = createWorld(PIT, 2);
    const start = w.players.map((p) => ({ x: p.x, y: p.y }));
    w.players[1].x += 10;
    run(w, 300, [NO_INPUT, RIGHT]);
    // houve reset em algum momento: contador incrementa e posições voltam
    expect(w.resets).toBeGreaterThan(0);
    step(w, [NO_INPUT, NO_INPUT]);
    expect(Math.abs(w.players[0].x - start[0].x)).toBeLessThan(1);
  });
});
