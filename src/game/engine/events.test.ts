import { describe, expect, it } from "vitest";
import { TILE } from "./constants";
import { parseLevel, type LevelDef } from "./level";
import { createWorld, NO_INPUT, step, type GameEvent, type PlayerInput, type World } from "./world";

const RIGHT: PlayerInput = { ...NO_INPUT, right: true };
const JUMP: PlayerInput = { ...NO_INPUT, jump: true };
const DOWN: PlayerInput = { ...NO_INPUT, down: true };

const world = (map: string[], extra: Partial<LevelDef> = {}, players = 1) =>
  createWorld(parseLevel({ name: "t", map, ...extra }), players);

/** Roda quadros e junta todos os eventos emitidos (na ordem). */
function collect(w: World, frames: number, input: PlayerInput | ((f: number) => PlayerInput)) {
  const all: GameEvent[] = [];
  for (let f = 0; f < frames; f++) {
    const i = typeof input === "function" ? input(f) : input;
    step(w, w.players.map(() => i));
    all.push(...w.events);
  }
  return all;
}

const count = (events: GameEvent[], e: GameEvent) => events.filter((x) => x === e).length;

describe("eventos para o som", () => {
  const FLAT = ["#..........#", "#..........#", "#..........#", "#.1........#", "############"];

  it("pulo emite um evento só no quadro em que aperta", () => {
    const w = world(FLAT);
    const events = collect(w, 30, JUMP);
    expect(count(events, "jump")).toBe(1);
  });

  it("a lista de eventos é limpa a cada quadro", () => {
    const w = world(FLAT);
    step(w, [JUMP]);
    expect(w.events).toContain("jump");
    step(w, [NO_INPUT]);
    expect(w.events).toEqual([]);
  });

  it("pegar a chave, abrir a porta, entrar e concluir", () => {
    const w = world(["#..........#", "#..........#", "#..........#", "#.1.K...D..#", "############"]);
    const events = collect(w, 200, RIGHT);
    expect(events.indexOf("key")).toBeGreaterThanOrEqual(0);
    expect(events.indexOf("door")).toBeGreaterThan(events.indexOf("key"));
    expect(events.indexOf("enter")).toBeGreaterThanOrEqual(events.indexOf("door"));
    expect(events.at(-1)).toBe("clear");
    expect(w.status).toBe("cleared");
  });

  it("passar a chave para outro jogador emite troca de dono", () => {
    const w = world(["#..........#", "#..........#", "#..........#", "#.1K..2....#", "############"], {}, 2);
    const events: GameEvent[] = [];
    const tick = (j1 = NO_INPUT) => {
      step(w, [j1, NO_INPUT]);
      events.push(...w.events);
    };
    // J1 anda até a chave e a pega
    for (let f = 0; f < 15; f++) tick(RIGHT);
    for (let f = 0; f < 15; f++) tick();
    expect(w.key.holder).toBe(0);
    // J2 encosta na chave (que flutua acima de J1)
    Object.assign(w.players[1], { x: w.key.x, y: w.key.y });
    tick();
    expect(count(events, "key")).toBe(1);
    expect(count(events, "keyPass")).toBeGreaterThanOrEqual(1);
  });

  it("cair no buraco emite morte", () => {
    const w = world(["#..........#", "#..........#", "#..........#", "#.1........#", "####..######", "####..######"]);
    const events = collect(w, 200, RIGHT);
    expect(events).toContain("death");
    expect(w.resets).toBeGreaterThan(0);
  });

  it("botão ligando emite um evento", () => {
    const w = world(FLAT, { switches: [{ col: 4, row: 3, target: "g" }], gates: [{ id: "g", col: 9, row: 1, w: 1, h: 3 }] });
    const events = collect(w, 60, RIGHT);
    expect(count(events, "switch")).toBe(1);
  });

  it("trampolim, inversão de gravidade, portal e chão que cai emitem eventos", () => {
    const spring = world(["#..........#", "#..........#", "#.1........#", "#..........#", "############"], {
      springs: [{ col: 2, row: 3, w: 1, vy: -6 }],
    });
    expect(collect(spring, 40, NO_INPUT)).toContain("spring");

    const flip = world(["#..........#", "#..........#", "#..........#", "#.1........#", "############"], { flipGravity: true });
    expect(collect(flip, 3, DOWN)).toContain("flip");

    const warp = world(FLAT, { warps: [{ col: 4, row: 3, w: 1, h: 1, to: [8, 1] }] });
    expect(collect(warp, 60, RIGHT)).toContain("warp");

    const fall = world(["#..........#", "#..........#", "#..........#", "#.1........#", "##...#######", "############"], {
      falls: [{ col: 2, row: 4, w: 3, h: 1 }],
    });
    fall.players[0].y = 3 * TILE + (TILE - fall.players[0].h) - 1;
    expect(collect(fall, 30, NO_INPUT)).toContain("crumble");
  });
});
