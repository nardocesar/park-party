import { describe, expect, it } from "vitest";
import { FPS, TILE } from "./constants";
import { parseLevel, type LevelDef } from "./level";
import { countdownSeconds, createWorld, NO_INPUT, resetWorld, step, type GameEvent, type PlayerInput, type World } from "./world";

const RIGHT: PlayerInput = { ...NO_INPUT, right: true };
const LEFT: PlayerInput = { ...NO_INPUT, left: true };

const world = (map: string[], extra: Partial<LevelDef> = {}, players = 1) =>
  createWorld(parseLevel({ name: "t", map, ...extra }), players);

function run(w: World, frames: number, input: PlayerInput | ((f: number) => PlayerInput)) {
  const events: GameEvent[] = [];
  for (let f = 0; f < frames; f++) {
    const i = typeof input === "function" ? input(f) : input;
    step(w, w.players.map(() => i));
    events.push(...w.events);
  }
  return events;
}

describe("chave trancada (liberada por botão)", () => {
  // botão em col 2, chave em col 6; o jogador nasce sobre o botão
  const MAP = ["#..........#", "#..........#", "#..........#", "#.1...K..D.#", "############"];
  const LOCKED: Partial<LevelDef> = { keyLock: "cage", switches: [{ col: 3, row: 3, target: "cage" }] };

  it("não dá para pegar a chave enquanto está trancada", () => {
    const w = world(MAP, { keyLock: "cage", switches: [{ col: 9, row: 3, target: "cage" }] });
    w.players[0].x = 5 * TILE;
    run(w, 30, RIGHT);
    expect(w.key.locked).toBe(true);
    expect(w.key.holder).toBeNull();
  });

  it("o botão libera a chave de vez (mesmo depois de soltar) e o reset tranca de novo", () => {
    const w = world(MAP, LOCKED);
    const events = run(w, 12, RIGHT); // passa pelo botão
    expect(w.key.locked).toBe(false);
    expect(events).toContain("release");
    run(w, 40, RIGHT);
    expect(w.key.holder).toBe(0);
    resetWorld(w);
    expect(w.key.locked).toBe(true);
  });

  it("sem keyLock a chave começa livre", () => {
    expect(world(MAP).key.locked).toBe(false);
  });
});

describe("ponte que só existe com o botão ligado (portão invertido)", () => {
  // vão em cols 4–6; ponte invertida cobrindo o vão; botão em col 2
  const MAP = ["#..........#", "#..........#", "#..........#", "#.1........#", "####...#####", "####...#####"];
  const BRIDGE: Partial<LevelDef> = {
    switches: [{ col: 2, row: 3, target: "b" }],
    gates: [{ id: "b", col: 4, row: 4, w: 3, h: 1, inverted: true }],
  };

  it("começa aberta (atravessável) e fecha quando o botão liga", () => {
    const w = world(MAP, { ...BRIDGE, switches: [{ col: 9, row: 3, target: "b" }] });
    expect(w.gates[0].open).toBe(1);
    // sem o botão, quem anda cai no vão
    const events = run(w, 120, RIGHT);
    expect(events).toContain("death");
  });

  it("com alguém no botão, a ponte segura", () => {
    const w = world(["#..........#", "#..........#", "#..........#", "#.12.......#", "####...#####", "####...#####"], BRIDGE, 2);
    // J1 fica no botão; J2 atravessa a ponte
    for (let f = 0; f < 200; f++) step(w, [NO_INPUT, RIGHT]);
    expect(w.resets).toBe(0);
    expect(w.players[1].x).toBeGreaterThan(7 * TILE);
    expect(w.gates[0].open).toBe(0);
  });

  it("abre de novo quando o botão desliga", () => {
    const w = world(MAP, BRIDGE);
    run(w, 30, NO_INPUT);
    expect(w.gates[0].open).toBe(0);
    run(w, 10, LEFT); // sai do botão
    run(w, 30, NO_INPUT);
    expect(w.gates[0].open).toBe(1);
  });
});

describe("contagem do botão com tempo", () => {
  const MAP = ["#..........#", "#..........#", "#..........#", "#.1........#", "############"];

  it("mostra os segundos restantes depois de soltar e faz tique a cada segundo", () => {
    const w = world(MAP, { switches: [{ col: 2, row: 3, target: "g", timer: 3 }], gates: [{ id: "g", col: 10, row: 1, w: 1, h: 3 }] });
    run(w, 5, NO_INPUT);
    expect(countdownSeconds(w.switches[0])).toBeNull(); // pressionado: sem contagem
    run(w, 15, RIGHT); // sai do botão
    expect(countdownSeconds(w.switches[0])).toBe(3);
    const events = run(w, 3 * FPS, NO_INPUT);
    expect(events.filter((e) => e === "tick")).toHaveLength(2); // 3→2 e 2→1
    expect(countdownSeconds(w.switches[0])).toBeNull();
    expect(w.switches[0].on).toBe(false);
  });

  it("botão com atraso também mostra a contagem até disparar", () => {
    const w = world(MAP, { switches: [{ col: 2, row: 3, target: "g", delay: 2 }], gates: [{ id: "g", col: 10, row: 1, w: 1, h: 3 }] });
    run(w, 2, NO_INPUT);
    expect(countdownSeconds(w.switches[0])).toBe(2);
    run(w, 2 * FPS, NO_INPUT);
    expect(countdownSeconds(w.switches[0])).toBeNull();
    expect(w.switches[0].on).toBe(true);
  });
});
