import { describe, expect, it } from "vitest";
import { FALL_WAIT, GRAVITY, JUMP_VELO, LIFT_WAIT_FRAMES, MOVEWALL_IDLE, PLAYER_SIZE, TILE, VIEW_W, WALK_SPEED } from "./constants";
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

describe("caixa empurrável", () => {
  const BOXROOM = parseLevel({
    name: "boxroom",
    map: [
      "#..................#",
      "#..................#",
      "#..................#",
      "#..................#",
      "#.1.2..............#",
      "####################",
    ],
    boxes: [{ col: 8, row: 3, w: 2, h: 2, need: 2 }],
  });

  it("caixa é sólida: bloqueia e serve de chão", () => {
    const w = createWorld(BOXROOM, 2);
    run(w, 200, [NO_INPUT, RIGHT]);
    const p = w.players[1];
    expect(p.x + p.w).toBe(8 * TILE);
    p.x = 8 * TILE + 4;
    p.y = 3 * TILE - p.h - 10;
    run(w, 30, [NO_INPUT, NO_INPUT]);
    expect(p.y + p.h).toBe(3 * TILE);
    expect(p.onGround).toBe(true);
  });

  it("um jogador sozinho não move caixa que exige 2", () => {
    const w = createWorld(BOXROOM, 2);
    // a fica à frente e b atrás, longe: só a empurra
    w.players[0].x = 8 * TILE - PLAYER_SIZE - 20;
    w.players[1].x = 1 * TILE;
    run(w, 120, [RIGHT, NO_INPUT]);
    expect(w.boxes[0].x).toBe(8 * TILE);
  });

  it("dois jogadores em fila empurram a caixa", () => {
    const w = createWorld(BOXROOM, 2);
    run(w, 200, [RIGHT, RIGHT]);
    expect(w.boxes[0].x).toBeGreaterThan(8 * TILE + 20);
    // ninguém atravessa a caixa
    for (const p of w.players) expect(p.x + p.w).toBeLessThanOrEqual(w.boxes[0].x + 0.001);
  });

  it("quem está em cima da caixa é carregado quando ela anda", () => {
    const w = createWorld(BOXROOM, 3);
    const rider = w.players[2];
    rider.x = 8 * TILE + 8;
    rider.y = 3 * TILE - rider.h;
    run(w, 5, [NO_INPUT, NO_INPUT, NO_INPUT]);
    const offset = rider.x - w.boxes[0].x;
    run(w, 200, [RIGHT, RIGHT, NO_INPUT]);
    expect(w.boxes[0].x).toBeGreaterThan(8 * TILE + 20);
    expect(rider.x - w.boxes[0].x).toBeCloseTo(offset, 5);
  });

  it("caixa cai quando perde o chão", () => {
    const level = parseLevel({
      name: "boxpit",
      map: [
        "#..................#",
        "#..................#",
        "#..................#",
        "#..................#",
        "#.1.2..............#",
        "##########...#######",
        "##########...#######",
        "####################",
      ],
      boxes: [{ col: 7, row: 3, w: 2, h: 2, need: 2 }],
    });
    const w = createWorld(level, 2);
    run(w, 300, [RIGHT, RIGHT]);
    // a caixa cai no buraco (2 tiles de fundo) e vira ponte no nível do chão
    expect(w.boxes[0].y).toBe(5 * TILE);
    expect(w.resets).toBe(0);
  });
});

