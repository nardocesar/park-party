import type { LevelDef } from "./engine/level";

const ROWS = 11;
const FLOOR = ROWS - 3; // última linha jogável acima do chão

/** Monta o mapa ASCII por retângulos para evitar erro de alinhamento. */
function build(
  name: string,
  cols: number,
  rows: number,
  draw: (g: Grid) => void,
  extra: Omit<LevelDef, "name" | "map"> = {},
): LevelDef {
  const cells = Array.from({ length: rows }, () => Array<string>(cols).fill("."));
  const g: Grid = {
    fill: (c0, c1, r0, r1, ch = "#") => {
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) cells[r][c] = ch;
    },
    set: (c, r, ch) => {
      cells[r][c] = ch;
    },
  };
  // paredes laterais e chão (da linha abaixo de FLOOR até o fim)
  g.fill(0, 0, 0, rows - 1);
  g.fill(cols - 1, cols - 1, 0, rows - 1);
  g.fill(0, cols - 1, FLOOR + 1, rows - 1);
  draw(g);
  return { name, map: cells.map((r) => r.join("")), ...extra };
}

type Grid = {
  fill: (c0: number, c1: number, r0: number, r1: number, ch?: string) => void;
  set: (c: number, r: number, ch: string) => void;
};


const fallBridge = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ col: from + i, row: FLOOR + 1, w: 1, h: 1 }));

/** Exigência de "todos": é limitada ao número de jogadores da partida (escala de 2 a 4). */
const ALL = 99;

const spawns = (g: Grid) => "1234".split("").forEach((d, i) => g.set(2 + i, FLOOR, d));

const WORLD_1: LevelDef[] = [
  // 1-1: um degrau sobe sozinho; a chave fica numa plataforma de 2 tiles que exige empilhar
  build("Primeiros passos", 40, ROWS, (g) => {
    spawns(g);
    g.set(11, FLOOR, "#");
    g.fill(20, 24, FLOOR - 1, FLOOR - 1);
    g.set(22, FLOOR - 2, "K");
    g.set(28, FLOOR, "#");
    g.set(35, FLOOR, "D");
  }),
  // 1-2: buracos de 1 tile (cair reinicia todos) e chave acima de um degrau largo
  // (o degrau tem 2 tiles para caberem os dois jogadores do empilhamento)
  build("Cuidado com o buraco", 46, ROWS, (g) => {
    spawns(g);
    g.fill(14, 14, FLOOR + 1, ROWS - 1, ".");
    g.fill(21, 22, FLOOR, FLOOR);
    g.fill(23, 26, FLOOR - 2, FLOOR - 2);
    g.set(25, FLOOR - 3, "K");
    g.fill(32, 32, FLOOR + 1, ROWS - 1, ".");
    g.set(41, FLOOR, "D");
  }),
  // 1-3: chave alta, buraco e escada até a porta no platô
  build("Escada para a porta", 48, ROWS, (g) => {
    spawns(g);
    g.fill(10, 10, FLOOR + 1, ROWS - 1, ".");
    g.fill(18, 21, FLOOR - 1, FLOOR - 1);
    g.set(20, FLOOR - 2, "K");
    g.fill(26, 26, FLOOR + 1, ROWS - 1, ".");
    g.set(31, FLOOR, "#");
    g.fill(32, 32, FLOOR - 1, FLOOR);
    g.fill(33, 46, FLOOR - 2, FLOOR);
    g.set(42, FLOOR - 3, "D");
  }),
  // 1-4 (difícil): caixa que exige todos vira ponte; duas caixas seguram os botões do portão;
  // a chave fica num platô que exige torre; o elevador final só sobe com todos.
  build(
    "Ponte, botões e torre",
    58,
    ROWS + 1,
    (g) => {
      spawns(g);
      g.fill(13, 14, FLOOR + 1, FLOOR + 2, ".");
      g.set(24, FLOOR, "#");
      g.set(31, FLOOR, "#");
      g.fill(39, 41, FLOOR - 1, FLOOR - 1);
      g.set(40, FLOOR - 2, "K");
      g.fill(44, 46, FLOOR + 1, FLOOR + 2, ".");
      g.fill(47, 56, FLOOR - 4, FLOOR + 2);
      g.set(53, FLOOR - 5, "D");
    },
    {
      boxes: [
        { col: 8, row: FLOOR - 1, w: 2, h: 2, need: ALL },
        { col: 19, row: FLOOR, w: 1, h: 1, need: 1 },
        { col: 27, row: FLOOR, w: 1, h: 1, need: 1 },
      ],
      switches: [
        { col: 23, row: FLOOR, target: "g1" },
        { col: 30, row: FLOOR, target: "g1" },
      ],
      gates: [{ id: "g1", col: 35, row: FLOOR - 4, w: 1, h: 5, needAll: true }],
      lifts: [{ col: 44, row: FLOOR + 1, w: 3, dy: -5, need: ALL }],
    },
  ),
  // 1-5 (difícil): dois elevadores que exigem todos, em níveis diferentes; a chave flutua acima do
  // último nível e exige torre.
  build(
    "Elevadores em série",
    44,
    ROWS + 1,
    (g) => {
      spawns(g);
      g.fill(10, 13, FLOOR + 1, FLOOR + 3, ".");
      g.fill(14, 42, FLOOR - 2, FLOOR + 3); // patamar 1 (topo na linha 6)
      g.fill(18, 21, FLOOR - 2, FLOOR - 2, "."); // vão do segundo elevador
      g.fill(22, 42, FLOOR - 4, FLOOR - 3); // patamar 2 (topo na linha 4)
      g.fill(30, 32, 2, 2); // plataforma flutuante: torre a partir do patamar 2
      g.set(31, 1, "K");
      g.set(38, FLOOR - 5, "D");
    },
    {
      lifts: [
        { col: 10, row: FLOOR + 1, w: 4, dy: -3, need: ALL },
        { col: 18, row: FLOOR - 2, w: 4, dy: -2, need: ALL },
      ],
    },
  ),
];

