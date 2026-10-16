import type { Change } from "./timeline";

export type ErrorCode = "not_found" | "full" | "not_host" | "bad_state";

export type MemberView = { id: string; nick: string; cowboy: number; host: boolean; online: boolean; playing: boolean };
export type RoomView = { code: string; state: "lobby" | "playing" | "paused"; slug: string | null; members: MemberView[] };

export type ClientMsg =
  | { t: "join"; code: string | null; nick: string; token: string | null }
  | { t: "cowboy"; dir: 1 | -1 }
  | { t: "pick"; slug: string }
  | { t: "start" }
  | { t: "toLobby" }
  | { t: "restart" }
  | { t: "resync" }
  | { t: "input"; f: number; bits: number }
  | { t: "ping"; at: number };

export type ServerMsg =
  | { t: "welcome"; you: string; token: string }
  | { t: "room"; room: RoomView }
  | { t: "error"; code: ErrorCode }
  | { t: "start"; slug: string; seats: { id: string; cowboy: number }[] }
  | { t: "tick"; s: number; changes: Change[]; resets: number[] }
  | { t: "hash"; s: number; h: number }
  | { t: "snapshot"; s: number; world: string; bits: number[] }
  | { t: "paused"; ids: string[]; ms: number }
  | { t: "resume"; s: number; inMs: number }
  | { t: "cleared"; timeMs: number; bestMs: number | null }
  | { t: "pong"; at: number; frame: number };

export const MAX_NICK = 16;
export const MAX_MSG = 512;
/** 4 letras sem I nem O (não se confundem com 1 e 0). */
export const CODE_RE = /^[A-HJ-NP-Z]{4}$/;
const SLUG_RE = /^(\d{1,2}-\d{1,2}|random)$/;

/** Apelido sem caracteres de controle nem espaços nas pontas; null se ficar vazio ou longo demais. */
export function cleanNick(raw: string): string | null {
  const nick = raw.replace(/\p{Cc}/gu, "").trim();
  return nick.length >= 1 && nick.length <= MAX_NICK ? nick : null;
}

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Valida o que vem do cliente: qualquer coisa fora do formato vira null (o hub derruba o socket). */
export function parseClientMsg(raw: string): ClientMsg | null {
  if (raw.length > MAX_MSG) return null;
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof m !== "object" || m === null) return null;
  const o = m as Record<string, unknown>;
  switch (o.t) {
    case "join": {
      const code = o.code === null ? null : typeof o.code === "string" && CODE_RE.test(o.code) ? o.code : undefined;
      const token = o.token === null ? null : typeof o.token === "string" && o.token.length <= 64 ? o.token : undefined;
      const nick = typeof o.nick === "string" ? cleanNick(o.nick) : null;
      if (code === undefined || token === undefined || nick === null) return null;
      return { t: "join", code, nick, token };
    }
    case "cowboy":
      return o.dir === 1 || o.dir === -1 ? { t: "cowboy", dir: o.dir } : null;
    case "pick":
      return typeof o.slug === "string" && SLUG_RE.test(o.slug) ? { t: "pick", slug: o.slug } : null;
    case "start":
      return { t: "start" };
    case "toLobby":
      return { t: "toLobby" };
    case "restart":
      return { t: "restart" };
    case "resync":
      return { t: "resync" };
    case "input":
      return isInt(o.f, 0, 10_000_000) && isInt(o.bits, 0, 15) ? { t: "input", f: o.f, bits: o.bits } : null;
    case "ping":
      return typeof o.at === "number" && Number.isFinite(o.at) ? { t: "ping", at: o.at } : null;
    default:
      return null;
  }
}