describe("botão e portão", () => {
  const GATED = parseLevel({
    name: "gated",
    map: [
      "#..................#",
      "#..................#",
      "#..................#",
      "#..................#",
      "#.1.2..............#",
      "####################",
    ],
    switches: [{ col: 6, row: 4, target: "g" }],
    gates: [{ id: "g", col: 12, row: 2, w: 1, h: 3 }],
    boxes: [{ col: 15, row: 3, w: 2, h: 2, need: 1 }],
  });

  it("portão fechado bloqueia a passagem", () => {
    const w = createWorld(GATED, 2);
    w.players[1].x = 9 * TILE;
    run(w, 200, [NO_INPUT, RIGHT]);
    expect(w.players[1].x + w.players[1].w).toBe(12 * TILE);
  });

  it("botão liga enquanto alguém está em cima e o portão abre", () => {
    const w = createWorld(GATED, 2);
    const [a, b] = w.players;
    a.x = 6 * TILE + 1;
    b.x = 9 * TILE;
    run(w, 5, [NO_INPUT, NO_INPUT]);
    expect(w.switches[0].on).toBe(true);
    run(w, 120, [NO_INPUT, RIGHT]);
    expect(w.gates[0].open).toBe(1);
    expect(b.x).toBeGreaterThan(12 * TILE);
  });

  it("portão volta a fechar quando o botão é solto", () => {
    const w = createWorld(GATED, 2);
    const a = w.players[0];
    a.x = 6 * TILE + 1;
    run(w, 120, [NO_INPUT, NO_INPUT]);
    expect(w.gates[0].open).toBe(1);
    run(w, 120, [RIGHT, NO_INPUT]);
    expect(w.switches[0].on).toBe(false);
    expect(w.gates[0].open).toBe(0);
  });
});

describe("elevador com peso", () => {
  const LIFTED = parseLevel({
    name: "lifted",
    map: [
      "#..................#",
      "#..................#",
      "#..................#",
      "#..................#",
      "#..................#",
      "#.1.2..............#",
      "########......######",
      "########......######",
      "########......######",
      "####################",
    ],
    lifts: [{ col: 8, row: 6, w: 6, dy: 2, need: 2 }],
  });
  const liftTop = 6 * TILE;

  it("um jogador sozinho não faz descer elevador que exige 2", () => {
    const w = createWorld(LIFTED, 2);
    w.players[0].x = 9 * TILE;
    run(w, 120, [NO_INPUT, NO_INPUT]);
    expect(w.lifts[0].y).toBe(liftTop);
    expect(w.players[0].y + w.players[0].h).toBe(liftTop);
  });

  it("dois jogadores (mesmo empilhados) fazem descer e são levados junto", () => {
    const w = createWorld(LIFTED, 2);
    const [a, b] = w.players;
    a.x = 9 * TILE;
    b.x = a.x;
    b.y = a.y - PLAYER_SIZE - 2;
    run(w, 200, [NO_INPUT, NO_INPUT]);
    expect(w.lifts[0].y).toBe(liftTop + 2 * TILE);
    expect(a.y + a.h).toBe(w.lifts[0].y);
    expect(a.onGround).toBe(true);
    expect(b.y + b.h).toBe(a.y);
  });

  it("espera um pouco no fim do curso antes de voltar (WAIT_TIME)", () => {
    const w = createWorld(LIFTED, 2);
    const [a, b] = w.players;
    a.x = 9 * TILE;
    b.x = 11 * TILE;
    run(w, 200, [NO_INPUT, NO_INPUT]);
    a.y = 6 * TILE - a.h;
    a.x = 2 * TILE;
    run(w, LIFT_WAIT_FRAMES - 5, [NO_INPUT, NO_INPUT]);
    expect(w.lifts[0].y).toBe(liftTop + 2 * TILE);
  });

  it("volta à posição inicial quando o peso sai", () => {
    const w = createWorld(LIFTED, 2);
    const [a, b] = w.players;
    a.x = 9 * TILE;
    b.x = 11 * TILE;
    run(w, 200, [NO_INPUT, NO_INPUT]);
    expect(w.lifts[0].y).toBe(liftTop + 2 * TILE);
    a.y = 6 * TILE - a.h; // tira um do elevador (teleporte para o chão firme)
    a.x = 2 * TILE;
    run(w, 300, [NO_INPUT, NO_INPUT]);
    expect(w.lifts[0].y).toBe(liftTop);
    expect(b.y + b.h).toBe(liftTop);
  });
});