// Mundo 2 — Amarrados: todos ligados por uma corda (DistanceConstraint, docs/re/02-rope.md).
const ROPE = { rope: { length: 4 } };
const DEEP = 14; // fases com poço: chão mais grosso para quem está pendurado continuar visível

const WORLD_2: LevelDef[] = [
  // 2-1: a corda arrasta quem fica para trás; buracos de 1 tile matam
  build(
    "Amarrados",
    40,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(12, 12, FLOOR + 1, ROWS - 1, ".");
      g.set(16, FLOOR, "K");
      g.fill(20, 20, FLOOR + 1, ROWS - 1, ".");
      g.set(26, FLOOR, "#");
      g.set(36, FLOOR, "D");
    },
    ROPE,
  ),
  // 2-2: a chave está no fundo de um poço; um desce pendurado e o outro o iça de volta
  build(
    "Rapel",
    40,
    DEEP,
    (g) => {
      spawns(g);
      g.set(8, FLOOR, "D");
      g.fill(18, 19, FLOOR + 1, DEEP - 1, ".");
      g.set(18, DEEP - 2, "K");
    },
    ROPE,
  ),
  // 2-3 (difícil): dois paredões (torre no degrau duplo + içar pela corda) com um rapel no meio
  // até a chave e uma vala com espinho antes do segundo paredão.
  build(
    "Paredão duplo",
    52,
    DEEP,
    (g) => {
      spawns(g);
      g.fill(10, 11, FLOOR, FLOOR);
      g.fill(12, 19, FLOOR - 2, FLOOR);
      g.fill(26, 26, FLOOR + 1, DEEP - 1, ".");
      g.set(26, DEEP - 2, "K");
      g.set(30, FLOOR + 1, ".");
      g.fill(34, 35, FLOOR, FLOOR);
      g.fill(36, 43, FLOOR - 2, FLOOR);
      g.set(48, FLOOR, "D");
    },
    { ...ROPE, thorns: [{ col: 30, row: FLOOR + 1, w: 1, h: 1 }] },
  ),
  // 2-4 (difícil): ponte que cai atravessada amarrados, rapel no poço pela chave e paredão no fim
  build(
    "Corda bamba",
    52,
    DEEP,
    (g) => {
      spawns(g);
      g.fill(8, 15, FLOOR + 1, DEEP - 1, ".");
      g.fill(25, 25, FLOOR + 1, DEEP - 1, ".");
      g.set(25, DEEP - 2, "K");
      g.fill(32, 33, FLOOR, FLOOR);
      g.fill(34, 50, FLOOR - 2, FLOOR);
      g.set(46, FLOOR - 3, "D");
    },
    { ...ROPE, falls: fallBridge(8, 15) },
  ),
];

