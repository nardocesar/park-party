import { describe, expect, it } from "vitest";
import { MAX_PLAYERS } from "../engine/constants";
import { CACTUS, COWBOY_NAMES, COWBOYS, COWBOYS_WALK, KEY_SPRITE, PLAYER_COLORS, type Sprite } from "./sprites";

const all: [string, Sprite][] = [
  ...COWBOYS.map((s, i) => [`cowboy ${i + 1}`, s] as [string, Sprite]),
  ...COWBOYS_WALK.map((s, i) => [`cowboy ${i + 1} andando`, s] as [string, Sprite]),
  ["chave", KEY_SPRITE],
  ["cacto", CACTUS],
];

describe("sprites", () => {
  it.each(all)("%s tem todas as linhas da mesma largura", (_, s) => {
    expect(new Set(s.rows.map((r) => r.length)).size).toBe(1);
  });

  it.each(all)("%s só usa cores definidas na paleta", (_, s) => {
    const used = new Set(s.rows.join("").replaceAll(".", ""));
    for (const ch of used) expect(s.pal[ch], `cor "${ch}"`).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("há um cowboy (parado e andando) para cada jogador, com 14×16 px", () => {
    expect(COWBOYS).toHaveLength(MAX_PLAYERS);
    expect(COWBOYS_WALK).toHaveLength(MAX_PLAYERS);
    for (const s of [...COWBOYS, ...COWBOYS_WALK]) {
      expect(s.rows).toHaveLength(16);
      expect(s.rows[0]).toHaveLength(14);
    }
  });

  it("cada cowboy tem um nome", () => {
    expect(COWBOY_NAMES).toHaveLength(COWBOYS.length);
  });

  it("a roupa de cada cowboy usa a cor do jogador", () => {
    COWBOYS.forEach((s, i) => expect(s.pal.c).toBe(PLAYER_COLORS[i]));
  });
});
