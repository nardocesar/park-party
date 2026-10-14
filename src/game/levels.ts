import type { LevelDef } from "./engine/level";

/** Monta o mapa ASCII por retângulos para evitar erro de alinhamento. */
function build(name: string, cols: number, rows: number, draw: (g: Grid) => void): LevelDef {
  const cells = Array.from({ length: rows }, () => Array<string>(cols).fill("."));
  const g: Grid = {
    fill: (c0, c1, r0, r1, ch = "#") => {
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) cells[r][c] = ch;
    },
    set: (c, r, ch) => {
      cells[r][c] = ch;
    },
  };
  // paredes laterais e chão (2 linhas)
  g.fill(0, 0, 0, rows - 1);
  g.fill(cols - 1, cols - 1, 0, rows - 1);
  g.fill(0, cols - 1, rows - 2, rows - 1);
  draw(g);
  return { name, map: cells.map((r) => r.join("")) };
}

type Grid = {
  fill: (c0: number, c1: number, r0: number, r1: number, ch?: string) => void;
  set: (c: number, r: number, ch: string) => void;
};

const ROWS = 11;
const FLOOR = ROWS - 3; // última linha jogável acima do chão

const spawns = (g: Grid) => "1234".split("").forEach((d, i) => g.set(2 + i, FLOOR, d));

export const LEVELS: LevelDef[] = [
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
];