// Mundo 3 — Contra o tempo: botões temporizados/combinados e blocos que piscam
// (SwitchComponent.m_TimerAddSecond, DelaySwitchComponent, BlinkBlockComponent — docs/re/03-timing.md).
const WORLD_3: LevelDef[] = [
  // 3-1: um segura o botão temporizado, o outro passa e segura o do outro lado
  build(
    "Revezamento",
    44,
    ROWS,
    (g) => {
      spawns(g);
      g.set(30, FLOOR, "K");
      g.set(40, FLOOR, "D");
    },
    {
      switches: [
        { col: 16, row: FLOOR, target: "g1", timer: 3 },
        { col: 24, row: FLOOR, target: "g1", timer: 3 },
      ],
      gates: [{ id: "g1", col: 20, row: FLOOR - 4, w: 1, h: 5 }],
    },
  ),
  // 3-2: paredes que piscam fora de fase e uma ponte que pisca sobre o poço
  build(
    "Pisca-pisca",
    44,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(30, 32, FLOOR + 1, ROWS - 1, ".");
      g.set(27, FLOOR, "K");
      g.set(40, FLOOR, "D");
    },
    {
      blinks: [
        { col: 12, row: FLOOR - 4, w: 1, h: 5, on: 1.5, off: 1.5 },
        { col: 18, row: FLOOR - 4, w: 1, h: 5, on: 1.5, off: 1.5, phase: 0.5 },
        { col: 24, row: FLOOR - 4, w: 1, h: 5, on: 1.5, off: 1.5, phase: 1 },
        { col: 30, row: FLOOR + 1, w: 3, h: 1, on: 2, off: 1.5 },
      ],
    },
  ),
  // 3-3 (difícil): revezamento de 1 s, ponte que pisca sobre o buraco, outro revezamento de 1 s e
  // um corredor de paredes que piscam rápido.
  build(
    "Relógio",
    66,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(21, 23, FLOOR + 1, ROWS - 1, ".");
      g.set(54, FLOOR, "K");
      g.set(61, FLOOR, "D");
    },
    {
      switches: [
        { col: 9, row: FLOOR, target: "g1", timer: 1 },
        { col: 15, row: FLOOR, target: "g1", timer: 1 },
        { col: 30, row: FLOOR, target: "g2", timer: 1 },
        { col: 36, row: FLOOR, target: "g2", timer: 1 },
      ],
      gates: [
        { id: "g1", col: 12, row: FLOOR - 4, w: 1, h: 5 },
        { id: "g2", col: 33, row: FLOOR - 4, w: 1, h: 5 },
      ],
      blinks: [
        { col: 21, row: FLOOR + 1, w: 3, h: 1, on: 1, off: 1.5 },
        { col: 42, row: FLOOR - 4, w: 1, h: 5, on: 0.7, off: 0.7 },
        { col: 45, row: FLOOR - 4, w: 1, h: 5, on: 0.7, off: 0.7, phase: 0.35 },
        { col: 48, row: FLOOR - 4, w: 1, h: 5, on: 0.7, off: 0.7, phase: 0.7 },
      ],
    },
  ),
  // 3-4 (difícil): três revezamentos de 0,9 s intercalados com duas pontes que piscam
  build(
    "Contra o relógio",
    76,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(19, 21, FLOOR + 1, ROWS - 1, ".");
      g.fill(41, 43, FLOOR + 1, ROWS - 1, ".");
      g.set(68, FLOOR, "K");
      g.set(72, FLOOR, "D");
    },
    {
      switches: [
        { col: 8, row: FLOOR, target: "g1", timer: 0.9 },
        { col: 14, row: FLOOR, target: "g1", timer: 0.9 },
        { col: 29, row: FLOOR, target: "g2", timer: 0.9 },
        { col: 35, row: FLOOR, target: "g2", timer: 0.9 },
        { col: 51, row: FLOOR, target: "g3", timer: 0.9 },
        { col: 57, row: FLOOR, target: "g3", timer: 0.9 },
      ],
      gates: [
        { id: "g1", col: 11, row: FLOOR - 4, w: 1, h: 5 },
        { id: "g2", col: 32, row: FLOOR - 4, w: 1, h: 5 },
        { id: "g3", col: 54, row: FLOOR - 4, w: 1, h: 5 },
      ],
      blinks: [
        { col: 19, row: FLOOR + 1, w: 3, h: 1, on: 1, off: 1.2 },
        { col: 41, row: FLOOR + 1, w: 3, h: 1, on: 0.9, off: 1.4 },
      ],
    },
  ),
];

// Mundo 4 — Chão traiçoeiro: chão que cai e espinhos (FallBoxComponent, ThornComponent — docs/re/04-fall-thorn.md).

