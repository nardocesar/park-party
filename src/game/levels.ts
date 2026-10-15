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
  build("First steps", 40, ROWS, (g) => {
    spawns(g);
    g.set(11, FLOOR, "#");
    g.fill(20, 24, FLOOR - 1, FLOOR - 1);
    g.set(22, FLOOR - 2, "K");
    g.set(28, FLOOR, "#");
    g.set(35, FLOOR, "D");
  }),
  // 1-2: buracos de 1 tile (cair reinicia todos) e chave acima de um degrau largo
  // (o degrau tem 2 tiles para caberem os dois jogadores do empilhamento)
  build("Mind the gap", 46, ROWS, (g) => {
    spawns(g);
    g.fill(14, 14, FLOOR + 1, ROWS - 1, ".");
    g.fill(21, 22, FLOOR, FLOOR);
    g.fill(23, 26, FLOOR - 2, FLOOR - 2);
    g.set(25, FLOOR - 3, "K");
    g.fill(32, 32, FLOOR + 1, ROWS - 1, ".");
    g.set(41, FLOOR, "D");
  }),
  // 1-3: chave alta, buraco e escada até a porta no platô
  build("Stairway to the door", 48, ROWS, (g) => {
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
    "Bridge, buttons and tower",
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
    "Elevators in a row",
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
    "Tied together",
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
    "Rappel",
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
    "Double wall",
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
    "Tightrope",
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
    "Relay",
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
    "Blinkers",
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
    "Clockwork",
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
    "Race the clock",
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
    "Falling bridge",
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
    "Spikes",
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
    "Grinder",
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
    "No way back",
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
    "Rails",
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
    "Up and down",
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
  // 5-3 (difícil): quatro pistões com valas de espinho e uma plataforma automática sobre espinhos
  // que é preciso pegar e largar na hora certa.
  build(
    "Piston row",
    72,
    ROWS,
    (g) => {
      spawns(g);
      for (const c of [10, 18, 46, 54]) g.set(c, FLOOR + 1, ".");
      g.fill(24, 37, FLOOR + 1, ROWS - 1, ".");
      g.set(60, FLOOR, "K");
      g.set(68, FLOOR, "D");
    },
    {
      thorns: [
        ...[10, 18, 46, 54].map((col) => ({ col, row: FLOOR + 1, w: 1, h: 1 })),
        { col: 24, row: FLOOR + 1, w: 14, h: 1 },
      ],
      pushers: [
        { col: 12, row: FLOOR, w: 1, h: 1, dx: -2 },
        { col: 20, row: FLOOR, w: 1, h: 1, dx: -2 },
        { col: 48, row: FLOOR, w: 1, h: 1, dx: -2 },
        { col: 56, row: FLOOR, w: 1, h: 1, dx: -2 },
      ],
      rails: [{ path: [[24, FLOOR + 1], [35, FLOOR + 1]], w: 3, need: 0, wait: 1.5, speed: 0.75 }],
    },
  ),
  // 5-4 (difícil): trilho em L que exige todos sob espinhos no teto, dois pistões e um elevador de
  // todos até a porta.
  build(
    "Assembly line",
    66,
    ROWS + 1,
    (g) => {
      spawns(g);
      g.fill(7, 28, FLOOR + 1, FLOOR + 2, ".");
      g.fill(15, 22, 0, 2);
      for (const c of [37, 45]) g.set(c, FLOOR + 1, ".");
      g.fill(52, 54, FLOOR + 1, FLOOR + 2, ".");
      g.fill(55, 64, FLOOR - 4, FLOOR + 2);
      g.set(58, FLOOR - 5, "K");
      g.set(62, FLOOR - 5, "D");
    },
    {
      rails: [{ path: [[7, FLOOR + 1], [13, FLOOR + 1], [13, FLOOR - 3], [26, FLOOR - 3], [26, FLOOR + 1]], w: 3, need: ALL }],
      thorns: [
        { col: 7, row: FLOOR + 1, w: 22, h: 1 },
        { col: 15, row: 3, w: 8, h: 1, dir: "down" },
        ...[37, 45].map((col) => ({ col, row: FLOOR + 1, w: 1, h: 1 })),
      ],
      pushers: [
        { col: 39, row: FLOOR, w: 1, h: 1, dx: -2 },
        { col: 47, row: FLOOR, w: 1, h: 1, dx: -2 },
      ],
      lifts: [{ col: 52, row: FLOOR + 1, w: 3, dy: -5, need: ALL }],
    },
  ),
];

// Mundo 6 — Ventania: vento lateral e correntes para cima (WindComponent — docs/re/06-wind-spring.md).
const WORLD_6: LevelDef[] = [
  // 6-1: a corrente de ar leva ao alto do paredão
  build(
    "Draft",
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
    "Against the wind",
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
  // 6-3 (difícil): vento contrário forte sobre três valas e, no fim, o ventilador de revezamento
  build(
    "Gale force",
    62,
    ROWS,
    (g) => {
      spawns(g);
      for (const c of [12, 19, 26]) g.set(c, FLOOR + 1, ".");
      g.fill(36, 60, FLOOR - 5, FLOOR);
      g.set(50, FLOOR - 6, "K");
      g.set(57, FLOOR - 6, "D");
    },
    {
      thorns: [12, 19, 26].map((col) => ({ col, row: FLOOR + 1, w: 1, h: 1 })),
      winds: [
        { col: 9, row: 0, w: 21, h: FLOOR + 1, fx: -1.05 },
        { col: 33, row: 0, w: 3, h: FLOOR + 1, fy: -1.25, target: "fan" },
      ],
      switches: [
        { col: 30, row: FLOOR, target: "fan" },
        { col: 40, row: FLOOR - 6, target: "fan" },
      ],
    },
  ),
  // 6-4 (difícil): corrente + faixa lateral sobre espinhos até o patamar, depois vento contrário com
  // esmagadores e valas.
  build(
    "Storm",
    70,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(9, 31, FLOOR + 1, ROWS - 1, ".");
      g.fill(32, 68, FLOOR - 4, FLOOR);
      for (const c of [40, 54]) g.set(c, FLOOR - 4, ".");
      g.set(60, FLOOR - 5, "K");
      g.set(66, FLOOR - 5, "D");
    },
    {
      thorns: [
        { col: 9, row: FLOOR + 1, w: 23, h: 1 },
        ...[40, 54].map((col) => ({ col, row: FLOOR - 4, w: 1, h: 1 })),
        { col: 46, row: 0, w: 1, h: 1, dir: "down" as const, dy: 3, speed: 1 },
        { col: 50, row: 0, w: 1, h: 1, dir: "down" as const, dy: 3, speed: 1.25 },
      ],
      winds: [
        { col: 9, row: 2, w: 2, h: FLOOR - 1, fy: -1.25 },
        { col: 9, row: 1, w: 23, h: 3, fx: 1, fy: -0.4 },
        { col: 36, row: 0, w: 22, h: 4, fx: -0.7 },
      ],
    },
  ),
];

// Mundo 7 — Molas: trampolins (JumpStandComponent — docs/re/06-wind-spring.md).
const WORLD_7: LevelDef[] = [
  // 7-1: o trampolim leva ao platô
  build(
    "Trampoline",
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
    "Spring switch",
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
  // 7-3 (difícil): corrente de trampolins diagonais sobre um campo de espinhos; cada um pousa num
  // pilar de 3 tiles onde está o próximo. Segurar direção no ar estraga o salto.
  build(
    "Chain jumps",
    52,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(9, 33, FLOOR + 1, ROWS - 1, ".");
      g.fill(6, 8, FLOOR, ROWS - 1); // degrau com a primeira mola
      for (const c of [13, 20, 27]) g.fill(c, c + 2, FLOOR, ROWS - 1); // pilares
      g.set(40, FLOOR, "K");
      g.set(47, FLOOR, "D");
    },
    {
      thorns: [{ col: 9, row: FLOOR + 1, w: 25, h: 1 }],
      springs: [8, 15, 22, 29].map((col) => ({ col, row: FLOOR - 1, w: 1, vy: -7, vx: 4.5 })),
    },
  ),
  // 7-4 (difícil): torre de dois andares com botões e um terceiro trampolim, ligado por botões no topo
  // ou na plataforma da porta, que lança por cima de um corredor de espinhos.
  build(
    "Spring tower",
    54,
    ROWS + 2,
    (g) => {
      spawns(g);
      g.fill(13, 52, FLOOR - 1, FLOOR); // andar do meio (topo na linha 7)
      g.fill(24, 34, FLOOR - 5, FLOOR); // topo (linha 3)
      g.fill(43, 52, FLOOR - 5, FLOOR - 2); // plataforma da porta (linha 3)
      g.set(46, FLOOR - 6, "K");
      g.set(50, FLOOR - 6, "D");
    },
    {
      thorns: [{ col: 35, row: FLOOR - 2, w: 8, h: 1 }],
      springs: [
        { col: 11, row: FLOOR, w: 1, vy: -7.5 },
        { col: 21, row: FLOOR - 2, w: 1, vy: -9, target: "top" },
        { col: 34, row: FLOOR - 6, w: 1, vy: -7, vx: 8, target: "far" },
      ],
      switches: [
        { col: 16, row: FLOOR - 2, target: "top" },
        { col: 28, row: FLOOR - 6, target: "top" },
        { col: 26, row: FLOOR - 6, target: "far" },
        { col: 44, row: FLOOR - 6, target: "far" },
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
    "Ceiling",
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
    "Mirror",
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
  // 8-3 (difícil): seis inversões — espinhos alternam entre chão e teto; a chave está pendurada no
  // meio do caminho pelo teto.
  build(
    "Zigzag",
    66,
    ROWS,
    (g) => {
      ceiling(g, 66);
      spawns(g);
      for (const c of [10, 30, 50]) g.fill(c, c + 5, FLOOR + 1, ROWS - 1, ".");
      g.set(28, 2, "K");
      g.set(61, FLOOR, "D");
    },
    {
      ...FLIP,
      thorns: [
        ...[10, 30, 50].map((col) => ({ col, row: FLOOR + 1, w: 6, h: 1 })),
        { col: 20, row: 2, w: 6, h: 1, dir: "down" as const },
        { col: 40, row: 2, w: 6, h: 1, dir: "down" as const },
      ],
    },
  ),
  // 8-4 (difícil): dois espelhos de botões (teto + chão ao mesmo tempo) com espinhos entre eles que
  // obrigam cada um a trocar de lado, e um poço final atravessado pelo teto.
  build(
    "Inside out",
    70,
    ROWS,
    (g) => {
      ceiling(g, 70);
      spawns(g);
      g.fill(9, 14, FLOOR + 1, ROWS - 1, ".");
      g.fill(55, 58, FLOOR + 1, ROWS - 1, ".");
      g.set(50, FLOOR, "K");
      g.set(64, FLOOR, "D");
    },
    {
      ...FLIP,
      thorns: [
        { col: 9, row: FLOOR + 1, w: 6, h: 1 },
        { col: 26, row: FLOOR, w: 4, h: 1 },
        { col: 42, row: 2, w: 6, h: 1, dir: "down" },
        { col: 55, row: FLOOR + 1, w: 4, h: 1 },
      ],
      switches: [
        { col: 17, row: 2, target: "g1", timer: 2.5, ceiling: true },
        { col: 19, row: FLOOR, target: "g1", timer: 2.5 },
        { col: 33, row: 2, target: "g2", timer: 2, ceiling: true },
        { col: 35, row: FLOOR, target: "g2", timer: 2 },
      ],
      gates: [
        { id: "g1", col: 22, row: 2, w: 1, h: 7, needAll: true },
        { id: "g2", col: 38, row: 2, w: 1, h: 7, needAll: true },
      ],
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
    "All together",
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
  // 9-3 (difícil): revezamento de 1,2 s em que o segundo botão fica do outro lado do portal; sala
  // selada com ponte que cai até o segundo portal; esmagadores pela chave e portal de todos até a porta.
  build(
    "There and back",
    62,
    ROWS,
    (g) => {
      spawns(g);
      sealedWall(g, 22);
      sealedWall(g, 40);
      sealedWall(g, 54);
      g.fill(29, 35, FLOOR + 1, ROWS - 1, ".");
      g.set(46, FLOOR, "K");
      g.set(58, FLOOR, "D");
    },
    {
      switches: [
        { col: 9, row: FLOOR, target: "g1", timer: 1.2 },
        { col: 26, row: FLOOR, target: "g1", timer: 1.2 },
      ],
      gates: [{ id: "g1", col: 14, row: FLOOR - 4, w: 1, h: 5 }],
      falls: fallBridge(29, 35),
      thorns: [{ col: 49, row: FLOOR - 3, w: 1, h: 1, dir: "down", dy: 3, speed: 1.25 }],
      warps: [
        { col: 18, row: FLOOR, w: 1, h: 1, to: [24, FLOOR] },
        { col: 38, row: FLOOR, w: 1, h: 1, to: [42, FLOOR] },
        { col: 52, row: FLOOR, w: 1, h: 1, to: [56, FLOOR], all: true },
      ],
    },
  ),
  // 9-4 (difícil): labirinto de cinco salas; portais-armadilha flutuantes perto de degraus (pular cedo
  // leva aos espinhos), valas pela chave e o portal de todos no fim.
  build(
    "Maze",
    72,
    ROWS,
    (g) => {
      spawns(g);
      for (const c of [12, 26, 40, 54]) sealedWall(g, c);
      g.set(20, FLOOR, "#");
      for (const c of [31, 34]) g.set(c, FLOOR + 1, ".");
      g.set(37, FLOOR, "K");
      g.set(48, FLOOR, "#");
      g.set(66, FLOOR, "D");
    },
    {
      thorns: [31, 34].map((col) => ({ col, row: FLOOR + 1, w: 1, h: 1 })),
      warps: [
        { col: 9, row: FLOOR, w: 1, h: 1, to: [14, FLOOR] },
        { col: 16, row: FLOOR - 2, w: 1, h: 1, to: [31, FLOOR] },
        { col: 23, row: FLOOR - 2, w: 1, h: 1, to: [31, FLOOR] },
        { col: 25, row: FLOOR, w: 1, h: 1, to: [28, FLOOR] },
        { col: 39, row: FLOOR, w: 1, h: 1, to: [42, FLOOR] },
        { col: 45, row: FLOOR - 2, w: 1, h: 1, to: [31, FLOOR] },
        { col: 52, row: FLOOR, w: 1, h: 1, to: [57, FLOOR], all: true },
      ],
    },
  ),
];

// Mundo 10 — Cores: caixas que só o dono empurra e que pulam com ele (ColorBoxComponent —
// docs/re/08-color.md). Cor 0 = laranja (J1), cor 1 = azul (J2).
const WORLD_10: LevelDef[] = [
  // 10-1: caixas altas de cada cor viram ponte em buracos fundos — só o dono empurra
  build(
    "Your color",
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
    "Jumping crate",
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
  // 10-3: cada caixa no seu botão; depois ponte que cai, esmagador e a chave no alto
  build(
    "To each their button",
    54,
    ROWS,
    (g) => {
      spawns(g);
      g.set(12, FLOOR, "#");
      g.set(20, FLOOR, "#");
      g.fill(28, 34, FLOOR + 1, ROWS - 1, ".");
      g.fill(42, 44, FLOOR - 1, FLOOR - 1);
      g.set(43, FLOOR - 2, "K");
      g.set(50, FLOOR, "D");
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
      falls: fallBridge(28, 34),
      thorns: [{ col: 38, row: FLOOR - 3, w: 1, h: 1, dir: "down", dy: 3, speed: 1 }],
    },
  ),
  // 10-4: ponte da cor certa, caixas nos botões e a caixa azul que lança o laranja ao paredão
  build(
    "Rainbow",
    70,
    ROWS + 1,
    (g) => {
      spawns(g);
      g.fill(14, 14, FLOOR + 1, FLOOR + 2, ".");
      g.set(28, FLOOR, "#");
      g.set(36, FLOOR, "#");
      g.fill(46, 68, FLOOR - 2, FLOOR);
      g.set(56, FLOOR - 3, "K");
      g.set(65, FLOOR - 3, "D");
    },
    {
      boxes: [
        { col: 9, row: FLOOR - 1, w: 1, h: 2, need: 1, color: 1 },
        { col: 22, row: FLOOR, w: 1, h: 1, need: 1, color: 0 },
        { col: 31, row: FLOOR, w: 1, h: 1, need: 1, color: 1 },
        { col: 45, row: FLOOR, w: 1, h: 1, need: 1, color: 1 },
      ],
      springs: [{ col: 44, row: FLOOR, w: 1, vy: -9, target: "s" }],
      switches: [
        { col: 27, row: FLOOR, target: "g1" },
        { col: 35, row: FLOOR, target: "g1" },
        { col: 50, row: FLOOR - 3, target: "s" },
      ],
      gates: [{ id: "g1", col: 40, row: FLOOR - 4, w: 1, h: 5, needAll: true }],
    },
  ),
];

// Mundo 11 — Apagão: a luz apaga periodicamente (BlackoutComponent — docs/re/09-blackout-scale.md).
const WORLD_11: LevelDef[] = [
  // 11-1: valas com espinho que somem no escuro
  build(
    "Lights out",
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
    "In the dark",
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
  // 11-3: amarrados no escuro — paredão, rapel pela chave, esmagador, valas e outro paredão
  build(
    "Rope in the dark",
    60,
    DEEP,
    (g) => {
      spawns(g);
      g.fill(13, 14, FLOOR, FLOOR);
      g.fill(15, 22, FLOOR - 2, FLOOR);
      g.fill(29, 29, FLOOR + 1, DEEP - 1, ".");
      g.set(29, DEEP - 2, "K");
      for (const c of [36, 39]) g.set(c, FLOOR + 1, ".");
      g.fill(43, 44, FLOOR, FLOOR);
      g.fill(45, 52, FLOOR - 2, FLOOR);
      g.set(56, FLOOR, "D");
    },
    {
      ...ROPE,
      blackout: { bright: 1.5, dark: 2.5 },
      thorns: [
        ...[36, 39].map((col) => ({ col, row: FLOOR + 1, w: 1, h: 1 })),
        { col: 33, row: FLOOR - 3, w: 1, h: 1, dir: "down" as const, dy: 3, speed: 1 },
      ],
    },
  ),
  // 11-4: no breu — valas e esmagadores, ponte que pisca, ponte que cai e mais esmagadores
  build(
    "Pitch black",
    68,
    ROWS,
    (g) => {
      spawns(g);
      for (const c of [9, 16, 40]) g.set(c, FLOOR + 1, ".");
      g.fill(25, 31, FLOOR + 1, ROWS - 1, ".");
      g.fill(46, 52, FLOOR + 1, ROWS - 1, ".");
      g.set(56, FLOOR, "K");
      g.set(64, FLOOR, "D");
    },
    {
      blackout: { bright: 1.2, dark: 2.8 },
      blinks: [{ col: 25, row: FLOOR + 1, w: 7, h: 1, on: 2.5, off: 1.5 }],
      falls: fallBridge(46, 52),
      thorns: [
        ...[9, 16, 40].map((col) => ({ col, row: FLOOR + 1, w: 1, h: 1 })),
        { col: 12, row: FLOOR - 3, w: 1, h: 1, dir: "down" as const, dy: 3, speed: 1.25 },
        { col: 20, row: FLOOR - 3, w: 2, h: 1, dir: "down" as const, dy: 3, speed: 0.9 },
        { col: 36, row: FLOOR - 3, w: 1, h: 1, dir: "down" as const, dy: 3, speed: 1.5 },
        { col: 59, row: FLOOR - 3, w: 2, h: 1, dir: "down" as const, dy: 3, speed: 1 },
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
    "Grow",
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
    "Shrink",
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
  // 12-3: encolher na medida, túnel de espinhos, crescer para o platô e outro túnel lá em cima
  build(
    "Just right",
    60,
    ROWS,
    (g) => {
      spawns(g);
      tunnel(g, 14, 19);
      g.fill(31, 58, FLOOR - 2, FLOOR);
      g.fill(40, 45, 0, FLOOR - 4);
      g.set(50, FLOOR - 3, "K");
      g.set(55, FLOOR - 3, "D");
    },
    {
      thorns: [
        { col: 14, row: FLOOR, w: 6, h: 1, dir: "down" },
        { col: 40, row: FLOOR - 3, w: 6, h: 1, dir: "down" },
      ],
      switches: [
        { col: 10, row: FLOOR, target: "", scale: -0.006, dieSmall: true },
        { col: 26, row: FLOOR, target: "", scale: 0.02 },
        { col: 36, row: FLOOR - 3, target: "", scale: -0.006, dieSmall: true },
      ],
    },
  ),
  // 12-4: crescer, encolher no túnel, crescer para o muro e encolher de novo para o último túnel
  build(
    "Right size",
    72,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(13, 70, FLOOR - 2, FLOOR);
      g.fill(28, 33, 0, FLOOR - 4);
      g.fill(44, 70, FLOOR - 5, FLOOR - 3);
      g.fill(54, 59, 0, FLOOR - 7);
      g.set(37, FLOOR - 3, "K");
      g.set(66, FLOOR - 6, "D");
    },
    {
      thorns: [
        { col: 28, row: FLOOR - 3, w: 6, h: 1, dir: "down" },
        { col: 54, row: FLOOR - 6, w: 6, h: 1, dir: "down" },
      ],
      switches: [
        { col: 9, row: FLOOR, target: "", scale: 0.015 },
        { col: 22, row: FLOOR - 3, target: "", scale: -0.006, dieSmall: true },
        { col: 41, row: FLOOR - 3, target: "", scale: 0.015 },
        { col: 50, row: FLOOR - 6, target: "", scale: -0.006, dieSmall: true },
      ],
    },
  ),
];

// Mundo 13 — Mistura: as mecânicas dos mundos anteriores combinadas; o que é "de todos" escala com 2 a 4.
const WORLD_13: LevelDef[] = [
  // 13-1: ponte de caixa de todos, revezamento de 1 s, caixas nos botões e elevador de todos
  build(
    "All at once",
    66,
    ROWS + 1,
    (g) => {
      spawns(g);
      g.fill(13, 14, FLOOR + 1, FLOOR + 2, ".");
      g.set(37, FLOOR, "#");
      g.set(44, FLOOR, "#");
      g.set(52, FLOOR, "K");
      g.fill(56, 58, FLOOR + 1, FLOOR + 2, ".");
      g.fill(59, 64, FLOOR - 4, FLOOR + 2);
      g.set(62, FLOOR - 5, "D");
    },
    {
      boxes: [
        { col: 8, row: FLOOR - 1, w: 2, h: 2, need: ALL },
        { col: 32, row: FLOOR, w: 1, h: 1, need: 1 },
        { col: 40, row: FLOOR, w: 1, h: 1, need: 1 },
      ],
      switches: [
        { col: 20, row: FLOOR, target: "g1", timer: 1 },
        { col: 26, row: FLOOR, target: "g1", timer: 1 },
        { col: 36, row: FLOOR, target: "g2" },
        { col: 43, row: FLOOR, target: "g2" },
      ],
      gates: [
        { id: "g1", col: 23, row: FLOOR - 4, w: 1, h: 5 },
        { id: "g2", col: 48, row: FLOOR - 4, w: 1, h: 5, needAll: true },
      ],
      lifts: [{ col: 56, row: FLOOR + 1, w: 3, dy: -5, need: ALL }],
    },
  ),
  // 13-2: vento contrário sobre valas, dois pistões, ponte que cai e esmagador
  build(
    "Against all odds",
    70,
    ROWS,
    (g) => {
      spawns(g);
      for (const c of [12, 19, 26, 34, 42]) g.set(c, FLOOR + 1, ".");
      g.fill(48, 54, FLOOR + 1, ROWS - 1, ".");
      g.set(58, FLOOR, "K");
      g.set(66, FLOOR, "D");
    },
    {
      winds: [{ col: 9, row: 0, w: 21, h: FLOOR + 1, fx: -1.05 }],
      thorns: [
        ...[12, 19, 26, 34, 42].map((col) => ({ col, row: FLOOR + 1, w: 1, h: 1 })),
        { col: 62, row: FLOOR - 3, w: 1, h: 1, dir: "down" as const, dy: 3, speed: 1.25 },
      ],
      pushers: [
        { col: 36, row: FLOOR, w: 1, h: 1, dx: -2 },
        { col: 44, row: FLOOR, w: 1, h: 1, dx: -2 },
      ],
      falls: fallBridge(48, 54),
    },
  ),
  // 13-3: trampolins sobre espinhos, portal de todos através do muro e esmagadores
  build(
    "Jumps and portals",
    66,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(9, 33, FLOOR + 1, ROWS - 1, ".");
      g.fill(6, 8, FLOOR, ROWS - 1);
      for (const c of [13, 20, 27]) g.fill(c, c + 2, FLOOR, ROWS - 1);
      sealedWall(g, 41);
      g.set(52, FLOOR, "K");
      g.set(61, FLOOR, "D");
    },
    {
      thorns: [
        { col: 9, row: FLOOR + 1, w: 25, h: 1 },
        { col: 48, row: FLOOR - 3, w: 1, h: 1, dir: "down" as const, dy: 3, speed: 1 },
        { col: 56, row: FLOOR - 3, w: 2, h: 1, dir: "down" as const, dy: 3, speed: 1.25 },
      ],
      springs: [8, 15, 22, 29].map((col) => ({ col, row: FLOOR - 1, w: 1, vy: -7, vx: 4.5 })),
      warps: [{ col: 38, row: FLOOR, w: 1, h: 1, to: [44, FLOOR], all: true }],
    },
  ),
  // 13-4: zigue-zague de ponta-cabeça no apagão
  build(
    "Inside out in the dark",
    86,
    ROWS,
    (g) => {
      ceiling(g, 86);
      spawns(g);
      for (const c of [10, 30, 50, 70]) g.fill(c, c + 5, FLOOR + 1, ROWS - 1, ".");
      g.set(48, 2, "K");
      g.set(81, FLOOR, "D");
    },
    {
      ...FLIP,
      blackout: { bright: 1.5, dark: 2.5 },
      thorns: [
        ...[10, 30, 50, 70].map((col) => ({ col, row: FLOOR + 1, w: 6, h: 1 })),
        ...[20, 40, 60].map((col) => ({ col, row: 2, w: 6, h: 1, dir: "down" as const })),
      ],
    },
  ),
];

// Mundo 14 — Desafio: combinações mais longas, com menos folga.
const WORLD_14: LevelDef[] = [
  // 14-1: revezamento através do portal, ponte que pisca, revezamento de 0,9 s e portal de todos
  build(
    "Portal clock",
    74,
    ROWS,
    (g) => {
      spawns(g);
      sealedWall(g, 22);
      g.fill(30, 32, FLOOR + 1, ROWS - 1, ".");
      sealedWall(g, 48);
      g.set(58, FLOOR, "K");
      g.set(70, FLOOR, "D");
    },
    {
      switches: [
        { col: 9, row: FLOOR, target: "g1", timer: 1.2 },
        { col: 26, row: FLOOR, target: "g1", timer: 1.2 },
        { col: 37, row: FLOOR, target: "g2", timer: 0.9 },
        { col: 43, row: FLOOR, target: "g2", timer: 0.9 },
      ],
      gates: [
        { id: "g1", col: 14, row: FLOOR - 4, w: 1, h: 5 },
        { id: "g2", col: 40, row: FLOOR - 4, w: 1, h: 5 },
      ],
      blinks: [{ col: 30, row: FLOOR + 1, w: 3, h: 1, on: 1.2, off: 1.5 }],
      thorns: [{ col: 54, row: FLOOR - 3, w: 1, h: 1, dir: "down", dy: 3, speed: 1.25 }],
      warps: [
        { col: 18, row: FLOOR, w: 1, h: 1, to: [24, FLOOR] },
        { col: 46, row: FLOOR, w: 1, h: 1, to: [50, FLOOR], all: true },
      ],
    },
  ),
  // 14-2: caixas coloridas nos botões, dois pistões, torre pela chave e ponte que cai
  build(
    "Colors and pistons",
    72,
    ROWS,
    (g) => {
      spawns(g);
      g.set(12, FLOOR, "#");
      g.set(20, FLOOR, "#");
      for (const c of [30, 38]) g.set(c, FLOOR + 1, ".");
      g.fill(48, 50, FLOOR - 1, FLOOR - 1);
      g.set(49, FLOOR - 2, "K");
      g.fill(55, 61, FLOOR + 1, ROWS - 1, ".");
      g.set(68, FLOOR, "D");
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
      thorns: [30, 38].map((col) => ({ col, row: FLOOR + 1, w: 1, h: 1 })),
      pushers: [
        { col: 32, row: FLOOR, w: 1, h: 1, dx: -2 },
        { col: 40, row: FLOOR, w: 1, h: 1, dx: -2 },
      ],
      falls: fallBridge(55, 61),
    },
  ),
  // 14-3: trilho de todos sob espinhos, pistões e elevador de todos — no apagão
  build(
    "Assembly in the dark",
    66,
    ROWS + 1,
    (g) => {
      spawns(g);
      g.fill(7, 28, FLOOR + 1, FLOOR + 2, ".");
      g.fill(15, 22, 0, 2);
      for (const c of [37, 45]) g.set(c, FLOOR + 1, ".");
      g.fill(52, 54, FLOOR + 1, FLOOR + 2, ".");
      g.fill(55, 64, FLOOR - 4, FLOOR + 2);
      g.set(58, FLOOR - 5, "K");
      g.set(62, FLOOR - 5, "D");
    },
    {
      blackout: { bright: 1.2, dark: 2.8 },
      rails: [{ path: [[7, FLOOR + 1], [13, FLOOR + 1], [13, FLOOR - 3], [26, FLOOR - 3], [26, FLOOR + 1]], w: 3, need: ALL }],
      thorns: [
        { col: 7, row: FLOOR + 1, w: 22, h: 1 },
        { col: 15, row: 3, w: 8, h: 1, dir: "down" },
        ...[37, 45].map((col) => ({ col, row: FLOOR + 1, w: 1, h: 1 })),
      ],
      pushers: [
        { col: 39, row: FLOOR, w: 1, h: 1, dx: -2 },
        { col: 47, row: FLOOR, w: 1, h: 1, dx: -2 },
      ],
      lifts: [{ col: 52, row: FLOOR + 1, w: 3, dy: -5, need: ALL }],
    },
  ),
  // 14-4: encolher para o túnel de espinhos, crescer para o platô e voltar ao normal sob as armadilhas
  build(
    "Size and portals",
    66,
    ROWS,
    (g) => {
      spawns(g);
      tunnel(g, 14, 19);
      g.fill(31, 64, FLOOR - 2, FLOOR);
      g.set(52, FLOOR - 3, "K");
      g.set(61, FLOOR - 3, "D");
    },
    {
      thorns: [{ col: 14, row: FLOOR, w: 6, h: 1, dir: "down" }],
      switches: [
        { col: 10, row: FLOOR, target: "", scale: -0.006, dieSmall: true },
        { col: 26, row: FLOOR, target: "", scale: 0.02 },
        { col: 36, row: FLOOR - 3, target: "", scale: -0.015 },
      ],
      warps: [40, 44, 48].map((col) => ({ col, row: FLOOR - 4, w: 1, h: 1, to: [2, FLOOR] as [number, number] })),
    },
  ),
];

// Mundo 15 — Grande final: fases longas que encadeiam quase todas as mecânicas.
const WORLD_15: LevelDef[] = [
  // 15-1: ponte de caixa de todos, revezamento de 0,9 s, ponte que pisca, pistões, elevador de todos
  // e esmagador no alto
  build(
    "Marathon",
    80,
    ROWS + 1,
    (g) => {
      spawns(g);
      g.fill(13, 14, FLOOR + 1, FLOOR + 2, ".");
      g.fill(32, 34, FLOOR + 1, FLOOR + 2, ".");
      for (const c of [40, 48]) g.set(c, FLOOR + 1, ".");
      g.fill(56, 58, FLOOR + 1, FLOOR + 2, ".");
      g.fill(59, 78, FLOOR - 4, FLOOR + 2);
      g.set(71, FLOOR - 5, "K");
      g.set(75, FLOOR - 5, "D");
    },
    {
      boxes: [{ col: 8, row: FLOOR - 1, w: 2, h: 2, need: ALL }],
      switches: [
        { col: 20, row: FLOOR, target: "g1", timer: 0.9 },
        { col: 26, row: FLOOR, target: "g1", timer: 0.9 },
      ],
      gates: [{ id: "g1", col: 23, row: FLOOR - 4, w: 1, h: 5 }],
      blinks: [{ col: 32, row: FLOOR + 1, w: 3, h: 1, on: 1.2, off: 1.5 }],
      thorns: [
        ...[40, 48].map((col) => ({ col, row: FLOOR + 1, w: 1, h: 1 })),
        { col: 66, row: FLOOR - 7, w: 1, h: 1, dir: "down" as const, dy: 2, speed: 1.25 },
      ],
      pushers: [
        { col: 42, row: FLOOR, w: 1, h: 1, dx: -2 },
        { col: 50, row: FLOOR, w: 1, h: 1, dx: -2 },
      ],
      lifts: [{ col: 56, row: FLOOR + 1, w: 3, dy: -5, need: ALL }],
    },
  ),
  // 15-2: trampolins sobre espinhos, vento contrário sobre valas e revezamento no ventilador
  build(
    "Final storm",
    90,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(9, 33, FLOOR + 1, ROWS - 1, ".");
      g.fill(6, 8, FLOOR, ROWS - 1);
      for (const c of [13, 20, 27]) g.fill(c, c + 2, FLOOR, ROWS - 1);
      for (const c of [39, 46, 53]) g.set(c, FLOOR + 1, ".");
      g.fill(63, 88, FLOOR - 5, FLOOR);
      g.set(77, FLOOR - 6, "K");
      g.set(84, FLOOR - 6, "D");
    },
    {
      thorns: [
        { col: 9, row: FLOOR + 1, w: 25, h: 1 },
        ...[39, 46, 53].map((col) => ({ col, row: FLOOR + 1, w: 1, h: 1 })),
      ],
      springs: [8, 15, 22, 29].map((col) => ({ col, row: FLOOR - 1, w: 1, vy: -7, vx: 4.5 })),
      winds: [
        { col: 36, row: 0, w: 21, h: FLOOR + 1, fx: -1.05 },
        { col: 60, row: 0, w: 3, h: FLOOR + 1, fy: -1.25, target: "fan" },
      ],
      switches: [
        { col: 57, row: FLOOR, target: "fan" },
        { col: 67, row: FLOOR - 6, target: "fan" },
      ],
    },
  ),
  // 15-3: revezamento, valas e esmagadores, ponte que pisca e ponte que cai — quase sempre no escuro
  build(
    "All in the dark",
    82,
    ROWS,
    (g) => {
      spawns(g);
      for (const c of [23, 30, 54]) g.set(c, FLOOR + 1, ".");
      g.fill(39, 45, FLOOR + 1, ROWS - 1, ".");
      g.fill(60, 66, FLOOR + 1, ROWS - 1, ".");
      g.set(70, FLOOR, "K");
      g.set(78, FLOOR, "D");
    },
    {
      blackout: { bright: 1, dark: 3 },
      switches: [
        { col: 9, row: FLOOR, target: "g1", timer: 1 },
        { col: 15, row: FLOOR, target: "g1", timer: 1 },
      ],
      gates: [{ id: "g1", col: 12, row: FLOOR - 4, w: 1, h: 5 }],
      blinks: [{ col: 39, row: FLOOR + 1, w: 7, h: 1, on: 2.5, off: 1.5 }],
      falls: fallBridge(60, 66),
      thorns: [
        ...[23, 30, 54].map((col) => ({ col, row: FLOOR + 1, w: 1, h: 1 })),
        { col: 26, row: FLOOR - 3, w: 1, h: 1, dir: "down" as const, dy: 3, speed: 1.25 },
        { col: 34, row: FLOOR - 3, w: 2, h: 1, dir: "down" as const, dy: 3, speed: 0.9 },
        { col: 50, row: FLOOR - 3, w: 1, h: 1, dir: "down" as const, dy: 3, speed: 1.5 },
        { col: 73, row: FLOOR - 3, w: 2, h: 1, dir: "down" as const, dy: 3, speed: 1 },
      ],
    },
  ),
  // 15-4: a festa inteira — caixa de todos, revezamento, cores, pistões, portal de todos, ponte que
  // cai, esmagador e elevador de todos
  build(
    "Sunset Park",
    106,
    ROWS + 1,
    (g) => {
      spawns(g);
      g.fill(13, 14, FLOOR + 1, FLOOR + 2, ".");
      g.set(34, FLOOR, "#");
      g.set(42, FLOOR, "#");
      for (const c of [52, 60]) g.set(c, FLOOR + 1, ".");
      sealedWall(g, 70);
      g.fill(76, 82, FLOOR + 1, FLOOR + 2, ".");
      g.set(90, FLOOR, "K");
      g.fill(94, 96, FLOOR + 1, FLOOR + 2, ".");
      g.fill(97, 104, FLOOR - 4, FLOOR + 2);
      g.set(101, FLOOR - 5, "D");
    },
    {
      boxes: [
        { col: 8, row: FLOOR - 1, w: 2, h: 2, need: ALL },
        { col: 29, row: FLOOR, w: 1, h: 1, need: 1, color: 0 },
        { col: 37, row: FLOOR, w: 1, h: 1, need: 1, color: 1 },
      ],
      switches: [
        { col: 19, row: FLOOR, target: "g1", timer: 0.9 },
        { col: 25, row: FLOOR, target: "g1", timer: 0.9 },
        { col: 33, row: FLOOR, target: "g2" },
        { col: 41, row: FLOOR, target: "g2" },
      ],
      gates: [
        { id: "g1", col: 22, row: FLOOR - 4, w: 1, h: 5 },
        { id: "g2", col: 47, row: FLOOR - 4, w: 1, h: 5, needAll: true },
      ],
      thorns: [
        ...[52, 60].map((col) => ({ col, row: FLOOR + 1, w: 1, h: 1 })),
        { col: 86, row: FLOOR - 3, w: 1, h: 1, dir: "down" as const, dy: 3, speed: 1.25 },
      ],
      pushers: [
        { col: 54, row: FLOOR, w: 1, h: 1, dx: -2 },
        { col: 62, row: FLOOR, w: 1, h: 1, dx: -2 },
      ],
      warps: [{ col: 68, row: FLOOR, w: 1, h: 1, to: [72, FLOOR], all: true }],
      falls: fallBridge(76, 82),
      lifts: [{ col: 94, row: FLOOR + 1, w: 3, dy: -5, need: ALL }],
    },
  ),
];

/** Ponte invertida (só sólida com o botão ligado) sobre um vão aberto no chão, de `c0` a `c1`. */
const bridgeGap = (g: Grid, c0: number, c1: number, row = FLOOR + 1) => g.fill(c0, c1, row, ROWS - 1, ".");

// Mundo 16 — Corrida do ouro: fases longas no ritmo do PICO PARK 2, com chave enjaulada,
// botões com contagem e pontes que só existem enquanto alguém segura o botão.
const WORLD_16: LevelDef[] = [
  // 16-1: morro com o botão que solta a chave; chave flutuando no vale (torre); escadaria e
  // ponte com contagem de 1,5 s (curta demais para atravessar sozinho) e botão do outro lado
  build(
    "Ghost town",
    64,
    ROWS,
    (g) => {
      spawns(g);
      // morro: degraus de 1 tile até o platô (topo na linha 5)
      g.fill(10, 10, FLOOR, FLOOR);
      g.fill(11, 11, FLOOR - 1, FLOOR);
      g.fill(12, 12, FLOOR - 2, FLOOR);
      g.fill(13, 18, FLOOR - 3, FLOOR);
      g.fill(19, 19, FLOOR - 2, FLOOR);
      g.fill(20, 20, FLOOR - 1, FLOOR);
      g.fill(21, 21, FLOOR, FLOOR);
      // chave flutuando no meio do vale
      g.set(25, FLOOR - 3, "K");
      // escadaria até o platô alto (topo na linha 4)
      for (let i = 0; i < 4; i++) g.fill(31 + i, 31 + i, FLOOR - i, FLOOR);
      g.fill(35, 42, FLOOR - 4, FLOOR);
      // vão sem fundo e o patamar da porta
      bridgeGap(g, 43, 52, FLOOR - 4);
      g.fill(53, 62, FLOOR - 4, FLOOR);
      g.set(58, FLOOR - 5, "D");
    },
    {
      keyLock: "cage",
      switches: [
        { col: 16, row: FLOOR - 4, target: "cage" },
        { col: 40, row: FLOOR - 5, target: "bridge", timer: 1.5 },
        { col: 54, row: FLOOR - 5, target: "bridge", timer: 1.5 },
      ],
      gates: [{ id: "bridge", col: 43, row: FLOOR - 4, w: 10, h: 1, inverted: true }],
    },
  ),
  // 16-2: revezamento na ponte (dois botões de 2,5 s), torre até a plataforma do botão da
  // jaula, e o caixote de todos vira degrau para o patamar da porta
  build(
    "The gorge",
    64,
    ROWS,
    (g) => {
      spawns(g);
      bridgeGap(g, 12, 19);
      g.fill(33, 35, FLOOR - 1, FLOOR - 1);
      g.set(38, FLOOR, "K");
      g.fill(48, 62, FLOOR - 1, FLOOR);
      g.set(58, FLOOR - 2, "D");
    },
    {
      keyLock: "cage",
      switches: [
        { col: 10, row: FLOOR, target: "b1", timer: 1 },
        { col: 21, row: FLOOR, target: "b1", timer: 1 },
        { col: 34, row: FLOOR - 2, target: "cage" },
      ],
      gates: [{ id: "b1", col: 12, row: FLOOR + 1, w: 8, h: 1, inverted: true }],
      boxes: [{ col: 42, row: FLOOR, w: 1, h: 1, need: ALL }],
    },
  ),
  // 16-3 (difícil): amarrados — o caixote de todos fica em cima do botão para segurar a ponte;
  // paredão com corda; botão da jaula, chave e porta lá em cima
  build(
    "Canyon lasso",
    48,
    ROWS,
    (g) => {
      spawns(g);
      bridgeGap(g, 14, 19);
      g.fill(24, 25, FLOOR, FLOOR);
      g.fill(26, 46, FLOOR - 2, FLOOR);
      g.set(35, FLOOR - 3, "K");
      g.set(42, FLOOR - 3, "D");
    },
    {
      ...ROPE,
      keyLock: "cage",
      boxes: [{ col: 8, row: FLOOR, w: 1, h: 1, need: ALL }],
      switches: [
        { col: 11, row: FLOOR, target: "b" },
        { col: 31, row: FLOOR - 3, target: "cage" },
      ],
      gates: [{ id: "b", col: 14, row: FLOOR + 1, w: 6, h: 1, inverted: true }],
    },
  ),
  // 16-4 (difícil): a corrida inteira — revezamento na ponte, vagonete de todos, torre até o
  // botão com atraso que solta a chave, escadaria e a ponte com contagem até a porta
  build(
    "Gold rush",
    86,
    ROWS,
    (g) => {
      spawns(g);
      bridgeGap(g, 10, 17);
      g.fill(24, 35, FLOOR + 1, ROWS - 1, ".");
      g.fill(44, 46, FLOOR - 1, FLOOR - 1);
      g.set(50, FLOOR, "K");
      for (let i = 0; i < 4; i++) g.fill(54 + i, 54 + i, FLOOR - i, FLOOR);
      g.fill(58, 64, FLOOR - 4, FLOOR);
      bridgeGap(g, 65, 74, FLOOR - 4);
      g.fill(75, 84, FLOOR - 4, FLOOR);
      g.set(80, FLOOR - 5, "D");
    },
    {
      keyLock: "cage",
      switches: [
        { col: 8, row: FLOOR, target: "b1", timer: 1 },
        { col: 19, row: FLOOR, target: "b1", timer: 1 },
        { col: 45, row: FLOOR - 2, target: "cage", delay: 3 },
        { col: 62, row: FLOOR - 5, target: "b2", timer: 1.5 },
        { col: 76, row: FLOOR - 5, target: "b2", timer: 1.5 },
      ],
      gates: [
        { id: "b1", col: 10, row: FLOOR + 1, w: 8, h: 1, inverted: true },
        { id: "b2", col: 65, row: FLOOR - 4, w: 10, h: 1, inverted: true },
      ],
      rails: [{ path: [[24, FLOOR + 1], [33, FLOOR + 1]], w: 3, need: ALL }],
    },
  ),
];

export const WORLDS: { name: string; levels: LevelDef[] }[] = [
  { name: "First steps", levels: WORLD_1 },
  { name: "Tied together", levels: WORLD_2 },
  { name: "Against the clock", levels: WORLD_3 },
  { name: "Treacherous ground", levels: WORLD_4 },
  { name: "Gears", levels: WORLD_5 },
  { name: "Gale", levels: WORLD_6 },
  { name: "Springs", levels: WORLD_7 },
  { name: "Upside down", levels: WORLD_8 },
  { name: "Portals", levels: WORLD_9 },
  { name: "Colors", levels: WORLD_10 },
  { name: "Blackout", levels: WORLD_11 },
  { name: "Size", levels: WORLD_12 },
  { name: "Mix", levels: WORLD_13 },
  { name: "Challenge", levels: WORLD_14 },
  { name: "Grand finale", levels: WORLD_15 },
  { name: "Gold rush", levels: WORLD_16 },
];

/** Todas as fases em ordem, com slug "mundo-fase". */
export const LEVELS: (LevelDef & { slug: string })[] = WORLDS.flatMap((w, wi) =>
  w.levels.map((l, li) => ({ ...l, slug: `${wi + 1}-${li + 1}` })),
);