describe("caixa encaixa em buraco da mesma largura", () => {
  it("cai no buraco exato mesmo com passo fracionário", () => {
    const level = parseLevel({
      name: "exactpit",
      map: [
        "#....................#",
        "#....................#",
        "#....................#",
        "#.1.2................#",
        "##########...#########",
        "##########...#########",
        "######################",
      ],
      boxes: [{ col: 6, row: 2, w: 3, h: 2, need: 2 }],
    });
    const w = createWorld(level, 2);
    run(w, 400, [RIGHT, RIGHT]);
    expect(w.boxes[0].x).toBe(10 * TILE);
    expect(w.boxes[0].y).toBe(4 * TILE);
  });
});

describe("câmera compartilhada", () => {
  const WIDE = parseLevel({
    name: "wide",
    map: ["#" + ".".repeat(58) + "#", "#" + ".".repeat(58) + "#", "#.1.2" + ".".repeat(54) + "#", "#".repeat(60)],
  });

  it("segue a média dos jogadores e a borda da tela impede que se separem", () => {
    const w = createWorld(WIDE, 2);
    const [a, b] = w.players;
    run(w, 600, [NO_INPUT, RIGHT]);
    // b anda, a fica: b para na borda direita da câmera
    expect(b.x + b.w).toBeCloseTo(w.cameraX + VIEW_W, 5);
    expect(a.x).toBeGreaterThanOrEqual(w.cameraX - 0.001);
    expect(b.x - a.x).toBeLessThanOrEqual(VIEW_W);
  });
});

describe("corda entre os jogadores (DistanceConstraint)", () => {
  const FLATROPE = parseLevel({
    name: "flatrope",
    map: [
      "#..................#",
      "#..................#",
      "#..................#",
      "#..................#",
      "#.1.2..............#",
      "####################",
    ],
    rope: { length: 4 },
  });
  const centerDist = (w: ReturnType<typeof createWorld>) => {
    const [a, b] = w.players;
    return Math.hypot(b.x + b.w / 2 - (a.x + a.w / 2), b.y + b.h / 2 - (a.y + a.h / 2));
  };

  it("folgada (mais perto que o comprimento) não interfere", () => {
    const w = createWorld(FLATROPE, 2);
    const ax = w.players[0].x;
    run(w, 20, [NO_INPUT, RIGHT]);
    expect(centerDist(w)).toBeLessThan(4 * TILE);
    expect(w.players[0].x).toBe(ax);
  });

  it("esticada no chão: quem anda arrasta o parceiro e a distância fica perto do comprimento", () => {
    const w = createWorld(FLATROPE, 2);
    const ax = w.players[0].x;
    run(w, 200, [NO_INPUT, RIGHT]);
    expect(w.players[0].x).toBeGreaterThan(ax + 20);
    expect(centerDist(w)).toBeLessThan(4 * TILE + 12);
  });

  const CLIFF = parseLevel({
    name: "cliff",
    map: [
      "#..................#",
      "#..................#",
      "#........1.2.......#",
      "##########.........#",
      "##########.........#",
      "##########.........#",
      "##########.........#",
      "##########.........#",
      "##########.........#",
      "##########.........#",
    ],
    rope: { length: 3 },
  });

  it("quem cai fica pendurado; quem está no chão segura", () => {
    const w = createWorld(CLIFF, 2);
    const [a, b] = w.players;
    b.x = 10 * TILE + 2; // b começa já fora da borda
    run(w, 180, [NO_INPUT, NO_INPUT]);
    expect(w.resets).toBe(0);
    expect(a.onGround).toBe(true);
    expect(a.y + a.h).toBe(3 * TILE);
    expect(b.y).toBeGreaterThan(3 * TILE);
    expect(b.y).toBeLessThan(3 * TILE + 3 * TILE + 8);
  });

  it("quem está no alto andando para longe iça o parceiro pela parede", () => {
    const w = createWorld(CLIFF, 2);
    const b = w.players[1];
    b.x = 10 * TILE + 2;
    run(w, 120, [NO_INPUT, NO_INPUT]);
    // a vai para a esquerda, puxando b para cima pela parede
    run(w, 400, [LEFT, NO_INPUT]);
    expect(w.resets).toBe(0);
    expect(b.y + b.h).toBe(3 * TILE);
    expect(b.onGround).toBe(true);
  });
});