const WORLD_4: LevelDef[] = [
  // 4-1: ponte de blocos que caem sobre o poço — atravessar juntos, sem parar
  build(
    "Ponte que cai",
    40,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(10, 17, FLOOR + 1, ROWS - 1, ".");
      g.set(22, FLOOR, "K");
      g.set(34, FLOOR, "D");
    },
    { falls: fallBridge(10, 17) },
  ),
  // 4-2: valas com espinho no fundo (pular) e um trecho com espinhos no teto (não pular)
  build(
    "Espinhos",
    44,
    ROWS,
    (g) => {
      spawns(g);
      for (const c of [9, 14, 19]) g.set(c, FLOOR + 1, ".");
      g.fill(22, 28, FLOOR - 3, FLOOR - 3);
      g.fill(31, 34, FLOOR - 1, FLOOR - 1);
      g.set(33, FLOOR - 2, "K");
      g.set(40, FLOOR, "D");
    },
    {
      thorns: [
        { col: 9, row: FLOOR + 1, w: 1, h: 1 },
        { col: 14, row: FLOOR + 1, w: 1, h: 1 },
        { col: 19, row: FLOOR + 1, w: 1, h: 1 },
        { col: 22, row: FLOOR - 2, w: 7, h: 1, dir: "down" },
      ],
    },
  ),
  // 4-3 (difícil): valas, esmagadores de velocidades diferentes, ponte que cai e mais esmagadores
  build(
    "Moedor",
    70,
    ROWS,
    (g) => {
      spawns(g);
      for (const c of [9, 16, 44, 58]) g.set(c, FLOOR + 1, ".");
      g.fill(26, 33, FLOOR + 1, ROWS - 1, ".");
      g.set(52, FLOOR, "K");
      g.set(66, FLOOR, "D");
    },
    {
      falls: fallBridge(26, 33),
      thorns: [
        ...[9, 16, 44, 58].map((col) => ({ col, row: FLOOR + 1, w: 1, h: 1 })),
        { col: 12, row: FLOOR - 3, w: 1, h: 1, dir: "down" as const, dy: 3, speed: 1.25 },
        { col: 20, row: FLOOR - 3, w: 2, h: 1, dir: "down" as const, dy: 3, speed: 0.9 },
        { col: 38, row: FLOOR - 3, w: 1, h: 1, dir: "down" as const, dy: 3, speed: 1.5 },
        { col: 48, row: FLOOR - 3, w: 2, h: 1, dir: "down" as const, dy: 3, speed: 1 },
        { col: 54, row: FLOOR - 3, w: 1, h: 1, dir: "down" as const, dy: 3, speed: 1.25 },
      ],
    },
  ),
  // 4-4 (difícil): ponte longa que cai com espinho móvel baixo (pular mata), depois valas e esmagadores
  build(
    "Sem volta",
    62,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(10, 23, FLOOR + 1, ROWS - 1, ".");
      for (const c of [30, 37, 50]) g.set(c, FLOOR + 1, ".");
      g.set(46, FLOOR, "K");
      g.set(58, FLOOR, "D");
    },
    {
      falls: fallBridge(10, 23),
      thorns: [
        { col: 10, row: FLOOR - 1, w: 1, h: 1, dx: 13, speed: 0.7 },
        ...[30, 37, 50].map((col) => ({ col, row: FLOOR + 1, w: 1, h: 1 })),
        { col: 33, row: FLOOR - 3, w: 1, h: 1, dir: "down" as const, dy: 3, speed: 1.25 },
        { col: 42, row: FLOOR - 3, w: 2, h: 1, dir: "down" as const, dy: 3, speed: 1 },
        { col: 54, row: FLOOR - 3, w: 1, h: 1, dir: "down" as const, dy: 3, speed: 1.5 },
      ],
    },
  ),
];

// Mundo 5 — Engrenagens: trilhos e paredes que empurram
// (LinePathLift, UpDownLift, MoveWall — docs/re/05-rails.md).

const WORLD_5: LevelDef[] = [
  // 5-1: o trilho só cruza o poço com todos em cima
  build(
    "Trilho",
    40,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(8, 17, FLOOR + 1, ROWS - 1, ".");
      g.set(24, FLOOR, "K");
      g.set(34, FLOOR, "D");
    },
    { rails: [{ path: [[8, FLOOR + 1], [15, FLOOR + 1]], w: 3, need: ALL }] },
  ),
  // 5-2: paredão alto demais; a plataforma sobe e desce sozinha ao lado
  build(
    "Sobe e desce",
    40,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(13, 15, FLOOR + 1, ROWS - 1, ".");
      g.fill(16, 38, FLOOR - 3, FLOOR);
      g.set(24, FLOOR - 4, "K");
      g.set(35, FLOOR - 4, "D");
    },
    { rails: [{ path: [[13, FLOOR + 1], [13, FLOOR - 3]], w: 3, need: 0, wait: 1.5 }] },
  ),
  // 5-3: pistões que empurram de volta para valas com espinho; passar quando recolhem
  build(
    "Empurrão",
    44,
    ROWS,
    (g) => {
      spawns(g);
      for (const c of [10, 22]) g.set(c, FLOOR + 1, ".");
      g.set(31, FLOOR, "K");
      g.set(40, FLOOR, "D");
    },
    {
      thorns: [
        { col: 10, row: FLOOR + 1, w: 1, h: 1 },
        { col: 22, row: FLOOR + 1, w: 1, h: 1 },
      ],
      pushers: [
        { col: 12, row: FLOOR, w: 1, h: 1, dx: -2 },
        { col: 24, row: FLOOR, w: 1, h: 1, dx: -2 },
      ],
    },
  ),
  // 5-4: trilho em L sobre espinhos, com espinhos no teto do trecho alto
  build(
    "Linha de montagem",
    44,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(7, 28, FLOOR + 1, ROWS - 1, ".");
      g.fill(15, 22, 0, 2);
      g.set(34, FLOOR, "K");
      g.set(40, FLOOR, "D");
    },
    {
      rails: [{ path: [[7, FLOOR + 1], [13, FLOOR + 1], [13, FLOOR - 3], [26, FLOOR - 3], [26, FLOOR + 1]], w: 3, need: ALL }],
      thorns: [
        { col: 7, row: FLOOR + 1, w: 22, h: 1 },
        { col: 15, row: 3, w: 8, h: 1, dir: "down" },
      ],
    },
  ),
];

