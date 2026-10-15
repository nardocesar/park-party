import { describe, expect, it } from "vitest";
import { defaultTeam, formatTeam, lobbyPress, parseTeam, teamFromQuery, type Team } from "./lobby";

describe("lobby: entrar, trocar de cowboy e sair", () => {
  it("apertar pulo entra com o primeiro cowboy livre, um por dispositivo", () => {
    let team: Team = [];
    team = lobbyPress(team, "k1", "jump");
    team = lobbyPress(team, "g0", "jump");
    team = lobbyPress(team, "k1", "jump"); // já está dentro: nada muda
    expect(team).toEqual([
      { devices: ["k1"], cowboy: 0 },
      { devices: ["g0"], cowboy: 1 },
    ]);
  });

  it("← e → trocam de cowboy pulando os já escolhidos, dando a volta", () => {
    let team: Team = [
      { devices: ["k0"], cowboy: 0 },
      { devices: ["k1"], cowboy: 1 },
    ];
    team = lobbyPress(team, "k0", "right");
    expect(team[0].cowboy).toBe(2);
    team = lobbyPress(team, "k0", "left"); // pula o 1, que é do J2
    expect(team[0].cowboy).toBe(0);
    team = lobbyPress(team, "k0", "left");
    expect(team[0].cowboy).toBe(7);
  });

  it("quem está fora não troca nada; baixo sai e os outros sobem de lugar", () => {
    let team: Team = [
      { devices: ["k0"], cowboy: 3 },
      { devices: ["k1"], cowboy: 5 },
    ];
    expect(lobbyPress(team, "k2", "right")).toBe(team);
    team = lobbyPress(team, "k0", "down");
    expect(team).toEqual([{ devices: ["k1"], cowboy: 5 }]);
  });

  it("no máximo 8 jogadores", () => {
    let team: Team = [];
    for (const d of ["k0", "k1", "k2", "k3", "g0", "g1", "g2", "g3"] as const) team = lobbyPress(team, d, "jump");
    expect(team.map((s) => s.cowboy)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(lobbyPress(team, "k0", "right")).toBe(team); // todos ocupados: não há para onde trocar
  });
});

describe("time na URL", () => {
  it("ida e volta", () => {
    const team: Team = [
      { devices: ["k0"], cowboy: 5 },
      { devices: ["g2"], cowboy: 0 },
    ];
    expect(formatTeam(team)).toBe("k0:5,g2:0");
    expect(parseTeam("k0:5,g2:0")).toEqual(team);
  });

  it("recusa time inválido", () => {
    for (const bad of ["", "k0", "k0:9", "k4:1", "x0:1", "k0:1,k0:2", "k0:1,k1:1", "k0:1,k1:2,k2:3,k3:4,g0:5,g1:6,g2:7,g3:0,g3:1"])
      expect(parseTeam(bad), bad).toBeNull();
  });

  it("time padrão de N jogadores segue a regra antiga de teclado + controle", () => {
    expect(defaultTeam(2)).toEqual([
      { devices: ["k0", "g0"], cowboy: 0 },
      { devices: ["k1", "g1"], cowboy: 1 },
    ]);
    expect(defaultTeam(6).map((s) => s.devices)).toEqual([["k0"], ["k1"], ["k2"], ["k3"], ["g0"], ["g1"]]);
  });
});

describe("time a partir da URL", () => {
  it("?team= tem prioridade; senão ?players=N; senão 2", () => {
    expect(teamFromQuery({ team: "g0:3,k0:1", players: "5" })).toEqual({
      team: [
        { devices: ["g0"], cowboy: 3 },
        { devices: ["k0"], cowboy: 1 },
      ],
      query: "team=g0:3,k0:1",
    });
    expect(teamFromQuery({ team: "lixo", players: "3" }).query).toBe("players=3");
    expect(teamFromQuery({ players: "99" }).team).toHaveLength(8);
    expect(teamFromQuery({}).team).toEqual(defaultTeam(2));
  });
});