describe("Mundo 3 — tempo", () => {
  const room = (extra: object) =>
    parseLevel({
      name: "timed",
      map: [
        "#..................#",
        "#..................#",
        "#..................#",
        "#..................#",
        "#.1.2..............#",
        "####################",
      ],
      ...extra,
    });

  it("botão temporizado mantém o portão aberto por N segundos depois de solto", () => {
    const w = createWorld(
      room({ switches: [{ col: 6, row: 4, target: "g", timer: 2 }], gates: [{ id: "g", col: 12, row: 2, w: 1, h: 3 }] }),
      2,
    );
    const a = w.players[0];
    a.x = 6 * TILE + 1;
    run(w, 60, [NO_INPUT, NO_INPUT]);
    expect(w.gates[0].open).toBe(1);
    a.x = 2 * TILE; // sai do botão
    run(w, 60, [NO_INPUT, NO_INPUT]); // 1 s depois ainda aberto
    expect(w.switches[0].on).toBe(true);
    expect(w.gates[0].open).toBe(1);
    run(w, 120, [NO_INPUT, NO_INPUT]); // passou o tempo: fecha
    expect(w.switches[0].on).toBe(false);
    expect(w.gates[0].open).toBe(0);
  });

  it("botão com atraso: o efeito só chega depois de N segundos e fica", () => {
    const w = createWorld(
      room({ switches: [{ col: 6, row: 4, target: "g", delay: 1 }], gates: [{ id: "g", col: 12, row: 2, w: 1, h: 3 }] }),
      2,
    );
    const a = w.players[0];
    a.x = 6 * TILE + 1;
    run(w, 30, [NO_INPUT, NO_INPUT]);
    expect(w.switches[0].on).toBe(false);
    a.x = 2 * TILE;
    run(w, 40, [NO_INPUT, NO_INPUT]);
    expect(w.switches[0].on).toBe(true);
    run(w, 300, [NO_INPUT, NO_INPUT]);
    expect(w.gates[0].open).toBe(1);
  });

  it("portão com needAll só abre com todos os seus botões ligados", () => {
    const w = createWorld(
      room({
        switches: [
          { col: 6, row: 4, target: "g" },
          { col: 9, row: 4, target: "g" },
        ],
        gates: [{ id: "g", col: 12, row: 2, w: 1, h: 3, needAll: true }],
      }),
      2,
    );
    const [a, b] = w.players;
    a.x = 6 * TILE + 1;
    run(w, 60, [NO_INPUT, NO_INPUT]);
    expect(w.gates[0].open).toBe(0);
    b.x = 9 * TILE + 1;
    run(w, 60, [NO_INPUT, NO_INPUT]);
    expect(w.gates[0].open).toBe(1);
  });

  it("bloco que pisca alterna sólido/vazio e não reaparece em cima de alguém", () => {
    const w = createWorld(room({ blinks: [{ col: 10, row: 3, w: 1, h: 2, on: 1, off: 1 }] }), 2);
    const blink = w.blinks[0];
    expect(blink.visible).toBe(true);
    run(w, 61, [NO_INPUT, NO_INPUT]);
    expect(blink.visible).toBe(false);
    // jogador entra no espaço do bloco enquanto está invisível
    const b = w.players[1];
    b.x = 10 * TILE + 1;
    run(w, 70, [NO_INPUT, NO_INPUT]);
    expect(blink.visible).toBe(false);
    b.x = 14 * TILE;
    run(w, 3, [NO_INPUT, NO_INPUT]);
    expect(blink.visible).toBe(true);
  });

  it("bloco visível bloqueia a passagem", () => {
    const w = createWorld(room({ blinks: [{ col: 10, row: 3, w: 1, h: 2, on: 100, off: 1 }] }), 2);
    run(w, 200, [NO_INPUT, RIGHT]);
    expect(w.players[1].x + w.players[1].w).toBe(10 * TILE);
  });
});