// Mundo 6 — Ventania: vento lateral e correntes para cima (WindComponent — docs/re/06-wind-spring.md).
const WORLD_6: LevelDef[] = [
  // 6-1: a corrente de ar leva ao alto do paredão
  build(
    "Corrente de ar",
    40,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(14, 38, FLOOR - 4, FLOOR);
      g.set(24, FLOOR - 5, "K");
      g.set(34, FLOOR - 5, "D");
    },
    { winds: [{ col: 11, row: 1, w: 3, h: FLOOR, fy: -1.25 }] },
  ),
  // 6-2: vento contrário empurra para a vala com espinho — parar é cair
  build(
    "Contra o vento",
    44,
    ROWS,
    (g) => {
      spawns(g);
      g.set(8, FLOOR + 1, ".");
      g.set(16, FLOOR, "#");
      g.set(22, FLOOR, "#");
      g.set(25, FLOOR, "K");
      g.set(38, FLOOR, "D");
    },
    {
      thorns: [{ col: 8, row: FLOOR + 1, w: 1, h: 1 }],
      winds: [{ col: 10, row: 0, w: 22, h: FLOOR + 1, fx: -0.9 }],
    },
  ),
  // 6-3: o ventilador liga com o botão de baixo ou com o de cima — revezamento
  build(
    "Ventilador",
    40,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(14, 38, FLOOR - 5, FLOOR);
      g.set(28, FLOOR - 6, "K");
      g.set(35, FLOOR - 6, "D");
    },
    {
      winds: [{ col: 11, row: 0, w: 3, h: FLOOR + 1, fy: -1.25, target: "fan" }],
      switches: [
        { col: 7, row: FLOOR, target: "fan" },
        { col: 18, row: FLOOR - 6, target: "fan" },
      ],
    },
  ),
  // 6-4: a corrente sobe até a faixa de vento lateral, que atravessa o campo de espinhos
  build(
    "Tempestade",
    44,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(9, 31, FLOOR + 1, ROWS - 1, ".");
      g.fill(32, 42, FLOOR - 4, FLOOR);
      g.set(36, FLOOR - 5, "K");
      g.set(40, FLOOR - 5, "D");
    },
    {
      thorns: [{ col: 9, row: FLOOR + 1, w: 23, h: 1 }],
      winds: [
        { col: 9, row: 2, w: 2, h: FLOOR - 1, fy: -1.25 },
        { col: 9, row: 1, w: 23, h: 3, fx: 1, fy: -0.4 },
      ],
    },
  ),
];

// Mundo 7 — Molas: trampolins (JumpStandComponent — docs/re/06-wind-spring.md).
const WORLD_7: LevelDef[] = [
  // 7-1: o trampolim leva ao platô
  build(
    "Trampolim",
    40,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(13, 38, FLOOR - 3, FLOOR);
      g.set(24, FLOOR - 4, "K");
      g.set(34, FLOOR - 4, "D");
    },
    { springs: [{ col: 11, row: FLOOR, w: 1, vy: -9 }] },
  ),
  // 7-2: o trampolim só funciona com um botão pressionado — embaixo ou em cima
  build(
    "Mola com botão",
    40,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(13, 38, FLOOR - 3, FLOOR);
      g.set(26, FLOOR - 4, "K");
      g.set(34, FLOOR - 4, "D");
    },
    {
      springs: [{ col: 11, row: FLOOR, w: 1, vy: -9, target: "s" }],
      switches: [
        { col: 7, row: FLOOR, target: "s" },
        { col: 16, row: FLOOR - 4, target: "s" },
      ],
    },
  ),
  // 7-3: trampolim diagonal sobre o campo de espinhos
  build(
    "Salto longo",
    40,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(11, 13, FLOOR + 1, ROWS - 1, ".");
      g.set(22, FLOOR, "K");
      g.set(34, FLOOR, "D");
    },
    {
      thorns: [{ col: 11, row: FLOOR + 1, w: 3, h: 1 }],
      springs: [{ col: 9, row: FLOOR, w: 1, vy: -7, vx: 4.5 }],
    },
  ),
  // 7-4: dois trampolins em níveis diferentes; o de cima depende de botão no meio ou no topo
  build(
    "Torre de molas",
    40,
    ROWS + 2,
    (g) => {
      spawns(g);
      g.fill(13, 38, FLOOR - 1, FLOOR);
      g.fill(24, 38, FLOOR - 5, FLOOR);
      g.set(32, FLOOR - 6, "K");
      g.set(36, FLOOR - 6, "D");
    },
    {
      springs: [
        { col: 11, row: FLOOR, w: 1, vy: -7.5 },
        { col: 21, row: FLOOR - 2, w: 1, vy: -9, target: "top" },
      ],
      switches: [
        { col: 16, row: FLOOR - 2, target: "top" },
        { col: 28, row: FLOOR - 6, target: "top" },
      ],
    },
  ),
];

// Mundo 8 — De ponta-cabeça: inverter a gravidade com "baixo" (PlayerComponent.checkReverseGravity —
// docs/re/07-gravity-warp.md). Todas as fases têm teto (linhas 0–1).
const ceiling = (g: Grid, cols: number) => g.fill(0, cols - 1, 0, 1);
const FLIP = { flipGravity: true };

