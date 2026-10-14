/**
 * Pixel art em grades de texto: cada caractere é um pixel e `.` é transparente.
 * Os cowboys têm 14×16: a caixa de colisão (14×14) são as 14 linhas de baixo e o chapéu
 * sobra 2 px para cima.
 */
export type Sprite = { rows: string[]; pal: Record<string, string> };

export const PLAYER_COLORS = ["#f97316", "#38bdf8", "#f472b6", "#4ade80", "#a78bfa", "#facc15", "#ef4444", "#e5e7eb"];
const PLAYER_SHADES = ["#c2410c", "#0284c7", "#db2777", "#16a34a", "#7c3aed", "#ca8a04", "#b91c1c", "#9ca3af"];

const BODY: Record<string, string> = {
  k: "#21130c", // contorno
  s: "#f2b37e", // pele
  S: "#c7804f",
  e: "#1a1010", // pupila
  w: "#ffffff",
  b: "#3a2210", // cinto
  g: "#ffd23f", // fivela
  p: "#3c4a78", // calça
  P: "#2c365a",
  o: "#5a3214", // bota
  O: "#3c2210",
};

const HAT = ["....kkkkkk....", "...khhHHhhk...", "...khhhhhhk...", ".kkkBBBBBBkkk.", "khhhhhhhhhhhhk"];
const BELT = "kkbbbbgbbbbbkk";
const LEGS = [".kpppppPpppk..", ".kpPk..kpPk...", ".koOk..koOk..."];
// passo: pernas juntas, alternando com a pose parada
const LEGS_WALK = [".kpppppPpppk..", "..kpPkkpPk....", "..koOkkoOk...."];