describe("Mundo 4 — chão que cai e espinhos", () => {
  const level = (extra: object, map?: string[]) =>
    parseLevel({
      name: "w4",
      map: map ?? [
        "#..................#",
        "#..................#",
        "#..................#",
        "#..................#",
        "#.1.2..............#",
        "######.....#########",
        "######.....#########",
        "####################",
      ],
      ...extra,
    });

  it("chão que cai: espera 0,22 s depois de pisado e cai até pousar, levando quem está em cima", () => {
    const w = createWorld(level({ falls: [{ col: 6, row: 5, w: 5, h: 1 }] }), 2);
    const fall = w.falls[0];
    const b = w.players[1];
    run(w, 30, [NO_INPUT, NO_INPUT]);
    expect(fall.y).toBe(5 * TILE); // ninguém pisou
    b.x = 8 * TILE;
    b.y = 5 * TILE - b.h;
    run(w, Math.round(FALL_WAIT * 60) - 2, [NO_INPUT, NO_INPUT]);
    expect(fall.y).toBe(5 * TILE);
    run(w, 60, [NO_INPUT, NO_INPUT]);
    expect(fall.y).toBe(6 * TILE); // pousou no fundo
    expect(b.y + b.h).toBe(6 * TILE);
    expect(w.resets).toBe(0);
  });

  it("espinho mata ao toque e reinicia a fase", () => {
    const w = createWorld(level({ thorns: [{ col: 4, row: 4, w: 1, h: 1 }] }, [
      "#..................#",
      "#..................#",
      "#..................#",
      "#..................#",
      "#.1................#",
      "####################",
    ]), 1);
    run(w, 20, [RIGHT]);
    expect(w.resets).toBe(1);
    expect(w.players[0].x).toBeLessThan(3 * TILE); // voltou ao início
  });

  it("espinho móvel vai e volta no percurso", () => {
    const w = createWorld(level({ thorns: [{ col: 12, row: 1, w: 1, h: 1, dx: 4, dy: 0, speed: 1 }] }), 1);
    const t = w.thorns[0];
    const xs: number[] = [];
    for (let f = 0; f < 200; f++) {
      step(w, [NO_INPUT]);
      xs.push(t.x);
    }
    expect(Math.max(...xs)).toBeCloseTo(16 * TILE, 0);
    expect(Math.min(...xs)).toBeCloseTo(12 * TILE, 0);
  });
});