const WORLD_8: LevelDef[] = [
  // 8-1: atravessar o poço de espinhos pelo teto; a chave está pendurada no teto
  build(
    "Teto",
    40,
    ROWS,
    (g) => {
      ceiling(g, 40);
      spawns(g);
      g.fill(10, 19, FLOOR + 1, ROWS - 1, ".");
      g.set(15, 2, "K");
      g.set(34, FLOOR, "D");
    },
    { ...FLIP, thorns: [{ col: 10, row: FLOOR + 1, w: 10, h: 1 }] },
  ),
  // 8-2: o portão exige o botão do teto e o do chão ao mesmo tempo (temporizados)
  build(
    "Espelho",
    40,
    ROWS,
    (g) => {
      ceiling(g, 40);
      spawns(g);
      g.set(28, FLOOR, "K");
      g.set(35, FLOOR, "D");
    },
    {
      ...FLIP,
      switches: [
        { col: 12, row: 2, target: "g1", timer: 3, ceiling: true },
        { col: 14, row: FLOOR, target: "g1", timer: 3 },
      ],
      gates: [{ id: "g1", col: 19, row: 2, w: 1, h: 7, needAll: true }],
    },
  ),
  // 8-3: espinhos alternam entre chão e teto — inverter na hora certa
  build(
    "Zigue-zague",
    46,
    ROWS,
    (g) => {
      ceiling(g, 46);
      spawns(g);
      g.fill(10, 15, FLOOR + 1, ROWS - 1, ".");
      g.fill(30, 33, FLOOR + 1, ROWS - 1, ".");
      g.set(22, FLOOR, "K");
      g.set(41, FLOOR, "D");
    },
    {
      ...FLIP,
      thorns: [
        { col: 10, row: FLOOR + 1, w: 6, h: 1 },
        { col: 20, row: 2, w: 6, h: 1, dir: "down" },
        { col: 30, row: FLOOR + 1, w: 4, h: 1 },
      ],
    },
  ),
  // 8-4: pelo teto sobre os espinhos até o espelho de botões, e de volta ao chão
  build(
    "Avesso",
    48,
    ROWS,
    (g) => {
      ceiling(g, 48);
      spawns(g);
      g.fill(9, 14, FLOOR + 1, ROWS - 1, ".");
      g.set(36, 2, "K");
      g.set(43, FLOOR, "D");
    },
    {
      ...FLIP,
      thorns: [
        { col: 9, row: FLOOR + 1, w: 6, h: 1 },
        { col: 30, row: FLOOR, w: 4, h: 1 },
      ],
      switches: [
        { col: 20, row: 2, target: "g1", timer: 3, ceiling: true },
        { col: 22, row: FLOOR, target: "g1", timer: 3 },
      ],
      gates: [{ id: "g1", col: 26, row: 2, w: 1, h: 7, needAll: true }],
    },
  ),
];

// Mundo 9 — Portais (WarpComponent — docs/re/07-gravity-warp.md).
const sealedWall = (g: Grid, col: number) => g.fill(col, col, 0, FLOOR);

const WORLD_9: LevelDef[] = [
  // 9-1: o portal atravessa o muro selado
  build(
    "Portal",
    40,
    ROWS,
    (g) => {
      spawns(g);
      sealedWall(g, 18);
      g.set(26, FLOOR, "K");
      g.set(34, FLOOR, "D");
    },
    { warps: [{ col: 14, row: FLOOR, w: 1, h: 1, to: [21, FLOOR] }] },
  ),
  // 9-2: a sala da chave é fechada; o portal de saída leva todos de uma vez até a porta
  build(
    "Todos juntos",
    44,
    ROWS,
    (g) => {
      spawns(g);
      sealedWall(g, 12);
      sealedWall(g, 22);
      sealedWall(g, 30);
      g.set(16, FLOOR, "K");
      g.set(38, FLOOR, "D");
    },
    {
      warps: [
        { col: 9, row: FLOOR, w: 1, h: 1, to: [14, FLOOR] },
        { col: 19, row: FLOOR, w: 1, h: 1, to: [32, FLOOR], all: true },
      ],
    },
  ),
  // 9-3: um segura o botão temporizado para o outro chegar ao portal; do outro lado, o inverso
  build(
    "Ida e volta",
    44,
    ROWS,
    (g) => {
      spawns(g);
      sealedWall(g, 22);
      g.set(32, FLOOR, "K");
      g.set(40, FLOOR, "D");
    },
    {
      switches: [
        { col: 9, row: FLOOR, target: "g1", timer: 2.5 },
        { col: 26, row: FLOOR, target: "g1", timer: 2.5 },
      ],
      gates: [{ id: "g1", col: 14, row: FLOOR - 4, w: 1, h: 5 }],
      warps: [{ col: 18, row: FLOOR, w: 1, h: 1, to: [24, FLOOR] }],
    },
  ),
  // 9-4: labirinto de portais — o portal flutuante leva aos espinhos: não pular perto dele
  build(
    "Labirinto",
    52,
    ROWS,
    (g) => {
      spawns(g);
      sealedWall(g, 10);
      sealedWall(g, 20);
      sealedWall(g, 30);
      sealedWall(g, 40);
      g.set(17, FLOOR, "#");
      g.set(34, FLOOR, "K");
      g.set(46, FLOOR, "D");
    },
    {
      thorns: [{ col: 21, row: FLOOR, w: 8, h: 1 }],
      warps: [
        { col: 8, row: FLOOR, w: 1, h: 1, to: [12, FLOOR] },
        { col: 14, row: FLOOR - 2, w: 1, h: 1, to: [24, FLOOR] },
        { col: 18, row: FLOOR, w: 1, h: 1, to: [32, FLOOR] },
        { col: 37, row: FLOOR, w: 1, h: 1, to: [42, FLOOR], all: true },
      ],
    },
  ),
];

