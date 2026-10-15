import { MAX_PLAYERS } from "./engine/constants";
import { defaultDevices, DEVICES, type Device } from "./input";

/** Um jogador do time: quem o controla e qual cowboy (0–7) ele escolheu. */
export type Seat = { devices: Device[]; cowboy: number };
export type Team = Seat[];
export type LobbyAction = "jump" | "left" | "right" | "down";

const COWBOYS = MAX_PLAYERS;

/** Próximo cowboy livre a partir de `from`, andando `dir` (dá a volta); null se não houver. */
function nextFree(team: Team, from: number, dir: 1 | -1): number | null {
  const taken = new Set(team.map((s) => s.cowboy));
  for (let k = 1; k <= COWBOYS; k++) {
    const c = (((from + dir * k) % COWBOYS) + COWBOYS) % COWBOYS;
    if (!taken.has(c)) return c;
  }
  return null;
}

/**
 * Lobby estilo PICO PARK: pulo entra (com o primeiro cowboy livre), ← → trocam de cowboy
 * sem repetir o de ninguém, baixo sai. Devolve o mesmo time quando nada muda.
 */
export function lobbyPress(team: Team, device: Device, action: LobbyAction): Team {
  const i = team.findIndex((s) => s.devices.includes(device));
  if (i < 0) {
    if (action !== "jump" || team.length >= MAX_PLAYERS) return team;
    return [...team, { devices: [device], cowboy: nextFree(team, -1, 1)! }];
  }
  if (action === "down") return team.filter((_, k) => k !== i);
  if (action === "jump") return team;
  const cowboy = nextFree(team, team[i].cowboy, action === "right" ? 1 : -1);
  if (cowboy === null) return team;
  return team.map((s, k) => (k === i ? { ...s, cowboy } : s));
}

/** Time na URL: `k0:5,g2:0` (dispositivo:cowboy, na ordem dos jogadores). */
export const formatTeam = (team: Team) => team.map((s) => `${s.devices[0]}:${s.cowboy}`).join(",");

export function parseTeam(text: string): Team | null {
  const team: Team = [];
  for (const part of text.split(",")) {
    const [device, cowboy] = part.split(":");
    const c = Number(cowboy);
    if (!DEVICES.includes(device as Device) || cowboy === "" || !Number.isInteger(c) || c < 0 || c >= COWBOYS) return null;
    team.push({ devices: [device as Device], cowboy: c });
  }
  const unique = (xs: unknown[]) => new Set(xs).size === xs.length;
  if (team.length > MAX_PLAYERS || !unique(team.map((s) => s.devices[0])) || !unique(team.map((s) => s.cowboy))) return null;
  return team;
}

/** Sem lobby (`?players=N`): cowboys na ordem e a regra padrão de teclado + controle. */
export const defaultTeam = (n: number): Team =>
  Array.from({ length: n }, (_, i) => ({ devices: defaultDevices(i, n), cowboy: i }));

type Query = { team?: string | string[]; players?: string | string[] };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Time a partir da URL: `?team=` do lobby ou, sem ele, `?players=N` (padrão 2). `query` repete a escolha nos links. */
export function teamFromQuery(q: Query): { team: Team; query: string } {
  const team = parseTeam(first(q.team) ?? "");
  if (team) return { team, query: `team=${formatTeam(team)}` };
  const n = Math.min(MAX_PLAYERS, Math.max(1, Number(first(q.players)) || 2));
  return { team: defaultTeam(n), query: `players=${n}` };
}
