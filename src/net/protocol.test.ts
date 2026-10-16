import { describe, expect, it } from "vitest";
import { cleanNick, parseClientMsg } from "./protocol";

const parse = (m: unknown) => parseClientMsg(JSON.stringify(m));

describe("protocolo", () => {
  it("aceita mensagens válidas", () => {
    expect(parse({ t: "join", code: null, nick: " Ana ", token: null })).toEqual({ t: "join", code: null, nick: "Ana", token: null });
    expect(parse({ t: "join", code: "ABCD", nick: "Bia", token: "x" })).toEqual({ t: "join", code: "ABCD", nick: "Bia", token: "x" });
    expect(parse({ t: "cowboy", dir: -1 })).toEqual({ t: "cowboy", dir: -1 });
    expect(parse({ t: "pick", slug: "12-3" })).toEqual({ t: "pick", slug: "12-3" });
    expect(parse({ t: "pick", slug: "random" })).toEqual({ t: "pick", slug: "random" });
    expect(parse({ t: "input", f: 120, bits: 15 })).toEqual({ t: "input", f: 120, bits: 15 });
    expect(parse({ t: "ping", at: 12.5 })).toEqual({ t: "ping", at: 12.5 });
    for (const t of ["start", "toLobby", "restart", "resync"]) expect(parse({ t })).toEqual({ t });
  });

  it("recusa mensagens inválidas", () => {
    expect(parseClientMsg("not json")).toBeNull();
    expect(parseClientMsg("null")).toBeNull();
    expect(parseClientMsg(" ".repeat(600))).toBeNull();
    expect(parse({ t: "nope" })).toBeNull();
    expect(parse({ t: "join", code: "ABIO", nick: "Ana", token: null })).toBeNull(); // I e O fora do alfabeto
    expect(parse({ t: "join", code: "abcd", nick: "Ana", token: null })).toBeNull();
    expect(parse({ t: "join", code: null, nick: "", token: null })).toBeNull();
    expect(parse({ t: "join", code: null, nick: "x".repeat(17), token: null })).toBeNull();
    expect(parse({ t: "join", code: null, nick: "Ana", token: "x".repeat(65) })).toBeNull();
    expect(parse({ t: "cowboy", dir: 2 })).toBeNull();
    expect(parse({ t: "pick", slug: "../etc" })).toBeNull();
    expect(parse({ t: "input", f: -1, bits: 0 })).toBeNull();
    expect(parse({ t: "input", f: 1.5, bits: 0 })).toBeNull();
    expect(parse({ t: "input", f: 1, bits: 16 })).toBeNull();
    expect(parse({ t: "ping", at: "x" })).toBeNull();
  });

  it("apelido: tira controle e espaços das pontas; 1 a 16 caracteres", () => {
    expect(cleanNick("  Zé\u0007 ")).toBe("Zé");
    expect(cleanNick("   ")).toBeNull();
    expect(cleanNick("<b>Ana</b>")).toBe("<b>Ana</b>"); // HTML vira texto na UI, não é removido
  });
});