// Mundo 10 — Cores: caixas que só o dono empurra e que pulam com ele (ColorBoxComponent —
// docs/re/08-color.md). Cor 0 = laranja (J1), cor 1 = azul (J2).
const WORLD_10: LevelDef[] = [
  // 10-1: caixas altas de cada cor viram ponte em buracos fundos — só o dono empurra
  build(
    "Sua cor",
    46,
    ROWS + 1,
    (g) => {
      spawns(g);
      g.fill(14, 14, FLOOR + 1, FLOOR + 2, ".");
      g.fill(28, 28, FLOOR + 1, FLOOR + 2, ".");
      g.set(34, FLOOR, "K");
      g.set(41, FLOOR, "D");
    },
    {
      boxes: [
        { col: 9, row: FLOOR - 1, w: 1, h: 2, need: 1, color: 0 },
        { col: 22, row: FLOOR - 1, w: 1, h: 2, need: 1, color: 1 },
      ],
    },
  ),
  // 10-2: o azul pula e a caixa azul leva o laranja até o platô; lá em cima, o botão liga a mola
  build(
    "Caixa saltadora",
    40,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(16, 38, FLOOR - 2, FLOOR);
      g.set(26, FLOOR - 3, "K");
      g.set(35, FLOOR - 3, "D");
    },
    {
      boxes: [{ col: 15, row: FLOOR, w: 1, h: 1, need: 1, color: 1 }],
      springs: [{ col: 14, row: FLOOR, w: 1, vy: -9, target: "s" }],
      switches: [{ col: 20, row: FLOOR - 3, target: "s" }],
    },
  ),
  // 10-3: cada caixa colorida segura um dos botões do portão
  build(
    "Cada um no seu botão",
    44,
    ROWS,
    (g) => {
      spawns(g);
      g.set(12, FLOOR, "#");
      g.set(20, FLOOR, "#");
      g.set(30, FLOOR, "K");
      g.set(38, FLOOR, "D");
    },
    {
      boxes: [
        { col: 7, row: FLOOR, w: 1, h: 1, need: 1, color: 0 },
        { col: 15, row: FLOOR, w: 1, h: 1, need: 1, color: 1 },
      ],
      switches: [
        { col: 11, row: FLOOR, target: "g1" },
        { col: 19, row: FLOOR, target: "g1" },
      ],
      gates: [{ id: "g1", col: 25, row: FLOOR - 4, w: 1, h: 5, needAll: true }],
    },
  ),
  // 10-4: ponte da cor certa e depois as caixas pequenas nos botões
  build(
    "Arco-íris",
    56,
    ROWS + 1,
    (g) => {
      spawns(g);
      g.fill(14, 14, FLOOR + 1, FLOOR + 2, ".");
      g.set(28, FLOOR, "#");
      g.set(36, FLOOR, "#");
      g.set(45, FLOOR, "K");
      g.set(51, FLOOR, "D");
    },
    {
      boxes: [
        { col: 9, row: FLOOR - 1, w: 1, h: 2, need: 1, color: 1 },
        { col: 22, row: FLOOR, w: 1, h: 1, need: 1, color: 0 },
        { col: 31, row: FLOOR, w: 1, h: 1, need: 1, color: 1 },
      ],
      switches: [
        { col: 27, row: FLOOR, target: "g1" },
        { col: 35, row: FLOOR, target: "g1" },
      ],
      gates: [{ id: "g1", col: 40, row: FLOOR - 4, w: 1, h: 5, needAll: true }],
    },
  ),
];

// Mundo 11 — Apagão: a luz apaga periodicamente (BlackoutComponent — docs/re/09-blackout-scale.md).
const WORLD_11: LevelDef[] = [
  // 11-1: valas com espinho que somem no escuro
  build(
    "Luzes apagando",
    44,
    ROWS,
    (g) => {
      spawns(g);
      for (const c of [9, 15, 21, 27]) g.set(c, FLOOR + 1, ".");
      g.set(24, FLOOR, "K");
      g.set(38, FLOOR, "D");
    },
    {
      blackout: { bright: 2, dark: 1.5 },
      thorns: [9, 15, 21, 27].map((col) => ({ col, row: FLOOR + 1, w: 1, h: 1 })),
    },
  ),
  // 11-2: ponte que cai no escuro
  build(
    "No escuro",
    40,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(10, 18, FLOOR + 1, ROWS - 1, ".");
      g.set(24, FLOOR, "K");
      g.set(34, FLOOR, "D");
    },
    { blackout: { bright: 1.5, dark: 2 }, falls: fallBridge(10, 18) },
  ),
  // 11-3: amarrados e no escuro
  build(
    "Corda no escuro",
    44,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(12, 12, FLOOR + 1, ROWS - 1, ".");
      g.fill(20, 20, FLOOR + 1, ROWS - 1, ".");
      g.set(26, FLOOR, "#");
      g.fill(31, 31, FLOOR + 1, ROWS - 1, ".");
      g.set(28, FLOOR, "K");
      g.set(39, FLOOR, "D");
    },
    { ...ROPE, blackout: { bright: 2, dark: 2 } },
  ),
  // 11-4: esmagadores e valas, com mais escuro que claro
  build(
    "Breu",
    46,
    ROWS,
    (g) => {
      spawns(g);
      for (const c of [9, 30]) g.set(c, FLOOR + 1, ".");
      g.set(36, FLOOR, "K");
      g.set(42, FLOOR, "D");
    },
    {
      blackout: { bright: 1.5, dark: 2.5 },
      thorns: [
        { col: 9, row: FLOOR + 1, w: 1, h: 1 },
        { col: 30, row: FLOOR + 1, w: 1, h: 1 },
        { col: 15, row: FLOOR - 3, w: 1, h: 1, dir: "down", dy: 3, speed: 1 },
        { col: 22, row: FLOOR - 3, w: 2, h: 1, dir: "down", dy: 3, speed: 0.8 },
      ],
    },
  ),
];

