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
  // 1-4: a caixa grande (2 jogadores) cai no buraco e vira ponte; a pequena segura o botão do portão.
  // Uma linha a mais de chão para o buraco ter fundo (2 tiles: quem cai fica preso, R reinicia).
  build(
    "Caixa de ponte",
    52,
    ROWS + 1,
    (g) => {
      spawns(g);
      g.fill(15, 17, FLOOR + 1, FLOOR + 2, ".");
      g.set(24, FLOOR, "K");
      g.set(38, FLOOR, "#");
      g.set(47, FLOOR, "D");
    },
    {
      boxes: [
        { col: 8, row: FLOOR - 1, w: 3, h: 2, need: 2 },
        { col: 30, row: FLOOR, w: 1, h: 1, need: 1 },
      ],
      switches: [{ col: 37, row: FLOOR, target: "g1" }],
      gates: [{ id: "g1", col: 42, row: FLOOR - 4, w: 1, h: 5 }],
    },
  ),
  // 1-5: o elevador só sobe com os dois em cima (empilhados contam) até o topo do muro
  build(
    "Todos no elevador",
    48,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(10, 13, FLOOR + 1, ROWS - 1, ".");
      g.fill(14, 22, FLOOR - 2, ROWS - 1);
      g.set(18, FLOOR - 3, "K");
      g.set(42, FLOOR, "D");
    },
    { lifts: [{ col: 10, row: FLOOR + 1, w: 4, dy: -3, need: 2 }] },
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
  // 2-3: torre humana no degrau duplo leva o primeiro ao paredão; ele iça o segundo
  build(
    "Paredão",
    40,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(20, 21, FLOOR, FLOOR);
      g.fill(22, 38, FLOOR - 2, FLOOR);
      g.set(30, FLOOR - 3, "K");
      g.set(36, FLOOR - 3, "D");
    },
    ROPE,
  ),
  // 2-4: rapel num poço estreito (1 tile) para pegar a chave e depois o paredão
  build(
    "Rapel e paredão",
    44,
    DEEP,
    (g) => {
      spawns(g);
      g.fill(12, 12, FLOOR + 1, DEEP - 1, ".");
      g.set(12, DEEP - 2, "K");
      g.fill(24, 25, FLOOR, FLOOR);
      g.fill(26, 42, FLOOR - 2, FLOOR);
      g.set(39, FLOOR - 3, "D");
    },
    ROPE,
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
  // 3-3: o portão exige os dois botões ao mesmo tempo; caixas seguram os botões
  build(
    "Caixas nos botões",
    44,
    ROWS,
    (g) => {
      spawns(g);
      g.set(12, FLOOR, "#");
      g.set(20, FLOOR, "#");
      g.set(28, FLOOR, "K");
      g.set(38, FLOOR, "D");
    },
    {
      boxes: [
        { col: 7, row: FLOOR, w: 1, h: 1, need: 1 },
        { col: 16, row: FLOOR, w: 1, h: 1, need: 1 },
      ],
      switches: [
        { col: 11, row: FLOOR, target: "g1" },
        { col: 19, row: FLOOR, target: "g1" },
      ],
      gates: [{ id: "g1", col: 24, row: FLOOR - 4, w: 1, h: 5, needAll: true }],
    },
  ),
  // 3-4: dois revezamentos com paredes que piscam no meio
  build(
    "Corrida",
    54,
    ROWS,
    (g) => {
      spawns(g);
      g.set(46, FLOOR, "K");
      g.set(50, FLOOR, "D");
    },
    {
      switches: [
        { col: 10, row: FLOOR, target: "g1", timer: 2.5 },
        { col: 18, row: FLOOR, target: "g1", timer: 2.5 },
        { col: 32, row: FLOOR, target: "g2", timer: 2.5 },
        { col: 40, row: FLOOR, target: "g2", timer: 2.5 },
      ],
      gates: [
        { id: "g1", col: 14, row: FLOOR - 4, w: 1, h: 5 },
        { id: "g2", col: 36, row: FLOOR - 4, w: 1, h: 5 },
      ],
      blinks: [
        { col: 24, row: FLOOR - 4, w: 1, h: 5, on: 1, off: 1 },
        { col: 28, row: FLOOR - 4, w: 1, h: 5, on: 1, off: 1, phase: 0.5 },
      ],
    },
  ),
];

// Mundo 4 — Chão traiçoeiro: chão que cai e espinhos (FallBoxComponent, ThornComponent — docs/re/04-fall-thorn.md).
const fallBridge = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ col: from + i, row: FLOOR + 1, w: 1, h: 1 }));

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
  // 4-3: esmagadores que sobem e descem — passar quando estão subindo
  build(
    "Esmagadores",
    44,
    ROWS,
    (g) => {
      spawns(g);
      g.set(32, FLOOR, "K");
      g.set(40, FLOOR, "D");
    },
    {
      thorns: [
        { col: 12, row: FLOOR - 3, w: 1, h: 1, dir: "down", dy: 3, speed: 1 },
        { col: 18, row: FLOOR - 3, w: 1, h: 1, dir: "down", dy: 3, speed: 1.25 },
        { col: 24, row: FLOOR - 3, w: 2, h: 1, dir: "down", dy: 3, speed: 0.75 },
      ],
    },
  ),
  // 4-4: ponte que cai com espinho móvel por cima — não dá para esperar nem pular
  build(
    "Sem volta",
    44,
    ROWS,
    (g) => {
      spawns(g);
      g.fill(12, 21, FLOOR + 1, ROWS - 1, ".");
      g.set(26, FLOOR, "K");
      g.set(38, FLOOR, "D");
    },
    {
      falls: fallBridge(12, 21),
      thorns: [{ col: 12, row: FLOOR - 1, w: 1, h: 1, dx: 9, speed: 0.6 }],
    },
  ),
];

// Mundo 5 — Engrenagens: trilhos e paredes que empurram
// (LinePathLift, UpDownLift, MoveWall — docs/re/05-rails.md).
const ALL = 99; // trilho que exige todos os jogadores

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

export const WORLDS: { name: string; levels: LevelDef[] }[] = [
  { name: "Primeiros passos", levels: WORLD_1 },
  { name: "Amarrados", levels: WORLD_2 },
  { name: "Contra o tempo", levels: WORLD_3 },
  { name: "Chão traiçoeiro", levels: WORLD_4 },
  { name: "Engrenagens", levels: WORLD_5 },
  { name: "Ventania", levels: WORLD_6 },
  { name: "Molas", levels: WORLD_7 },
];

/** Todas as fases em ordem, com slug "mundo-fase". */
export const LEVELS: (LevelDef & { slug: string })[] = WORLDS.flatMap((w, wi) =>
  w.levels.map((l, li) => ({ ...l, slug: `${wi + 1}-${li + 1}` })),
);