const looks: { pal: Record<string, string>; rows: string[] }[] = [
  {
    // J1 · O Cowboy: chapéu marrom e bandana vermelha
    pal: { h: "#8a5226", H: "#b2743c", r: "#c8322b" },
    rows: [
      ...HAT,
      ".kkkkkkkkkkkk.",
      "..ksssssswsk..",
      "..ksssssseSk..",
      "..kSssssssSk..",
      "..krrrrrrrrk..",
      ".kcccrrrcccck.",
      "kscccccccccCsk",
      BELT,
    ],
  },
  {
    // J2 · O Pistoleiro: loiro, chapéu claro e colete
    pal: { h: "#e8dcc0", H: "#fff6e2", y: "#f2cf5a", v: "#2c3f8f" },
    rows: [
      ...HAT,
      ".kkyyyyyyyykk.",
      "..kyssssswsk..",
      "..kysssssesk..",
      "..kySsssssSk..",
      "..kkssssskkk..",
      ".kvvccccccvvk.",
      "ksvvccccccvvsk",
      BELT,
    ],
  },
  {
    // J3 · O Grandalhão: barba cheia e chapéu cinza
    pal: { h: "#6e6a72", H: "#9a96a0", d: "#5a2e14" },
    rows: [
      ...HAT,
      ".kkkkkkkkkkkk.",
      "..ksssssswsk..",
      "..ksssssseSk..",
      "..kddsssssdk..",
      "..kddddddddk..",
      ".kcdddddddcck.",
      "kscccccccccCsk",
      BELT,
    ],
  },
  {
    // J4 · El Sombrero: sombrero e poncho listrado
    pal: { h: "#d9b25a", H: "#f2d27e", m: "#3a2210", x: "#ffd23f" },
    rows: [
      ".....kkkk.....",
      "....khHHhk....",
      "....khhhhk....",
      "..kkBBBBBBkk..",
      "khhhhhhhhhhhhk",
      ".kkkkkkkkkkkk.",
      "..ksssssswsk..",
      "..ksssssseSk..",
      "..ksmmmmmmsk..",
      ".kcccccccccck.",
      "kcxcxcxcxcxcCk",
      "kccccccccccCCk",
      "kCCCCCCCCCCCCk",
    ],
  },
  {
    // J5 · O Pregador: chapéu preto de copa reta e colarinho branco
    pal: { h: "#2a2a2e", H: "#4a4a52" },
    rows: [
      "..............",
      "....kkkkkk....",
      "...khhhhhhk...",
      ".kkkBBBBBBkkk.",
      "khhhhhhhhhhhhk",
      ".kkkkkkkkkkkk.",
      "..ksssssswsk..",
      "..ksssssseSk..",
      "..kSssssssSk..",
      "..kwwkkkkwwk..",
      ".kccwwkkwwcck.",
      "kscccccccccCsk",
      BELT,
    ],
  },
  {
    // J6 · A Xerife: cabelo comprido e estrela no peito
    pal: { h: "#c9a36a", H: "#e0bc7a", r: "#7a3e12", x: "#ffd23f" },
    rows: [
      ...HAT,
      ".krrrrrrrrrrk.",
      ".krsssssswrk..",
      ".krsssssserk..",
      ".krSsssssSrk..",
      ".krrsssssrrk..",
      ".kcccxcccccck.",
      "kscccccccccCsk",
      BELT,
    ],
  },
  {
    // J7 · O Apostador: chapéu-coco, bigode fino e colete sobre camisa branca
    pal: { h: "#3c2a20", H: "#5a4030", m: "#3a2210" },
    rows: [
      "..............",
      ".....kkkk.....",
      "....khhHhk....",
      "...kBBBBBBk...",
      "..khhhhhhhhk..",
      "..kkkkkkkkkk..",
      "..ksssssswsk..",
      "..ksssssseSk..",
      "..ksmmmmmmsk..",
      "..kSssssssSk..",
      ".kcwwcccwwcck.",
      "kscccwwwcccCsk",
      BELT,
    ],
  },
  {
    // J8 · O Garimpeiro: chapéu remendado e barba branca
    pal: { h: "#7a5a3a", H: "#9a7a52", d: "#f0f0f0", q: "#a8743a" },
    rows: [
      "....kkkkkk....",
      "...khhHhhhk...",
      "...khhhhhqk...",
      ".kkkBBBBBBkkk.",
      "khhhhhhhhhhhhk",
      ".kkkkkkkkkkkk.",
      "..ksssssswsk..",
      "..ksssssseSk..",
      "..kdddssdddk..",
      "..kddddddddk..",
      ".kcdddddddcck.",
      "kscccccccccCsk",
      BELT,
    ],
  },
];

const cowboy = (i: number, legs: string[]): Sprite => ({
  rows: [...looks[i].rows, ...legs],
  // faixa do chapéu e roupa na cor do jogador
  pal: { ...BODY, ...looks[i].pal, c: PLAYER_COLORS[i], C: PLAYER_SHADES[i], B: PLAYER_COLORS[i] },
});

export const COWBOYS: Sprite[] = looks.map((_, i) => cowboy(i, LEGS));
export const COWBOYS_WALK: Sprite[] = looks.map((_, i) => cowboy(i, LEGS_WALK));

/** Chave dourada, 12×7. */
export const KEY_SPRITE: Sprite = {
  rows: ["..kkk.......", ".kgggk......", "kgg.ggkkkkkk", "kgg.gggggggk", ".kgggk.kgk.k", "..kkk..kgk..", "........k..."],
  pal: { k: "#6b4a10", g: "#ffd23f" },
};

/** Cacto apontando para cima, 16×10: ocupa a metade de baixo da célula, como a área mortal. */
export const CACTUS: Sprite = {
  rows: [
    ".......ff.......",
    "......kgLk......",
    "..k...kwGk...k..",
    ".kgk..kgGk..kGk.",
    ".kwk..kgGk..kGk.",
    ".kggkkkgwkkkgGk.",
    "..kgggggGGGGGk..",
    "......kgGk......",
    "......kwGk......",
    "....dddddddd....",
  ],
  pal: { k: "#1f3a1a", g: "#3f8f3a", G: "#2f6b2c", L: "#6cc35a", w: "#e8f0c0", f: "#f472b6", d: "#7a4420" },
};