// Mundo 12 — Tamanho: botões que fazem crescer/encolher (ScaleSwitchComponent — docs/re/09-blackout-scale.md).
// Maior anda mais rápido e pula mais alto (velocidades × escala, observado em PlayerComponent).
const tunnel = (g: Grid, c0: number, c1: number) => g.fill(c0, c1, 0, FLOOR - 1); // passagem de 1 tile
const WORLD_12: LevelDef[] = [
  // 12-1: crescer no botão para alcançar o platô de 3 tiles
  build(
    "Crescer",
    40,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(13, 38, FLOOR - 2, FLOOR);
      g.set(24, FLOOR - 3, "K");
      g.set(34, FLOOR - 3, "D");
    },
    { switches: [{ col: 9, row: FLOOR, target: "", scale: 0.015 }] },
  ),
  // 12-2: crescer para subir, encolher para passar no túnel de 1 tile
  build(
    "Encolher",
    48,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(13, 46, FLOOR - 2, FLOOR);
      g.fill(24, 30, 0, FLOOR - 4);
      g.set(36, FLOOR - 3, "K");
      g.set(43, FLOOR - 3, "D");
    },
    {
      switches: [
        { col: 9, row: FLOOR, target: "", scale: 0.015 },
        { col: 19, row: FLOOR - 3, target: "", scale: -0.015 },
      ],
    },
  ),
  // 12-3: túnel com espinhos no teto — só passa quem encolheu abaixo da metade (sem chegar ao mínimo)
  build(
    "Na medida",
    44,
    ROWS,
    (g) => {
      spawns(g);
      tunnel(g, 18, 23);
      g.set(32, FLOOR, "K");
      g.set(40, FLOOR, "D");
    },
    {
      thorns: [{ col: 18, row: FLOOR, w: 6, h: 1, dir: "down" }],
      switches: [
        { col: 13, row: FLOOR, target: "", scale: -0.006, dieSmall: true },
        { col: 26, row: FLOOR, target: "", scale: 0.02 },
      ],
    },
  ),
  // 12-4: crescer, encolher no túnel de espinhos e crescer de novo para o muro final
  build(
    "Tamanho certo",
    56,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(13, 54, FLOOR - 2, FLOOR);
      g.fill(28, 33, 0, FLOOR - 4);
      g.fill(44, 54, FLOOR - 5, FLOOR - 3);
      g.set(37, FLOOR - 3, "K");
      g.set(50, FLOOR - 6, "D");
    },
    {
      thorns: [{ col: 28, row: FLOOR - 3, w: 6, h: 1, dir: "down" }],
      switches: [
        { col: 9, row: FLOOR, target: "", scale: 0.015 },
        { col: 22, row: FLOOR - 3, target: "", scale: -0.006, dieSmall: true },
        { col: 41, row: FLOOR - 3, target: "", scale: 0.015 },
      ],
    },
  ),
];

export const WORLDS: { name: string; levels: LevelDef[] }[] = [
  { name: "Primeiros passos", levels: WORLD_1 },
  { name: "Amarrados", levels: WORLD_2 },
  { name: "Contra o tempo", levels: WORLD_3 },
  { name: "Chão traiçoeiro", levels: WORLD_4 },
  { name: "Engrenagens", levels: WORLD_5 },
  { name: "Ventania", levels: WORLD_6 },
  { name: "Molas", levels: WORLD_7 },
  { name: "De ponta-cabeça", levels: WORLD_8 },
  { name: "Portais", levels: WORLD_9 },
  { name: "Cores", levels: WORLD_10 },
  { name: "Apagão", levels: WORLD_11 },
  { name: "Tamanho", levels: WORLD_12 },
];

/** Todas as fases em ordem, com slug "mundo-fase". */
export const LEVELS: (LevelDef & { slug: string })[] = WORLDS.flatMap((w, wi) =>
  w.levels.map((l, li) => ({ ...l, slug: `${wi + 1}-${li + 1}` })),
);
