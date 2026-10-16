import type { LevelDef } from "@/game/engine/level";

/** Dois jogadores andando para a direita pegam a chave, abrem a porta e entram (~80 quadros). */
export const TINY: LevelDef & { slug: string } = {
  slug: "99-1",
  name: "Tiny",
  map: [
    "#............#",
    "#............#",
    "#............#",
    "#12..K....D..#",
    "##############",
  ],
};