describe("Mundo 5 — trilhos e paredes que empurram", () => {
  const pit = (extra: object) =>
    parseLevel({
      name: "w5",
      map: [
        "#..................#",
        "#..................#",
        "#..................#",
        "#..................#",
        "#.1.2..............#",
        "#####.........######",
        "#####.........######",
        "#####.........######",
      ],
      ...extra,
    });

  it("trilho com need 2: parado com um, anda com dois e leva junto; volta quando o peso sai", () => {
    const w = createWorld(pit({ rails: [{ path: [[5, 5], [10, 5]], w: 4, need: 2 }] }), 2);
    const rail = w.rails[0];
    const [a, b] = w.players;
    a.x = 6 * TILE;
    a.y = 5 * TILE - a.h;
    run(w, 60, [NO_INPUT, NO_INPUT]);
    expect(rail.x).toBe(5 * TILE);
    b.x = 8 * TILE;
    b.y = 5 * TILE - b.h;
    run(w, 200, [NO_INPUT, NO_INPUT]);
    expect(rail.x).toBe(10 * TILE);
    expect(a.x).toBeCloseTo(11 * TILE, 5);
    expect(a.y + a.h).toBe(rail.y);
    // os dois descem para a direita: o trilho volta
    run(w, 200, [RIGHT, RIGHT]);
    run(w, 300, [NO_INPUT, NO_INPUT]);
    expect(rail.x).toBe(5 * TILE);
  });

  it("trilho com need 0 vai e volta sozinho, esperando nas pontas", () => {
    const w = createWorld(pit({ rails: [{ path: [[5, 5], [5, 2]], w: 3, need: 0, speed: 1, wait: 0.5 }] }), 1);
    const rail = w.rails[0];
    const ys: number[] = [];
    for (let f = 0; f < 300; f++) {
      step(w, [NO_INPUT]);
      ys.push(rail.y);
    }
    expect(Math.min(...ys)).toBe(2 * TILE);
    expect(Math.max(...ys)).toBe(5 * TILE);
  });

  const corridor = (extra: object) =>
    parseLevel({
      name: "wall",
      map: [
        "#..................#",
        "#..................#",
        "#..................#",
        "#..................#",
        "#..................#",
        "#.1................#",
        "####################",
      ],
      ...extra,
    });

  it("parede que empurra: espera, avança empurrando o jogador e volta", () => {
    const w = createWorld(corridor({ pushers: [{ col: 4, row: 2, h: 4, dx: 3 }] }), 1);
    const wall = w.pushers[0];
    const p = w.players[0];
    p.x = 5 * TILE;
    run(w, Math.round(MOVEWALL_IDLE * 60) - 2, [NO_INPUT]);
    expect(wall.offset).toBe(0);
    run(w, 80, [NO_INPUT]);
    expect(wall.offset).toBe(3 * TILE);
    expect(p.x).toBeGreaterThanOrEqual(wall.x + wall.w - 0.001);
    run(w, 160, [NO_INPUT]); // espera 1,5 s e volta a 0,75 px/frame
    expect(wall.offset).toBe(0);
    expect(w.resets).toBe(0);
  });

  it("parede que empurra esmaga quem fica preso contra a parede (reinicia)", () => {
    const w = createWorld(corridor({ pushers: [{ col: 15, row: 2, h: 4, dx: 3 }] }), 1);
    const p = w.players[0];
    p.x = 18 * TILE - p.w; // encostado na parede direita
    run(w, 300, [NO_INPUT]);
    expect(w.resets).toBeGreaterThan(0);
  });
});

describe("Mundos 6 e 7 — vento e trampolim", () => {
  const open = (extra: object) =>
    parseLevel({
      name: "w67",
      map: [
        "#..................#",
        "#..................#",
        "#..................#",
        "#..................#",
        "#..................#",
        "#..................#",
        "#.1.2..............#",
        "####################",
      ],
      ...extra,
    });

  it("vento horizontal empurra quem está na área e freia quem anda contra", () => {
    const w = createWorld(open({ winds: [{ col: 6, row: 0, w: 8, h: 7, fx: -1 }] }), 1);
    const p = w.players[0];
    p.x = 10 * TILE;
    run(w, 30, [NO_INPUT]);
    expect(p.x).toBeLessThan(10 * TILE - 20);
    const x0 = (p.x = 8 * TILE);
    run(w, 30, [RIGHT]);
    expect(p.x - x0).toBeGreaterThan(5);
    expect(p.x - x0).toBeLessThan(30 * WALK_SPEED * 0.6);
  });

  it("corrente de ar para cima levanta quem entra", () => {
    const w = createWorld(open({ winds: [{ col: 8, row: 1, w: 2, h: 6, fy: -1.5 }] }), 1);
    const p = w.players[0];
    p.x = 8 * TILE + 1;
    run(w, 40, [NO_INPUT]);
    expect(p.y).toBeLessThan(5 * TILE);
  });

  it("trampolim lança para cima quem pisa", () => {
    const w = createWorld(open({ springs: [{ col: 8, row: 6, w: 1, vy: -8 }] }), 1);
    const p = w.players[0];
    p.x = 8 * TILE + 1;
    p.y = 6 * TILE - p.h - 4;
    let minY = p.y;
    for (let f = 0; f < 60; f++) {
      step(w, [NO_INPUT]);
      minY = Math.min(minY, p.y);
    }
    expect(6 * TILE - (minY + p.h)).toBeGreaterThan(40);
  });

  it("trampolim ligado a botão só lança com o botão pressionado", () => {
    const w = createWorld(
      open({ springs: [{ col: 8, row: 6, w: 1, vy: -8, target: "s" }], switches: [{ col: 3, row: 6, target: "s" }] }),
      2,
    );
    const [a, b] = w.players;
    b.x = 8 * TILE + 1;
    b.y = 6 * TILE - b.h;
    a.x = 12 * TILE;
    run(w, 30, [NO_INPUT, NO_INPUT]);
    expect(b.y + b.h).toBe(6 * TILE); // sem botão, é só um bloco
    a.x = 3 * TILE + 1;
    let minY = b.y;
    for (let f = 0; f < 60; f++) {
      step(w, [NO_INPUT, NO_INPUT]);
      minY = Math.min(minY, b.y);
    }
    expect(minY).toBeLessThan(6 * TILE - b.h - 30);
  });
});

describe("Mundos 8 e 9 — gravidade invertida e teletransporte", () => {
  const box = (extra: object) =>
    parseLevel({
      name: "w89",
      map: [
        "####################",
        "#..................#",
        "#..................#",
        "#..................#",
        "#..................#",
        "#.1.2..............#",
        "####################",
      ],
      ...extra,
    });
  const DOWN: PlayerInput = { ...NO_INPUT, down: true };

  it("apertar baixo no chão inverte a gravidade: cai para o teto e anda nele", () => {
    const w = createWorld(box({ flipGravity: true }), 1);
    const p = w.players[0];
    run(w, 5, [NO_INPUT]);
    step(w, [DOWN]);
    run(w, 60, [NO_INPUT]);
    expect(p.gravDir).toBe(-1);
    expect(p.y).toBe(TILE);
    expect(p.onGround).toBe(true);
    const x0 = p.x;
    run(w, 20, [RIGHT]);
    expect(p.x).toBeGreaterThan(x0 + 20);
    // pulo invertido vai para baixo e volta ao teto
    step(w, [JUMP]);
    run(w, 3, [NO_INPUT]);
    expect(p.y).toBeGreaterThan(TILE + 3);
    run(w, 60, [NO_INPUT]);
    expect(p.y).toBe(TILE);
    // inverte de volta
    step(w, [DOWN]);
    run(w, 60, [NO_INPUT]);
    expect(p.gravDir).toBe(1);
    expect(p.y + p.h).toBe(6 * TILE);
  });

  it("sem flipGravity na fase, baixo não faz nada", () => {
    const w = createWorld(box({}), 1);
    run(w, 5, [NO_INPUT]);
    run(w, 30, [DOWN]);
    expect(w.players[0].gravDir).toBe(1);
  });

  it("portal leva quem toca até o destino", () => {
    const w = createWorld(box({ warps: [{ col: 8, row: 5, w: 1, h: 1, to: [15, 5] }] }), 2);
    const b = w.players[1];
    run(w, 80, [NO_INPUT, RIGHT]);
    expect(b.x).toBeGreaterThan(14 * TILE);
    expect(w.players[0].x).toBeLessThan(4 * TILE);
  });

  it("portal 'all' leva todos juntos, lado a lado", () => {
    const w = createWorld(box({ warps: [{ col: 8, row: 5, w: 1, h: 1, to: [12, 5], all: true }] }), 2);
    run(w, 80, [NO_INPUT, RIGHT]);
    expect(w.players.every((p) => p.x >= 12 * TILE - 1)).toBe(true);
    expect(Math.abs(w.players[0].x - w.players[1].x)).toBeGreaterThanOrEqual(PLAYER_SIZE);
  });
});
