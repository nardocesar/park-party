# Salas online e multiplayer em rede — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:executing-plans (o loop em
> `LOOP-ONLINE.md` executa uma tarefa por iteração). Os passos usam checkbox (`- [ ]`) e
> **são o estado do loop**: marque cada passo ao concluí-lo e commite o plano junto com o código.

**Objetivo:** amigos em casas (e países) diferentes criam uma sala, entram por código/link,
escolhem cowboys e jogam qualquer fase juntos pela internet, com o próprio personagem
respondendo como no jogo local.

**Arquitetura:** a engine determinística (`step`) roda em todos os navegadores e no servidor.
O cliente aplica o próprio input na hora e prevê os outros; o servidor numera os inputs por
quadro, simula o mundo autoritativo e transmite o confirmado (rollback). Um `server.ts`
sobe o Next e um WebSocket (`/ws`) no mesmo processo; as salas vivem em memória.

**Stack:** Next 16 (App Router, `cacheComponents`), React 19, TypeScript estrito, `ws`,
`tsx`, Drizzle/Postgres (só `levels` e `best_times`), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-online-rooms-design.md`. Leia antes de começar.

## Restrições globais

- Um jogador por dispositivo; 2 a 8 jogadores por sala (`MAX_PLAYERS = 8`).
- Todas as fases liberadas; o anfitrião escolhe a fase ou aperta **Random**.
- Só o anfitrião escolhe fase, inicia e volta ao lobby; quem entrou primeiro entre os que ficaram assume.
- Queda no meio da fase: pausa de até **30 s** (`GRACE_MS = 30_000`); depois disso todos voltam ao lobby sem ele.
- Sala sem ninguém conectado por **60 s** é removida (`EMPTY_MS = 60_000`).
- Códigos de sala: 4 letras sem I nem O (`/^[A-HJ-NP-Z]{4}$/`).
- Apelido: 1 a 16 caracteres, sem caracteres de controle, renderizado como texto.
- Engine só usa `Math.abs/ceil/floor/max/min/round/sign/sqrt` (determinismo entre engines JS).
- 60 Hz (`FPS = 60`); servidor transmite o confirmado a cada 2 quadros e o hash a cada 60.
- Contagem de **3 s** antes do primeiro quadro e na volta de uma pausa (`COUNTDOWN_MS = 3_000`).
- Tempo de conclusão vem só do mundo do servidor.
- Textos do jogo em inglês; comentários de código em PT-BR (padrão do repositório).
- Next 16 tem APIs diferentes do que você conhece: leia `node_modules/next/dist/docs/` antes de mexer em rotas.
- Acesso a dados sem cache precisa ficar dentro de `<Suspense>` (`cacheComponents: true`).

## Pontos de atenção na revisão

Casos que a spec implica e que mais provavelmente quebram para quem joga. Cada um tem teste
na tarefa dona do código:

1. **F5 no meio da partida.** Quem recarrega volta ao mesmo assento: a partida pausa, ele
   recebe o estado completo e a partida retoma após a contagem (Tarefa 9, teste
   "reconexão durante a partida").
2. **Duas abas do mesmo navegador.** Precisam entrar como jogadores diferentes (o token fica
   no `sessionStorage`, que é por aba) (Tarefa 8, e2e usa duas abas do mesmo contexto).
3. **Cliente adulterado.** Frame absurdo no futuro, bits fora de 0–15 ou mensagem gigante
   derrubam só aquele socket (Tarefas 5 e 9).
4. **Anfitrião cai durante a pausa e não volta.** A sala volta ao lobby e o próximo vira
   anfitrião (Tarefa 9, teste "prazo expira").
5. **Aba em segundo plano segurando uma tecla.** O personagem não pode ficar andando sozinho
   para os outros: ao esconder a aba, o cliente manda input zerado (Tarefa 11, e2e).

## Ajustes em relação à spec

- **Reinício (R) online:** a spec não cobria. Qualquer jogador pode pedir; o servidor
  aplica o reinício no próximo quadro para todos (`restart` → `tick.resets`).
- **Aba em segundo plano:** em vez de pedir snapshot ao voltar, o cliente continua
  confirmando os `tick` (mensagens de WebSocket chegam com a aba escondida), solta o input
  ao esconder e limita a previsão a `MAX_AHEAD` quadros. É mais simples e cobre o mesmo caso.
- **Contagem também no início da fase** (não só na volta da pausa): dá tempo de todos
  sincronizarem o relógio antes do quadro 1.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/game/engine/snapshot.ts` | Clonar, serializar e fazer hash do `World` |
| `src/game/engine/determinism.test.ts` | Guarda: engine só usa funções `Math` determinísticas |
| `src/net/bits.ts` | `PlayerInput` ↔ 4 bits |
| `src/net/testing/fuzz.ts` | Sequências de input pseudoaleatórias e reprodutíveis (testes) |
| `src/net/timeline.ts` | Rollback puro: confirmado + previsão + eventos sem duplicar |
| `src/net/clock.ts` | Relógio da partida no cliente (RTT, quadro alvo) |
| `src/net/protocol.ts` | Tipos das mensagens e validação do que vem do cliente |
| `src/game/cowboys.ts` | Próximo cowboy livre (compartilhado entre lobby local e sala) |
| `src/server/match.ts` | Partida autoritativa: agenda inputs, avança quadros, monta `tick`/`hash` |
| `src/server/room.ts` | Regras da sala: membros, anfitrião, cowboy, fase, partida, pausa |
| `src/server/hub.ts` | Sockets ↔ salas, códigos, limpeza, rate limit |
| `src/server/testing/client.ts` | Cliente WebSocket de teste |
| `src/server/testing/tiny.ts` | Fase mínima que se conclui andando para a direita |
| `server.ts` | Sobe Next + hub no mesmo `http.Server` |
| `src/client/connection.ts` | WebSocket do navegador com reconexão |
| `src/client/useRoom.ts` | Hook: estado da sala + fluxo de mensagens da partida |
| `src/client/nick.ts` | Apelido salvo no navegador |
| `src/components/Title.tsx` | Tela título: criar ou entrar numa sala |
| `src/components/RoomScreen.tsx` | Apelido → conexão → lobby ou partida |
| `src/components/RoomLobby.tsx` | Lobby online |
| `src/components/OnlineGame.tsx` | Partida online (canvas + rollback) |
| `src/components/Portrait.tsx` | Cowboy animado (extraído de `Lobby.tsx`) |
| `src/app/room/[code]/page.tsx` | Rota da sala |
| `src/app/room/[code]/actions.ts` | Server action: recorde da fase |

## Branches e PRs

Uma branch por etapa, empilhadas; um PR por etapa, com base na branch da etapa anterior.
**Nunca faça merge**: merge na `master` dispara deploy em produção no Railway e é decisão do Carlos.

| Etapa | Branch | Base do PR | Tarefas |
|---|---|---|---|
| 1. Determinismo + rollback | `feat/online-1-rollback` (a partir de `docs/online-rooms-spec`, que tem spec, plano e loop) | `master` | 1–3 |
| 2. Servidor + salas + lobby online | `feat/online-2-lobby` | `feat/online-1-rollback` | 4–8 |
| 3. Partida online | `feat/online-3-match` | `feat/online-2-lobby` | 9–11 |
| 4. Remoção do multiplayer local | `feat/online-4-cleanup` | `feat/online-3-match` | 12 |

Verificação padrão (rodar antes de todo commit): `npm run lint && npm run typecheck && npm test`.
Tarefas com e2e também rodam `npm run test:e2e` (precisa do Postgres local: `npm run db:up`).

---

## Etapa 1 — Determinismo e rollback (sem rede)

### Tarefa 1: Engine determinística, snapshot e hash

**Arquivos:**
- Modificar: `src/game/engine/world.ts` (4 usos de `Math.hypot`, linhas ~609, 615, 642, 666)
- Criar: `src/game/engine/snapshot.ts`, `src/net/bits.ts`, `src/net/testing/fuzz.ts`
- Testes: `src/game/engine/determinism.test.ts`, `src/game/engine/snapshot.test.ts`, `src/net/bits.test.ts`

**Interfaces:**
- Produz: `cloneWorld(world: World): World`, `worldToJson(world: World): string`,
  `worldFromJson(json: string, level: Level): World`, `hashWorld(world: World): number`
- Produz: `encodeInput(i: PlayerInput): number`, `decodeInput(bits: number): PlayerInput`,
  constantes `LEFT = 1`, `RIGHT = 2`, `JUMP = 4`, `DOWN = 8`
- Produz: `fuzzInputs(seed: number, players: number, frames: number): number[][]` (bits por quadro)

- [x] **Passo 1: criar a branch da etapa**

```bash
git checkout docs/online-rooms-spec && git checkout -b feat/online-1-rollback
```

- [x] **Passo 2: escrever o teste de guarda (falha por causa do `Math.hypot`)**

`src/game/engine/determinism.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Funções com resultado idêntico em qualquer engine JS (IEEE 754 com arredondamento correto). */
const ALLOWED = new Set(["abs", "ceil", "floor", "max", "min", "round", "sign", "sqrt", "trunc", "imul"]);

describe("determinismo da engine", () => {
  it("só usa funções Math determinísticas (a simulação roda igual no servidor e em todo navegador)", () => {
    const dir = path.join(__dirname);
    const used = readdirSync(dir)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
      .flatMap((f) => [...readFileSync(path.join(dir, f), "utf8").matchAll(/Math\.(\w+)/g)].map((m) => `${f}: Math.${m[1]}`))
      .filter((u) => !ALLOWED.has(u.split("Math.")[1]));
    expect(used).toEqual([]);
  });
});
```

- [x] **Passo 3: rodar e ver falhar**

Run: `npx vitest run src/game/engine/determinism.test.ts`
Esperado: FAIL listando 4 ocorrências `world.ts: Math.hypot`.

- [x] **Passo 4: trocar `Math.hypot` em `world.ts`**

Adicione perto do topo de `world.ts`, depois dos imports:

```ts
/** Distância euclidiana. `Math.hypot` tem precisão definida por cada engine; `sqrt` não. */
const dist = (dx: number, dy: number) => Math.sqrt(dx * dx + dy * dy);
```

E troque as 4 chamadas, mantendo os argumentos:

```ts
total += dist(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
const seg = dist(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
const length = dist(t.dx, t.dy);
const d = dist(cb.x - ca.x, cb.y - ca.y);
```

- [x] **Passo 5: rodar a suíte inteira**

Run: `npm test`
Esperado: PASS. Se algum teste existente comparar posição com `toBe` e falhar só na última
casa decimal, troque aquela asserção por `toBeCloseTo(valor, 6)` e anote no commit.

- [x] **Passo 6: testes de bits e de snapshot (falham: módulos não existem)**

`src/net/bits.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decodeInput, DOWN, encodeInput, JUMP, LEFT, RIGHT } from "./bits";

describe("input em bits", () => {
  it("ida e volta para as 16 combinações", () => {
    for (let b = 0; b < 16; b++) expect(encodeInput(decodeInput(b))).toBe(b);
  });
  it("cada tecla tem um bit", () => {
    expect(decodeInput(LEFT | JUMP)).toEqual({ left: true, right: false, jump: true, down: false });
    expect(encodeInput({ left: false, right: true, jump: false })).toBe(RIGHT);
    expect(encodeInput({ left: false, right: false, jump: false, down: true })).toBe(DOWN);
  });
});
```

`src/game/engine/snapshot.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LEVELS } from "@/game/levels";
import { decodeInput } from "@/net/bits";
import { fuzzInputs } from "@/net/testing/fuzz";
import { parseLevel } from "./level";
import { cloneWorld, hashWorld, worldFromJson, worldToJson } from "./snapshot";
import { createWorld, step, type World } from "./world";

const run = (w: World, inputs: number[][]) => {
  for (const f of inputs) step(w, f.map(decodeInput));
};

describe("snapshot do mundo", () => {
  it("clone é independente do original e compartilha a fase", () => {
    const w = createWorld(parseLevel(LEVELS[0]), 2);
    const c = cloneWorld(w);
    run(c, fuzzInputs(1, 2, 60));
    expect(c.level).toBe(w.level);
    expect(hashWorld(c)).not.toBe(hashWorld(w));
    expect(w.frame).toBe(0);
  });

  it("serializar no meio da fase e continuar dá o mesmo hash, em todas as fases", () => {
    for (const [i, def] of LEVELS.entries()) {
      const level = parseLevel(def);
      const players = [2, 4, 8][i % 3];
      const inputs = fuzzInputs(i + 1, players, 400);
      const a = createWorld(level, players);
      run(a, inputs.slice(0, 200));
      const b = worldFromJson(worldToJson(a), level);
      expect(hashWorld(b), def.slug).toBe(hashWorld(a));
      run(a, inputs.slice(200));
      run(b, inputs.slice(200));
      expect(hashWorld(b), def.slug).toBe(hashWorld(a));
    }
  });

  it("hash ignora os eventos do último quadro", () => {
    const w = createWorld(parseLevel(LEVELS[0]), 2);
    const h = hashWorld(w);
    w.events = ["jump"];
    expect(hashWorld(w)).toBe(h);
  });
});
```

- [x] **Passo 7: rodar e ver falhar**

Run: `npx vitest run src/net/bits.test.ts src/game/engine/snapshot.test.ts`
Esperado: FAIL com "Failed to resolve import".

- [x] **Passo 8: implementar**

`src/net/bits.ts`:

```ts
import type { PlayerInput } from "@/game/engine/world";

export const LEFT = 1;
export const RIGHT = 2;
export const JUMP = 4;
export const DOWN = 8;

/** Input de um jogador em 4 bits: é o que trafega na rede. */
export const encodeInput = (i: PlayerInput) =>
  (i.left ? LEFT : 0) | (i.right ? RIGHT : 0) | (i.jump ? JUMP : 0) | (i.down ? DOWN : 0);

export const decodeInput = (bits: number): PlayerInput => ({
  left: (bits & LEFT) !== 0,
  right: (bits & RIGHT) !== 0,
  jump: (bits & JUMP) !== 0,
  down: (bits & DOWN) !== 0,
});
```

`src/net/testing/fuzz.ts`:

```ts
/** Inputs pseudoaleatórios reprodutíveis: cada jogador segura uma combinação por 5–40 quadros. */
export function fuzzInputs(seed: number, players: number, frames: number): number[][] {
  let s = seed >>> 0;
  const rand = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const held = Array<number>(players).fill(0);
  const left = Array<number>(players).fill(0);
  const out: number[][] = [];
  for (let f = 0; f < frames; f++) {
    for (let p = 0; p < players; p++) {
      if (left[p]-- <= 0) {
        held[p] = Math.floor(rand() * 16);
        left[p] = 5 + Math.floor(rand() * 35);
      }
    }
    out.push([...held]);
  }
  return out;
}
```

`src/game/engine/snapshot.ts`:

```ts
import type { Level } from "./level";
import type { World } from "./world";

/** Estado sem a fase (estática) nem os eventos do último quadro: é o que a rede envia e o hash compara. */
export function worldToJson(world: World): string {
  return JSON.stringify({ ...world, level: null, events: [] });
}

export function worldFromJson(json: string, level: Level): World {
  return { ...(JSON.parse(json) as World), level, events: [] };
}

/** Cópia profunda que compartilha a fase (ela não muda durante a partida). */
export function cloneWorld(world: World): World {
  return { ...structuredClone({ ...world, level: null }), level: world.level };
}

/** FNV-1a de 32 bits sobre o estado serializado. */
export function hashWorld(world: World): number {
  const s = worldToJson(world);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
```

- [x] **Passo 9: rodar e ver passar**

Run: `npx vitest run src/net src/game/engine`
Esperado: PASS.

- [x] **Passo 10: verificação padrão e commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/game/engine src/net docs/superpowers/plans/2026-10-15-online-rooms.md
git commit -m "feat(net): engine determinística, snapshot e hash do mundo"
```

### Tarefa 2: Linha do tempo com rollback

**Arquivos:**
- Criar: `src/net/timeline.ts`
- Teste: `src/net/timeline.test.ts`

**Interfaces:**
- Consome: `cloneWorld`, `hashWorld`, `worldFromJson` (Tarefa 1); `decodeInput` (Tarefa 1);
  `createWorld`, `resetWorld`, `step`, `World`, `GameEvent` (`engine/world.ts`)
- Produz:
  - `type Change = [f: number, seat: number, bits: number]`
  - `MAX_AHEAD = 60`
  - `createTimeline(level: Level, players: number, mySeat: number): Timeline` com:
    `frame(): number`, `world(): World`, `bits(): number[]`, `hash(): number`,
    `confirm(s: number, changes: Change[], resets: number[]): void`,
    `load(s: number, json: string, bits: number[]): void`,
    `setOwn(f: number, bits: number): void`,
    `predict(target: number): { world: World; frame: number; events: GameEvent[] }`
  - `mySeat = -1` = sem jogador local (uso do servidor)

- [x] **Passo 1: escrever os testes**

`src/net/timeline.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseLevel } from "@/game/engine/level";
import { hashWorld, worldToJson } from "@/game/engine/snapshot";
import { createWorld, step } from "@/game/engine/world";
import { LEVELS } from "@/game/levels";
import { decodeInput, JUMP, RIGHT } from "./bits";
import { fuzzInputs } from "./testing/fuzz";
import { createTimeline, MAX_AHEAD, type Change } from "./timeline";

/** Inputs por quadro → mudanças; o input de índice f vale no quadro f + 1. */
function toChanges(inputs: number[][]): Change[] {
  const out: Change[] = [];
  let prev = inputs[0].map(() => 0);
  inputs.forEach((bits, i) => {
    bits.forEach((b, seat) => b !== prev[seat] && out.push([i + 1, seat, b]));
    prev = bits;
  });
  return out;
}

describe("linha do tempo (rollback)", () => {
  it("previsão errada + confirmação em pedaços dá o mesmo hash da simulação direta", () => {
    const FRAMES = 600;
    for (const [i, def] of LEVELS.entries()) {
      if (i % 8 !== 0) continue; // amostra de mundos; o teste de snapshot cobre todas as fases
      for (const players of [2, 4, 8]) {
        const level = parseLevel(def);
        const inputs = fuzzInputs(i * 10 + players, players, FRAMES);
        const direct = createWorld(level, players);
        for (const f of inputs) step(direct, f.map(decodeInput));

        const changes = toChanges(inputs);
        const tl = createTimeline(level, players, 0);
        let s = 0;
        while (s < FRAMES) {
          const next = Math.min(FRAMES, s + 1 + (s % 7));
          // o próprio input chega antes da confirmação (como no cliente real)
          for (const [f, seat, b] of changes) if (seat === 0 && f > s && f <= next + 10) tl.setOwn(f, b);
          tl.predict(next + 10);
          tl.confirm(next, changes.filter(([f]) => f > s && f <= next), []);
          s = next;
        }
        expect(tl.hash(), `${def.slug} com ${players}`).toBe(hashWorld(direct));
      }
    }
  });

  it("o próprio input aparece na previsão antes de ser confirmado", () => {
    const tl = createTimeline(parseLevel(LEVELS[0]), 2, 0);
    const x0 = tl.world().players[0].x;
    tl.setOwn(1, RIGHT);
    const { world, frame } = tl.predict(20);
    expect(frame).toBe(20);
    expect(world.players[0].x).toBeGreaterThan(x0);
    expect(tl.world().players[0].x).toBe(x0);
  });

  it("os outros jogadores repetem o último input confirmado", () => {
    const tl = createTimeline(parseLevel(LEVELS[0]), 2, 0);
    tl.confirm(5, [[1, 1, RIGHT]], []);
    const at5 = tl.world().players[1].x;
    expect(tl.predict(25).world.players[1].x).toBeGreaterThan(at5);
  });

  it("som de um quadro toca uma vez só, mesmo ressimulado", () => {
    const tl = createTimeline(parseLevel(LEVELS[0]), 2, 0);
    for (let f = 0; f < 30; f++) tl.confirm(f + 1, [], []); // todos no chão
    tl.setOwn(31, JUMP);
    expect(tl.predict(35).events).toContain("jump");
    expect(tl.predict(35).events).toEqual([]);
    expect(tl.predict(40).events).not.toContain("jump");
  });

  it("reinício confirmado num quadro volta todos ao início", () => {
    const tl = createTimeline(parseLevel(LEVELS[0]), 2, 0);
    tl.confirm(10, [[1, 0, RIGHT]], []);
    tl.confirm(11, [], [11]);
    expect(tl.world().resets).toBe(1);
  });

  it("a previsão não passa de MAX_AHEAD quadros à frente do confirmado", () => {
    const tl = createTimeline(parseLevel(LEVELS[0]), 2, 0);
    expect(tl.predict(10_000).frame).toBe(MAX_AHEAD);
  });

  it("carregar um snapshot substitui o confirmado", () => {
    const level = parseLevel(LEVELS[0]);
    const src = createWorld(level, 2);
    for (let f = 0; f < 50; f++) step(src, [decodeInput(RIGHT), decodeInput(0)]);
    const tl = createTimeline(level, 2, 1);
    tl.load(50, worldToJson(src), [RIGHT, 0]);
    expect(tl.frame()).toBe(50);
    expect(tl.hash()).toBe(hashWorld(src));
    expect(tl.bits()).toEqual([RIGHT, 0]);
  });

  it("confirmação repetida ou antiga é ignorada", () => {
    const tl = createTimeline(parseLevel(LEVELS[0]), 2, 0);
    tl.confirm(10, [], []);
    const h = tl.hash();
    tl.confirm(8, [[5, 0, RIGHT]], []);
    expect(tl.frame()).toBe(10);
    expect(tl.hash()).toBe(h);
  });
});
```

- [x] **Passo 2: rodar e ver falhar**

Run: `npx vitest run src/net/timeline.test.ts`
Esperado: FAIL com "Failed to resolve import ./timeline".

- [x] **Passo 3: implementar**

`src/net/timeline.ts`:

```ts
import type { Level } from "@/game/engine/level";
import { cloneWorld, hashWorld, worldFromJson } from "@/game/engine/snapshot";
import { createWorld, resetWorld, step, type GameEvent, type World } from "@/game/engine/world";
import { decodeInput } from "./bits";

/** Mudança de input: a partir do quadro `f`, o assento `seat` segura `bits`. */
export type Change = [f: number, seat: number, bits: number];

/** Quantos quadros, no máximo, a previsão corre à frente do confirmado. */
export const MAX_AHEAD = 60;

export type Timeline = ReturnType<typeof createTimeline>;

/**
 * Rollback. O quadro 0 é o mundo recém-criado; o quadro f é o estado depois do f-ésimo `step`.
 * O confirmado só avança com o que o servidor manda; a previsão parte dele a cada chamada,
 * com o input local real e o último input conhecido dos outros. `mySeat = -1` no servidor.
 */
export function createTimeline(level: Level, players: number, mySeat: number) {
  let confirmed = createWorld(level, players);
  let frame = 0;
  let bits = Array<number>(players).fill(0);
  /** Mudanças locais ainda à frente do confirmado, em ordem: [quadro, bits]. */
  let own: [number, number][] = [];
  /** Bits locais da última mudança que já ficou para trás do confirmado. */
  let ownSettled = 0;
  /** Último quadro cujos eventos já tocaram. */
  let sounded = 0;

  const settleOwn = () => {
    for (const [f, b] of own) if (f <= frame) ownSettled = b;
    own = own.filter(([f]) => f > frame);
  };

  return {
    frame: () => frame,
    world: () => confirmed,
    bits: () => [...bits],
    hash: () => hashWorld(confirmed),

    confirm(s: number, changes: Change[], resets: number[]) {
      for (let f = frame + 1; f <= s; f++) {
        for (const [cf, seat, b] of changes) if (cf === f) bits[seat] = b;
        if (resets.includes(f)) resetWorld(confirmed);
        step(confirmed, bits.map(decodeInput));
      }
      frame = Math.max(frame, s);
      settleOwn();
    },

    load(s: number, json: string, held: number[]) {
      confirmed = worldFromJson(json, level);
      frame = s;
      bits = [...held];
      sounded = Math.max(sounded, s);
      settleOwn();
    },

    setOwn(f: number, b: number) {
      const last = own.at(-1);
      if (last && last[0] === f) last[1] = b;
      else own.push([f, b]);
    },

    predict(target: number): { world: World; frame: number; events: GameEvent[] } {
      const to = Math.max(frame, Math.min(target, frame + MAX_AHEAD));
      const world = cloneWorld(confirmed);
      const held = [...bits];
      const events: GameEvent[] = [];
      let mine = ownSettled;
      let k = 0;
      for (let f = frame + 1; f <= to; f++) {
        while (k < own.length && own[k][0] <= f) mine = own[k++][1];
        if (mySeat >= 0) held[mySeat] = mine;
        step(world, held.map(decodeInput));
        if (f > sounded) events.push(...world.events);
      }
      sounded = Math.max(sounded, to);
      return { world, frame: to, events };
    },
  };
}
```

- [x] **Passo 4: rodar e ver passar**

Run: `npx vitest run src/net/timeline.test.ts`
Esperado: PASS. Se o primeiro teste falhar só com 8 jogadores, investigue antes de seguir:
é divergência real de determinismo (ex.: estado fora do `World`), não tolerância de teste.

- [x] **Passo 5: verificação padrão e commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/net docs/superpowers/plans/2026-10-15-online-rooms.md
git commit -m "feat(net): linha do tempo com rollback"
```

### Tarefa 3: Relógio da partida no cliente

**Arquivos:**
- Criar: `src/net/clock.ts`
- Teste: `src/net/clock.test.ts`

**Interfaces:**
- Produz: `STEP_MS = 1000 / FPS`, `LEAD_FRAMES = 2`, `createClock()` com
  `ready(): boolean`, `clear(): void`, `sample(sentAt: number, receivedAt: number, serverFrame: number): void`,
  `rtt(): number`, `serverFrame(now: number): number`, `target(now: number): number`

- [x] **Passo 1: escrever os testes**

`src/net/clock.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createClock, STEP_MS } from "./clock";

describe("relógio da partida", () => {
  it("sem amostra não está pronto", () => {
    expect(createClock().ready()).toBe(false);
  });

  it("estima o quadro do servidor e roda à frente meia volta + 2 quadros", () => {
    const c = createClock();
    // ping saiu em 1000, voltou em 1100 (RTT 100), servidor estava no quadro 30
    c.sample(1000, 1100, 30);
    expect(c.rtt()).toBe(100);
    // em 1100 o servidor já andou meia volta (50 ms = 3 quadros): ~33
    expect(c.serverFrame(1100)).toBeCloseTo(30 + 50 / STEP_MS, 6);
    // alvo = servidor (33) + meia volta (3) + folga (2) = 38
    expect(c.target(1105)).toBe(38);
  });

  it("usa a amostra de menor RTT entre as últimas 8", () => {
    const c = createClock();
    c.sample(1000, 1100, 30);
    c.sample(2000, 2400, 80); // amostra ruim, RTT 400
    expect(c.rtt()).toBe(100);
    expect(c.target(1105)).toBe(38);
  });

  it("clear descarta as amostras (volta de pausa)", () => {
    const c = createClock();
    c.sample(0, 100, 0);
    c.clear();
    expect(c.ready()).toBe(false);
  });
});
```

- [x] **Passo 2: rodar e ver falhar**

Run: `npx vitest run src/net/clock.test.ts`
Esperado: FAIL com "Failed to resolve import ./clock".

- [x] **Passo 3: implementar**

`src/net/clock.ts`:

```ts
import { FPS } from "@/game/engine/constants";

export const STEP_MS = 1000 / FPS;
/** Folga, em quadros, para o input chegar ao servidor antes do quadro em que foi carimbado. */
export const LEAD_FRAMES = 2;
const SAMPLES = 8;

/**
 * Relógio da partida no cliente. Cada `pong` traz o quadro virtual (fracionário) do servidor no
 * instante da resposta; a amostra de menor RTT entre as últimas é a mais confiável.
 * `origin` é o instante local em que o servidor estava no quadro 0.
 */
export function createClock() {
  let samples: { rtt: number; origin: number }[] = [];
  const best = () => samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
  const serverFrame = (now: number) => (now - best().origin) / STEP_MS;

  return {
    ready: () => samples.length > 0,
    clear() {
      samples = [];
    },
    sample(sentAt: number, receivedAt: number, frame: number) {
      const rtt = receivedAt - sentAt;
      samples = [...samples, { rtt, origin: receivedAt - rtt / 2 - frame * STEP_MS }].slice(-SAMPLES);
    },
    rtt: () => (samples.length ? best().rtt : 0),
    serverFrame,
    /** Quadro que o cliente deve simular agora: o do servidor + meia volta + folga. */
    target(now: number) {
      return Math.floor(serverFrame(now) + best().rtt / 2 / STEP_MS) + LEAD_FRAMES;
    },
  };
}
```

- [x] **Passo 4: rodar e ver passar**

Run: `npx vitest run src/net/clock.test.ts`
Esperado: PASS.

- [x] **Passo 5: verificação, commit, push e PR da Etapa 1**

```bash
npm run lint && npm run typecheck && npm test
git add src/net docs/superpowers/plans/2026-10-15-online-rooms.md
git commit -m "feat(net): relógio da partida no cliente"
git push -u origin feat/online-1-rollback
gh pr create --base master --title "feat(net): determinismo e rollback (online 1/4)" --body "Etapa 1 do plano docs/superpowers/plans/2026-10-15-online-rooms.md: engine determinística, snapshot/hash, linha do tempo com rollback e relógio. Sem rede ainda.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Anote o link do PR na tabela "Registro" no fim deste plano.

---

## Etapa 2 — Servidor, salas e lobby online

### Tarefa 4: Protocolo

**Arquivos:**
- Criar: `src/net/protocol.ts`
- Teste: `src/net/protocol.test.ts`

**Interfaces:**
- Consome: `Change` (Tarefa 2)
- Produz: tipos `ErrorCode`, `MemberView`, `RoomView`, `ClientMsg`, `ServerMsg`; constantes
  `MAX_NICK = 16`, `MAX_MSG = 512`, `CODE_RE`; funções `cleanNick(raw: string): string | null`,
  `parseClientMsg(raw: string): ClientMsg | null`

- [x] **Passo 1: criar a branch da etapa**

```bash
git checkout feat/online-1-rollback && git checkout -b feat/online-2-lobby
```

- [x] **Passo 2: escrever os testes**

`src/net/protocol.test.ts`:

```ts
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
```

- [x] **Passo 3: rodar e ver falhar**

Run: `npx vitest run src/net/protocol.test.ts`
Esperado: FAIL com "Failed to resolve import ./protocol".

- [x] **Passo 4: implementar**

`src/net/protocol.ts`:

```ts
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
```

- [x] **Passo 5: rodar e ver passar**

Run: `npx vitest run src/net/protocol.test.ts`
Esperado: PASS.

- [x] **Passo 6: verificação padrão e commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/net docs/superpowers/plans/2026-10-15-online-rooms.md
git commit -m "feat(net): protocolo cliente-servidor com validação"
```

### Tarefa 5: Sala (lobby) e cowboys compartilhados

**Arquivos:**
- Criar: `src/game/cowboys.ts`, `src/server/room.ts`
- Modificar: `src/game/lobby.ts` (usa `nextFreeCowboy`)
- Teste: `src/game/cowboys.test.ts`, `src/server/room.test.ts`

**Interfaces:**
- Consome: `ClientMsg`, `ServerMsg`, `ErrorCode`, `RoomView` (Tarefa 4); `LEVELS` (`game/levels.ts`)
- Produz:
  - `nextFreeCowboy(taken: number[], from: number, dir: 1 | -1): number | null`
  - `GRACE_MS = 30_000`, `EMPTY_MS = 60_000`
  - `type Send = (msg: ServerMsg) => void`
  - `type RoomDeps = { random: () => number; newId: () => string; levels: (LevelDef & { slug: string })[] }`
  - `type JoinResult = { ok: true; id: string } | { ok: false; code: ErrorCode }`
  - `createRoom(code: string, deps: RoomDeps, now: number): Room` com
    `join(nick: string, token: string | null, send: Send): JoinResult`,
    `disconnect(id: string, send: Send, now: number): void`,
    `handle(id: string, msg: ClientMsg): ErrorCode | "drop" | null`,
    `tick(now: number): void`, `isDead(now: number): boolean`, `view(): RoomView`
  - (A Tarefa 9 acrescenta `now` em `join` e `handle`.)

- [x] **Passo 1: testes de `nextFreeCowboy`**

`src/game/cowboys.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nextFreeCowboy } from "./cowboys";

describe("próximo cowboy livre", () => {
  it("anda na direção pedida pulando os ocupados e dá a volta", () => {
    expect(nextFreeCowboy([], -1, 1)).toBe(0);
    expect(nextFreeCowboy([0, 1], 0, 1)).toBe(2);
    expect(nextFreeCowboy([0, 7], 0, -1)).toBe(6);
  });
  it("null quando os 8 estão ocupados", () => {
    expect(nextFreeCowboy([0, 1, 2, 3, 4, 5, 6, 7], 0, 1)).toBeNull();
  });
});
```

- [x] **Passo 2: implementar `cowboys.ts` e usar em `lobby.ts`**

`src/game/cowboys.ts`:

```ts
import { MAX_PLAYERS } from "./engine/constants";

/** Próximo cowboy livre a partir de `from`, andando `dir` (dá a volta); null se não houver. */
export function nextFreeCowboy(taken: number[], from: number, dir: 1 | -1): number | null {
  const used = new Set(taken);
  for (let k = 1; k <= MAX_PLAYERS; k++) {
    const c = (((from + dir * k) % MAX_PLAYERS) + MAX_PLAYERS) % MAX_PLAYERS;
    if (!used.has(c)) return c;
  }
  return null;
}
```

Em `src/game/lobby.ts`, apague a função `nextFree` e a constante `COWBOYS` só se não
houver outro uso (`parseTeam` usa `COWBOYS`; mantenha a constante). Importe e troque as chamadas:

```ts
import { nextFreeCowboy } from "./cowboys";
// ...
return [...team, { devices: [device], cowboy: nextFreeCowboy(team.map((s) => s.cowboy), -1, 1)! }];
// ...
const cowboy = nextFreeCowboy(team.map((s) => s.cowboy), team[i].cowboy, action === "right" ? 1 : -1);
```

Run: `npx vitest run src/game/cowboys.test.ts src/game/lobby.test.ts`
Esperado: PASS.

- [x] **Passo 3: testes da sala**

`src/server/room.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LEVELS } from "@/game/levels";
import type { RoomView, ServerMsg } from "@/net/protocol";
import { createRoom, EMPTY_MS, GRACE_MS } from "./room";

function setup() {
  let n = 0;
  const room = createRoom("ABCD", { random: () => 0, newId: () => `id${++n}`, levels: LEVELS }, 0);
  const client = () => {
    const msgs: ServerMsg[] = [];
    const send = (m: ServerMsg) => void msgs.push(m);
    const last = <T extends ServerMsg["t"]>(t: T) => msgs.findLast((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined;
    return { msgs, send, last, room: () => last("room")!.room as RoomView };
  };
  return { room, client };
}

describe("sala — lobby", () => {
  it("primeiro a entrar é anfitrião; cada um recebe welcome e um cowboy livre", () => {
    const { room, client } = setup();
    const a = client();
    const b = client();
    const ra = room.join("Ana", null, a.send);
    room.join("Bia", null, b.send);
    expect(ra).toEqual({ ok: true, id: "id1" });
    expect(a.last("welcome")).toEqual({ t: "welcome", you: "id1", token: "id2" });
    expect(a.room().members.map((m) => [m.nick, m.cowboy, m.host])).toEqual([["Ana", 0, true], ["Bia", 1, false]]);
  });

  it("token devolve o mesmo membro sem duplicar", () => {
    const { room, client } = setup();
    const a = client();
    room.join("Ana", null, a.send);
    room.disconnect("id1", a.send, 100);
    const a2 = client();
    expect(room.join("Outro", "id2", a2.send)).toEqual({ ok: true, id: "id1" });
    expect(a2.room().members).toHaveLength(1);
    expect(a2.room().members[0]).toMatchObject({ nick: "Ana", online: true });
  });

  it("sala cheia recusa o nono", () => {
    const { room, client } = setup();
    for (let i = 0; i < 8; i++) room.join(`P${i}`, null, client().send);
    expect(room.join("Nono", null, client().send)).toEqual({ ok: false, code: "full" });
  });

  it("trocar de cowboy pula os ocupados", () => {
    const { room, client } = setup();
    const a = client();
    room.join("Ana", null, a.send);
    room.join("Bia", null, client().send);
    expect(room.handle("id1", { t: "cowboy", dir: 1 })).toBeNull();
    expect(a.room().members[0].cowboy).toBe(2);
    room.handle("id1", { t: "cowboy", dir: -1 });
    expect(a.room().members[0].cowboy).toBe(0);
  });

  it("só o anfitrião escolhe a fase; random usa o sorteio; slug inexistente é recusado", () => {
    const { room, client } = setup();
    const a = client();
    room.join("Ana", null, a.send);
    room.join("Bia", null, client().send);
    expect(room.handle("id3", { t: "pick", slug: "1-2" })).toBe("not_host");
    expect(room.handle("id1", { t: "pick", slug: "1-2" })).toBeNull();
    expect(a.room().slug).toBe("1-2");
    room.handle("id1", { t: "pick", slug: "random" });
    expect(a.room().slug).toBe(LEVELS[0].slug);
    expect(room.handle("id1", { t: "pick", slug: "99-9" })).toBe("bad_state");
  });

  it("desconectado mantém o lugar por GRACE_MS; depois sai e o anfitrião passa adiante", () => {
    const { room, client } = setup();
    const a = client();
    const b = client();
    room.join("Ana", null, a.send);
    room.join("Bia", null, b.send);
    room.disconnect("id1", a.send, 1000);
    room.tick(1000 + GRACE_MS - 1);
    expect(b.room().members[0]).toMatchObject({ nick: "Ana", online: false, host: true });
    room.tick(1000 + GRACE_MS);
    expect(b.room().members).toEqual([expect.objectContaining({ nick: "Bia", host: true })]);
  });

  it("fechar o socket antigo não derruba quem já reconectou", () => {
    const { room, client } = setup();
    const old = client();
    room.join("Ana", null, old.send);
    const fresh = client();
    room.join("Ana", "id2", fresh.send);
    room.disconnect("id1", old.send, 10);
    expect(fresh.room().members[0].online).toBe(true);
  });

  it("sala sem ninguém conectado morre depois de EMPTY_MS", () => {
    const { room, client } = setup();
    const a = client();
    room.join("Ana", null, a.send);
    expect(room.isDead(EMPTY_MS * 10)).toBe(false);
    room.disconnect("id1", a.send, 500);
    expect(room.isDead(500 + EMPTY_MS - 1)).toBe(false);
    expect(room.isDead(500 + EMPTY_MS)).toBe(true);
  });

  it("ping responde pong com quadro 0 fora de partida", () => {
    const { room, client } = setup();
    const a = client();
    room.join("Ana", null, a.send);
    room.handle("id1", { t: "ping", at: 42 });
    expect(a.last("pong")).toEqual({ t: "pong", at: 42, frame: 0 });
  });
});
```

- [x] **Passo 4: rodar e ver falhar**

Run: `npx vitest run src/server/room.test.ts`
Esperado: FAIL com "Failed to resolve import ./room".

- [x] **Passo 5: implementar**

`src/server/room.ts`:

```ts
import { MAX_PLAYERS } from "@/game/engine/constants";
import type { LevelDef } from "@/game/engine/level";
import { nextFreeCowboy } from "@/game/cowboys";
import type { ClientMsg, ErrorCode, RoomView, ServerMsg } from "@/net/protocol";

/** Quanto tempo um desconectado mantém o lugar (F5, queda de Wi-Fi). */
export const GRACE_MS = 30_000;
/** Sala sem ninguém conectado por este tempo é removida. */
export const EMPTY_MS = 60_000;

export type Send = (msg: ServerMsg) => void;
export type RoomDeps = { random: () => number; newId: () => string; levels: (LevelDef & { slug: string })[] };
export type JoinResult = { ok: true; id: string } | { ok: false; code: ErrorCode };
export type Room = ReturnType<typeof createRoom>;

type Member = { id: string; token: string; nick: string; cowboy: number; send: Send | null; offSince: number };

/** Regras de uma sala. Sem sockets nem relógio: quem chama passa `send` e `now`. */
export function createRoom(code: string, deps: RoomDeps, now: number) {
  let members: Member[] = [];
  const state: RoomView["state"] = "lobby";
  let slug: string | null = null;
  let emptySince: number | null = now;

  const find = (id: string) => members.find((m) => m.id === id);
  const view = (): RoomView => ({
    code,
    state,
    slug,
    members: members.map((m, i) => ({ id: m.id, nick: m.nick, cowboy: m.cowboy, host: i === 0, online: m.send !== null, playing: false })),
  });
  const broadcast = (msg: ServerMsg) => {
    for (const m of members) m.send?.(msg);
  };
  const sendRoom = () => broadcast({ t: "room", room: view() });

  function join(nick: string, token: string | null, send: Send): JoinResult {
    let m = token ? members.find((x) => x.token === token) : undefined;
    if (m) {
      m.send = send;
      m.offSince = 0;
    } else {
      if (members.length >= MAX_PLAYERS) return { ok: false, code: "full" };
      const cowboy = nextFreeCowboy(members.map((x) => x.cowboy), -1, 1)!;
      m = { id: deps.newId(), token: deps.newId(), nick, cowboy, send, offSince: 0 };
      members.push(m);
    }
    emptySince = null;
    send({ t: "welcome", you: m.id, token: m.token });
    sendRoom();
    return { ok: true, id: m.id };
  }

  function disconnect(id: string, send: Send, now: number) {
    const m = find(id);
    if (!m || m.send !== send) return; // socket antigo de quem já reconectou
    m.send = null;
    m.offSince = now;
    if (!members.some((x) => x.send)) emptySince = now;
    sendRoom();
  }

  function handle(id: string, msg: ClientMsg): ErrorCode | "drop" | null {
    const m = find(id);
    if (!m) return "drop";
    const isHost = members[0] === m;
    switch (msg.t) {
      case "cowboy": {
        if (state !== "lobby") return "bad_state";
        const c = nextFreeCowboy(members.map((x) => x.cowboy), m.cowboy, msg.dir);
        if (c !== null) {
          m.cowboy = c;
          sendRoom();
        }
        return null;
      }
      case "pick": {
        if (!isHost) return "not_host";
        if (state !== "lobby") return "bad_state";
        const picked = msg.slug === "random" ? deps.levels[Math.floor(deps.random() * deps.levels.length)].slug : msg.slug;
        if (!deps.levels.some((l) => l.slug === picked)) return "bad_state";
        slug = picked;
        sendRoom();
        return null;
      }
      case "ping":
        m.send?.({ t: "pong", at: msg.at, frame: 0 });
        return null;
      default:
        return "bad_state";
    }
  }

  function tick(now: number) {
    const expired = members.filter((m) => !m.send && now - m.offSince >= GRACE_MS);
    if (expired.length === 0) return;
    members = members.filter((m) => !expired.includes(m));
    sendRoom();
  }

  const isDead = (now: number) => emptySince !== null && now - emptySince >= EMPTY_MS;

  return { code, join, disconnect, handle, tick, isDead, view };
}
```

- [x] **Passo 6: rodar e ver passar**

Run: `npx vitest run src/server src/game/cowboys.test.ts src/game/lobby.test.ts`
Esperado: PASS.

- [x] **Passo 7: verificação padrão e commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/game src/server docs/superpowers/plans/2026-10-15-online-rooms.md
git commit -m "feat(server): sala com anfitrião, cowboys e escolha de fase"
```

### Tarefa 6: Hub WebSocket

**Arquivos:**
- Criar: `src/server/hub.ts`, `src/server/testing/client.ts`
- Teste: `src/server/hub.test.ts`
- Dependências: `npm install ws` e `npm install -D @types/ws`

**Interfaces:**
- Consome: `createRoom`, `Room`, `RoomDeps` (Tarefa 5); `parseClientMsg`, `ServerMsg`, `ClientMsg` (Tarefa 4)
- Produz: `createHub(deps: Omit<RoomDeps, "newId">): Hub` com
  `handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void`, `rooms: Map<string, Room>`, `close(): void`;
  `testClient(url: string)` com `send(msg: ClientMsg, delayMs?: number)`, `next(t, timeoutMs?)`, `inbox`, `closed: Promise<number>`

- [x] **Passo 1: instalar `ws`**

```bash
npm install ws && npm install -D @types/ws
```

- [x] **Passo 2: cliente de teste**

`src/server/testing/client.ts`:

```ts
import WebSocket from "ws";
import type { ClientMsg, ServerMsg } from "@/net/protocol";

/** Cliente WebSocket de teste: guarda tudo o que chega e espera por tipo de mensagem. */
export async function testClient(url: string) {
  const ws = new WebSocket(url);
  const inbox: ServerMsg[] = [];
  ws.on("message", (data) => inbox.push(JSON.parse(String(data)) as ServerMsg));
  const closed = new Promise<number>((resolve) => ws.on("close", (code) => resolve(code)));
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  return {
    ws,
    inbox,
    closed,
    send(msg: ClientMsg, delayMs = 0) {
      const go = () => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg));
      if (delayMs > 0) setTimeout(go, delayMs);
      else go();
    },
    /** Tira da caixa a primeira mensagem do tipo `t` (espera até chegar). */
    async next<T extends ServerMsg["t"]>(t: T, timeoutMs = 5000): Promise<Extract<ServerMsg, { t: T }>> {
      const end = Date.now() + timeoutMs;
      while (Date.now() < end) {
        const i = inbox.findIndex((m) => m.t === t);
        if (i >= 0) return inbox.splice(i, 1)[0] as Extract<ServerMsg, { t: T }>;
        await new Promise((r) => setTimeout(r, 5));
      }
      throw new Error(`tempo esgotado esperando "${t}"`);
    },
  };
}
```

- [x] **Passo 3: testes de integração do hub**

`src/server/hub.test.ts`:

```ts
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LEVELS } from "@/game/levels";
import { createHub, type Hub } from "./hub";
import { testClient } from "./testing/client";

let server: Server;
let hub: Hub;
let url: string;

beforeEach(async () => {
  hub = createHub({ random: () => 0, levels: LEVELS });
  server = createServer();
  server.on("upgrade", (req, socket, head) => hub.handleUpgrade(req, socket, head));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `ws://localhost:${(server.address() as AddressInfo).port}/ws`;
});

afterEach(async () => {
  hub.close();
  await new Promise((resolve) => server.close(resolve));
});

describe("hub", () => {
  it("cria sala e outro jogador entra pelo código", async () => {
    const a = await testClient(url);
    a.send({ t: "join", code: null, nick: "Ana", token: null });
    const { room } = await a.next("room");
    expect(room.code).toMatch(/^[A-HJ-NP-Z]{4}$/);

    const b = await testClient(url);
    b.send({ t: "join", code: room.code, nick: "Bia", token: null });
    const { room: seen } = await b.next("room");
    expect(seen.members.map((m) => m.nick)).toEqual(["Ana", "Bia"]);
  });

  it("código inexistente recebe not_found e é desconectado", async () => {
    const c = await testClient(url);
    c.send({ t: "join", code: "ZZZZ", nick: "Ana", token: null });
    expect(await c.next("error")).toEqual({ t: "error", code: "not_found" });
    await c.closed;
  });

  it("mensagem inválida derruba o socket com 1008", async () => {
    const c = await testClient(url);
    c.ws.send("{lixo");
    expect(await c.closed).toBe(1008);
  });

  it("primeira mensagem precisa ser join", async () => {
    const c = await testClient(url);
    c.send({ t: "start" });
    expect(await c.closed).toBe(1008);
  });

  it("reconexão com token devolve o mesmo id", async () => {
    const a = await testClient(url);
    a.send({ t: "join", code: null, nick: "Ana", token: null });
    const { you, token } = await a.next("welcome");
    const { room } = await a.next("room");
    a.ws.close();
    await a.closed;
    const again = await testClient(url);
    again.send({ t: "join", code: room.code, nick: "Ana", token });
    expect((await again.next("welcome")).you).toBe(you);
  });

  it("rajada de mensagens acima do limite derruba o socket", async () => {
    const c = await testClient(url);
    c.send({ t: "join", code: null, nick: "Ana", token: null });
    for (let i = 0; i < 200; i++) c.send({ t: "ping", at: i });
    expect(await c.closed).toBe(1008);
  });
});
```

- [x] **Passo 4: rodar e ver falhar**

Run: `npx vitest run src/server/hub.test.ts`
Esperado: FAIL com "Failed to resolve import ./hub".

- [x] **Passo 5: implementar**

`src/server/hub.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import { MAX_MSG, parseClientMsg, type ServerMsg } from "@/net/protocol";
import { createRoom, type Room, type RoomDeps } from "./room";

const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
/** Intervalo do laço das salas: curto para os quadros de 16,7 ms saírem no tempo. */
const TICK_MS = 4;
const MAX_MSGS_PER_SEC = 120;

export type Hub = ReturnType<typeof createHub>;

/** Liga sockets a salas. Cada socket começa com `join`; depois tudo vai para a sala dele. */
export function createHub(deps: Omit<RoomDeps, "newId">) {
  const rooms = new Map<string, Room>();
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MSG * 2 });

  const newCode = () => {
    let code: string;
    do code = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join("");
    while (rooms.has(code));
    return code;
  };

  wss.on("connection", (ws: WebSocket) => {
    let bound: { room: Room; id: string } | null = null;
    let budget = MAX_MSGS_PER_SEC;
    let windowStart = Date.now();
    const send = (msg: ServerMsg) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    };

    ws.on("message", (data) => {
      const now = Date.now();
      if (now - windowStart >= 1000) {
        windowStart = now;
        budget = MAX_MSGS_PER_SEC;
      }
      if (--budget < 0) return ws.close(1008, "rate");
      const msg = parseClientMsg(String(data));
      if (!msg) return ws.close(1008, "invalid");

      if (!bound) {
        if (msg.t !== "join") return ws.close(1008, "invalid");
        let room = msg.code ? rooms.get(msg.code) : undefined;
        if (msg.code && !room) {
          send({ t: "error", code: "not_found" });
          return ws.close(1000);
        }
        if (!room) {
          room = createRoom(newCode(), { ...deps, newId: randomUUID }, now);
          rooms.set(room.code, room);
        }
        const res = room.join(msg.nick, msg.token, send);
        if (!res.ok) {
          send({ t: "error", code: res.code });
          return ws.close(1000);
        }
        bound = { room, id: res.id };
        return;
      }

      const err = bound.room.handle(bound.id, msg);
      if (err === "drop") return ws.close(1008, "invalid");
      if (err) send({ t: "error", code: err });
    });

    ws.on("close", () => bound?.room.disconnect(bound.id, send, Date.now()));
  });

  const loop = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      room.tick(now);
      if (room.isDead(now)) rooms.delete(code);
    }
  }, TICK_MS);

  return {
    rooms,
    handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    },
    close() {
      clearInterval(loop);
      for (const c of wss.clients) c.terminate();
      wss.close();
    },
  };
}
```

- [x] **Passo 6: rodar e ver passar**

Run: `npx vitest run src/server`
Esperado: PASS.

- [x] **Passo 7: verificação padrão e commit**

```bash
npm run lint && npm run typecheck && npm test
git add package.json package-lock.json src/server docs/superpowers/plans/2026-10-15-online-rooms.md
git commit -m "feat(server): hub WebSocket com códigos de sala e rate limit"
```

### Tarefa 7: `server.ts` (Next + WebSocket no mesmo processo)

**Arquivos:**
- Criar: `server.ts`
- Modificar: `package.json` (scripts `dev` e `start`)

**Interfaces:**
- Consome: `createHub` (Tarefa 6), `LEVELS`

- [x] **Passo 1: ler a documentação do Next 16**

Leia `node_modules/next/dist/docs/01-app/02-guides/custom-server.md`. Confirme que
`getUpgradeHandler()` existe em `node_modules/next/dist/server/next.d.ts`.

- [x] **Passo 2: escrever `server.ts`**

```ts
import { createServer } from "node:http";
import next from "next";
import { LEVELS } from "./src/game/levels";
import { createHub } from "./src/server/hub";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, turbopack: true });

app.prepare().then(() => {
  const handle = app.getRequestHandler();
  const upgradeNext = app.getUpgradeHandler();
  const hub = createHub({ random: Math.random, levels: LEVELS });

  const server = createServer((req, res) => handle(req, res));
  // /ws é das salas; o resto (HMR em dev) continua com o Next
  server.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/ws")) hub.handleUpgrade(req, socket, head);
    else upgradeNext(req, socket, head);
  });
  server.listen(port, () => console.log(`> Sunset Park em http://localhost:${port} (${dev ? "dev" : "produção"})`));
});
```

- [x] **Passo 3: scripts**

Em `package.json`:

```json
"dev": "tsx --env-file-if-exists=.env server.ts",
"start": "NODE_ENV=production tsx --env-file-if-exists=.env server.ts",
```

(`tsx` já está em `dependencies`, então existe na imagem do Railway.)

- [x] **Passo 4: verificar no navegador e por WebSocket**

```bash
npm run dev   # em segundo plano
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/        # 200
node -e 'const W=require("ws");const w=new W("ws://localhost:3000/ws");w.on("open",()=>w.send(JSON.stringify({t:"join",code:null,nick:"x",token:null})));w.on("message",m=>{console.log(String(m));process.exit(0)})'
```

Esperado: `200` e uma linha `{"t":"welcome",...}`. Abra `http://localhost:3000` no navegador:
a tela título renderiza com estilos (Tailwind). Se os estilos sumirem, troque
`turbopack: true` por `{ dev }` e confira de novo. Edite um texto em `Lobby.tsx` e confirme
que o HMR atualiza a página (upgrade repassado ao Next).

- [x] **Passo 5: build de produção**

```bash
npm run build && PORT=3100 npm start   # em segundo plano; depois:
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/   # 200
```

Pare os servidores.

- [x] **Passo 6: verificação padrão, e2e atual e commit**

```bash
npm run lint && npm run typecheck && npm test && npm run test:e2e
git add server.ts package.json docs/superpowers/plans/2026-10-15-online-rooms.md
git commit -m "feat(server): Next e WebSocket no mesmo processo"
```

### Tarefa 8: Tela título, lobby online e rota da sala

**Arquivos:**
- Criar: `src/client/connection.ts`, `src/client/useRoom.ts`, `src/client/nick.ts`,
  `src/components/Portrait.tsx`, `src/components/Title.tsx`, `src/components/RoomScreen.tsx`,
  `src/components/RoomLobby.tsx`, `src/app/room/[code]/page.tsx`, `src/app/local/page.tsx`,
  `e2e/online.spec.ts`
- Modificar: `src/app/page.tsx` (título novo), `src/components/Lobby.tsx` (usa `Portrait`),
  `e2e/play.spec.ts` (lobby local em `/local`)

**Interfaces:**
- Consome: `ClientMsg`, `ServerMsg`, `RoomView`, `ErrorCode`, `CODE_RE`, `cleanNick` (Tarefa 4)
- Produz:
  - `connect(opts: { hello: () => ClientMsg; onMessage: (m: ServerMsg) => void; onOpenChange: (open: boolean) => void }): Connection`
  - `useRoom(code: string, nick: string)` → `{ room, you, error, online, start, send, subscribe }`, onde
    `start: Extract<ServerMsg, { t: "start" }> | null` e
    `subscribe(listener: (m: ServerMsg) => void): () => void` (repete as mensagens da partida desde o último `start`)
  - `loadNick(): string`, `saveNick(nick: string): void`, `markAutoJoin(code: string)`, `takeAutoJoin(code: string): boolean`
  - `RoomScreen({ code })`; `RoomLobby({ room, you, send })`

- [x] **Passo 1: e2e do lobby (falha: rota não existe)**

`e2e/online.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("duas abas: criar sala, entrar pelo link, trocar cowboy e escolher fase", async ({ context }) => {
  // mesmo contexto = mesmo navegador: as abas precisam virar jogadores diferentes
  const a = await context.newPage();
  const b = await context.newPage();

  await a.goto("/");
  await a.getByLabel("Nickname").fill("Ana");
  await a.getByRole("button", { name: "Create room" }).click();
  await expect(a).toHaveURL(/\/room\/[A-HJ-NP-Z]{4}$/);
  await expect(a.getByTestId("member-0")).toContainText("Ana");

  await b.goto(a.url());
  await b.getByLabel("Nickname").fill("Bia");
  await b.getByRole("button", { name: "Join" }).click();
  await expect(a.getByTestId("member-1")).toContainText("Bia");
  await expect(b.getByTestId("member-0")).toContainText("Ana");

  // Bia troca de cowboy com →
  await b.keyboard.press("ArrowRight");
  await expect(a.getByTestId("member-1")).toContainText("Bruiser");

  // só a anfitriã escolhe a fase
  await expect(b.getByRole("button", { name: "Random" })).toHaveCount(0);
  await a.getByRole("button", { name: /^1-2 ·/ }).click();
  await expect(b.getByTestId("picked")).toContainText("1-2");
});
```

Run: `npm run test:e2e -- online.spec.ts`
Esperado: FAIL (não existe "Nickname" na home).

- [x] **Passo 2: `nick.ts` e `connection.ts`**

`src/client/nick.ts`:

```ts
const NICK = "sunset:nick";
const AUTO = "sunset:autojoin";

/** Armazenamento pode estar bloqueado (aba privada): sem ele, só não lembra. */
const read = (s: () => Storage, k: string) => {
  try {
    return s().getItem(k);
  } catch {
    return null;
  }
};
const write = (s: () => Storage, k: string, v: string | null) => {
  try {
    if (v === null) s().removeItem(k);
    else s().setItem(k, v);
  } catch {
    // sem armazenamento: segue sem lembrar
  }
};

export const loadNick = () => read(() => localStorage, NICK) ?? "";
export const saveNick = (nick: string) => write(() => localStorage, NICK, nick.trim());
/** A tela título já pediu o apelido: a sala entra direto, sem perguntar de novo. */
export const markAutoJoin = (code: string) => write(() => sessionStorage, AUTO, code);
export function takeAutoJoin(code: string) {
  const hit = read(() => sessionStorage, AUTO) === code;
  if (hit) write(() => sessionStorage, AUTO, null);
  return hit;
}
export const tokenKey = (code: string) => `sunset:token:${code}`;
export const loadToken = (code: string) => read(() => sessionStorage, tokenKey(code));
export const saveToken = (code: string, token: string) => write(() => sessionStorage, tokenKey(code), token);
```

`src/client/connection.ts`:

```ts
import type { ClientMsg, ServerMsg } from "@/net/protocol";

export type Connection = { send(msg: ClientMsg): void; close(): void };

/** WebSocket em /ws que reconecta sozinho; `hello` (o join) é reenviado a cada conexão. */
export function connect(opts: {
  hello: () => ClientMsg;
  onMessage: (msg: ServerMsg) => void;
  onOpenChange: (open: boolean) => void;
}): Connection {
  let ws: WebSocket | null = null;
  let closed = false;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const open = () => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${proto}://${location.host}/ws`);
    ws = socket;
    socket.onopen = () => {
      opts.onOpenChange(true);
      socket.send(JSON.stringify(opts.hello()));
    };
    socket.onmessage = (e) => opts.onMessage(JSON.parse(String(e.data)) as ServerMsg);
    socket.onclose = () => {
      opts.onOpenChange(false);
      if (!closed) retry = setTimeout(open, 1000);
    };
  };
  open();

  return {
    send(msg) {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    close() {
      closed = true;
      clearTimeout(retry);
      ws?.close();
    },
  };
}
```

- [x] **Passo 3: `useRoom.ts`**

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMsg, ErrorCode, RoomView, ServerMsg } from "@/net/protocol";
import { connect, type Connection } from "./connection";
import { loadToken, saveToken } from "./nick";

export type StartMsg = Extract<ServerMsg, { t: "start" }>;
type Listener = (msg: ServerMsg) => void;

/**
 * Conexão com a sala. `code = "NEW"` cria uma sala; quando o servidor devolve o código,
 * a URL vira /room/CÓDIGO sem recarregar. Mensagens da partida (tick, hash, snapshot…)
 * ficam guardadas desde o último `start` para o jogo recém-montado não perder nenhuma.
 */
export function useRoom(code: string, nick: string) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [you, setYou] = useState<string | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [online, setOnline] = useState(false);
  const [start, setStart] = useState<StartMsg | null>(null);
  const conn = useRef<Connection | null>(null);
  const log = useRef<ServerMsg[]>([]);
  const listeners = useRef(new Set<Listener>());

  useEffect(() => {
    let current = code === "NEW" ? null : code;
    let token: string | null = null;
    const c = connect({
      hello: () => ({ t: "join", code: current, nick, token: current ? loadToken(current) : null }),
      onOpenChange: setOnline,
      onMessage: (msg) => {
        switch (msg.t) {
          case "welcome":
            setYou(msg.you);
            token = msg.token;
            if (current) saveToken(current, token);
            return;
          case "room":
            if (!current) {
              current = msg.room.code;
              // o token vai antes da troca de URL: se a página remontar, ela reentra com ele
              if (token) saveToken(current, token);
              window.history.replaceState(null, "", `/room/${current}`);
            }
            setRoom(msg.room);
            if (msg.room.state === "lobby") {
              log.current = [];
              setStart(null);
            }
            return;
          case "error":
            setError(msg.code);
            if (msg.code === "not_found" || msg.code === "full") c.close();
            return;
          case "start":
            log.current = [];
            setStart(msg);
            return;
          case "pong":
            break;
          default:
            log.current.push(msg);
        }
        for (const l of listeners.current) l(msg);
      },
    });
    conn.current = c;
    return () => c.close();
  }, [code, nick]);

  const send = useCallback((msg: ClientMsg) => conn.current?.send(msg), []);
  const subscribe = useCallback((l: Listener) => {
    for (const m of log.current) l(m);
    listeners.current.add(l);
    return () => void listeners.current.delete(l);
  }, []);

  return { room, you, error, online, start, send, subscribe };
}
```

- [x] **Passo 4: `Portrait.tsx` (extraído de `Lobby.tsx`)**

Mova a função `Portrait` de `src/components/Lobby.tsx` para `src/components/Portrait.tsx`
como `export default function Portrait`, com os imports `useEffect`, `useRef`,
`COWBOYS`, `COWBOYS_WALK`, `spriteImage` e `"use client"` no topo. Em `Lobby.tsx`,
`import Portrait from "./Portrait";` e remova os imports que ficarem sem uso.

- [x] **Passo 5: `Title.tsx` e home**

`src/components/Title.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { loadNick, markAutoJoin, saveNick } from "@/client/nick";
import { VIEW_H, VIEW_W } from "@/game/engine/constants";
import { drawBackground } from "@/game/render";
import { CODE_RE, cleanNick } from "@/net/protocol";

const BG_SCALE = 4;

/** Tela título: apelido + criar sala ou entrar com o código. */
export default function Title() {
  const router = useRouter();
  const [nick, setNick] = useState("");
  const [code, setCode] = useState("");
  const bgRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => setNick(loadNick()), []);
  useEffect(() => {
    const ctx = bgRef.current?.getContext("2d");
    let raf = 0;
    const loop = (now: number) => {
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.setTransform(BG_SCALE, 0, 0, BG_SCALE, 0, 0);
        drawBackground(ctx, now / 40, true);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const valid = cleanNick(nick) !== null;
  const go = (target: string) => {
    saveNick(nick);
    markAutoJoin(target);
    router.push(`/room/${target}`);
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden bg-dusk p-6 text-sand">
      <canvas
        ref={bgRef}
        width={VIEW_W * BG_SCALE}
        height={VIEW_H * BG_SCALE}
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover opacity-70 [image-rendering:pixelated]"
      />
      <div className="relative text-center drop-shadow-[0_3px_0_#1d1118]">
        <h1 className="font-western text-7xl text-gold sm:text-8xl">Sunset Park</h1>
        <p className="mt-2 text-sand">Grab the key, open the door and walk in together.</p>
      </div>
      <form
        className="relative grid w-full max-w-sm gap-4 rounded-lg bg-dusk/85 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) go("NEW");
        }}
      >
        <label className="grid gap-1 text-sm">
          Nickname
          <input
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            maxLength={16}
            className="rounded border-2 border-plank-edge bg-plank px-3 py-2 text-base text-sand"
          />
        </label>
        <button type="submit" disabled={!valid} className="rounded bg-gold px-4 py-2 font-western text-xl text-dusk disabled:opacity-40">
          Create room
        </button>
        <div className="flex items-end gap-2">
          <label className="grid flex-1 gap-1 text-sm">
            Room code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={4}
              className="rounded border-2 border-plank-edge bg-plank px-3 py-2 font-mono text-base uppercase tracking-widest text-sand"
            />
          </label>
          <button
            type="button"
            disabled={!valid || !CODE_RE.test(code)}
            onClick={() => go(code)}
            className="rounded border-2 border-gold px-4 py-2 font-western text-lg text-gold disabled:opacity-40"
          >
            Join
          </button>
        </div>
      </form>
    </main>
  );
}
```

`src/app/page.tsx`:

```tsx
import Title from "@/components/Title";

export default function Home() {
  return <Title />;
}
```

`src/app/local/page.tsx` (lobby local até a Etapa 4):

```tsx
import Lobby from "@/components/Lobby";

export default function LocalPlay() {
  return <Lobby />;
}
```

Em `e2e/play.spec.ts`, no teste "título → lobby", troque `page.goto("/")` por `page.goto("/local")`.

- [x] **Passo 6: `RoomScreen.tsx`, `RoomLobby.tsx` e a rota**

`src/components/RoomScreen.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadNick, loadToken, saveNick, takeAutoJoin } from "@/client/nick";
import { useRoom } from "@/client/useRoom";
import { cleanNick } from "@/net/protocol";
import RoomLobby from "./RoomLobby";

/** /room/[code]: pede o apelido (se preciso), conecta e mostra o lobby. */
export default function RoomScreen({ code }: { code: string }) {
  const [nick, setNick] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const saved = loadNick();
    setDraft(saved);
    // veio da tela título, ou é F5 de quem já estava na sala: entra direto
    if (cleanNick(saved) && (code === "NEW" || takeAutoJoin(code) || loadToken(code))) setNick(saved);
  }, [code]);

  if (!nick) {
    const valid = cleanNick(draft) !== null;
    return (
      <Shell>
        <form
          className="grid w-full max-w-sm gap-4 rounded-lg bg-plank p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            saveNick(draft);
            setNick(draft.trim());
          }}
        >
          <p className="font-western text-2xl text-gold">Room {code}</p>
          <label className="grid gap-1 text-sm">
            Nickname
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={16}
              autoFocus
              className="rounded border-2 border-plank-edge bg-dusk px-3 py-2 text-base text-sand"
            />
          </label>
          <button type="submit" disabled={!valid} className="rounded bg-gold px-4 py-2 font-western text-xl text-dusk disabled:opacity-40">
            Join
          </button>
        </form>
      </Shell>
    );
  }
  return <Connected code={code} nick={nick} />;
}

function Connected({ code, nick }: { code: string; nick: string }) {
  const { room, you, error, send } = useRoom(code, nick);
  if (error === "not_found" || error === "full")
    return (
      <Shell>
        <p className="font-western text-3xl text-gold">{error === "full" ? "Room is full" : "Room not found"}</p>
        <p className="text-dust">{error === "full" ? "8 players already." : "Check the code. The server may also have restarted."}</p>
        <Link href="/" className="rounded bg-gold px-4 py-2 font-semibold text-dusk">
          Back to title
        </Link>
      </Shell>
    );
  if (!room || !you)
    return (
      <Shell>
        <p className="text-dust">Connecting…</p>
      </Shell>
    );
  return <RoomLobby room={room} you={you} send={send} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-dusk p-6 text-sand">{children}</main>;
}
```

`src/components/RoomLobby.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { MAX_PLAYERS } from "@/game/engine/constants";
import { LEVELS, WORLDS } from "@/game/levels";
import { COWBOY_NAMES, PLAYER_COLORS } from "@/game/render";
import type { ClientMsg, MemberView, RoomView } from "@/net/protocol";
import Portrait from "./Portrait";

type Props = { room: RoomView; you: string; send: (msg: ClientMsg) => void };

/** Lobby online: cada um escolhe o cowboy; o anfitrião escolhe a fase e inicia. */
export default function RoomLobby({ room, you, send }: Props) {
  const me = room.members.find((m) => m.id === you);
  const isHost = me?.host ?? false;
  const host = room.members.find((m) => m.host);
  const online = room.members.filter((m) => m.online).length;
  const picked = LEVELS.find((l) => l.slug === room.slug);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") send({ t: "cowboy", dir: -1 });
      if (e.code === "ArrowRight" || e.code === "KeyD") send({ t: "cowboy", dir: 1 });
      if (e.code === "Enter" && isHost) send({ t: "start" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [send, isHost]);

  const copy = () => {
    navigator.clipboard?.writeText(location.href).then(() => setCopied(true), () => {});
  };

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-dusk bg-[linear-gradient(to_bottom,#2b1846,#1d1118_420px)] p-6 text-sand">
      <header className="flex w-full max-w-4xl flex-wrap items-end justify-between gap-3">
        <h1 className="font-western text-4xl text-gold">Room {room.code}</h1>
        <button type="button" onClick={copy} className="rounded border-2 border-gold px-3 py-1 text-sm text-gold">
          {copied ? "Link copied!" : "Copy invite link"}
        </button>
      </header>

      {room.state !== "lobby" && (
        <p className="rounded bg-plank px-4 py-2 text-sm">A level is being played. You will join the next one.</p>
      )}

      <ol className="grid w-full max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: MAX_PLAYERS }, (_, i) => (
          <MemberCard key={i} index={i} member={room.members[i]} mine={room.members[i]?.id === you} send={send} />
        ))}
      </ol>

      <section className="grid w-full max-w-4xl gap-3 rounded-lg bg-dusk/80 p-4">
        <p data-testid="picked" className="text-center">
          {picked ? (
            <>
              Level: <b className="text-gold">{picked.slug} · {picked.name}</b>
            </>
          ) : isHost ? (
            "Pick a level or press Random."
          ) : (
            `Waiting for ${host?.nick ?? "the host"} to pick a level…`
          )}
        </p>
        {isHost && (
          <>
            <div className="flex justify-center gap-3">
              <button type="button" onClick={() => send({ t: "pick", slug: "random" })} className="rounded border-2 border-gold px-4 py-2 font-western text-lg text-gold">
                Random
              </button>
              <button
                type="button"
                onClick={() => send({ t: "start" })}
                disabled={!picked || online < 2 || room.state !== "lobby"}
                className="rounded bg-gold px-6 py-2 font-western text-xl text-dusk disabled:opacity-40"
              >
                {online < 2 ? "Needs 2 players" : "Start (Enter)"}
              </button>
            </div>
            <div className="grid max-h-80 gap-3 overflow-y-auto">
              {WORLDS.map((w, wi) => (
                <div key={w.name} className="grid gap-1">
                  <h2 className="font-western text-gold">World {wi + 1} · {w.name}</h2>
                  <div className="flex flex-wrap gap-2">
                    {LEVELS.filter((l) => l.slug.startsWith(`${wi + 1}-`)).map((l) => (
                      <button
                        key={l.slug}
                        type="button"
                        onClick={() => send({ t: "pick", slug: l.slug })}
                        className={`rounded border-2 px-3 py-1 text-sm ${l.slug === room.slug ? "border-gold bg-gold text-dusk" : "border-plank-edge bg-plank"}`}
                      >
                        {l.slug} · {l.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
      <p className="text-sm text-dust">← → change cowboy</p>
    </main>
  );
}

function MemberCard({ index, member, mine, send }: { index: number; member?: MemberView; mine: boolean; send: Props["send"] }) {
  if (!member)
    return (
      <li className="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed border-plank-edge bg-dusk/70 text-dust">
        <span className="font-western text-lg">P{index + 1}</span>
        <span className="text-xs">waiting</span>
      </li>
    );
  const color = PLAYER_COLORS[member.cowboy];
  return (
    <li
      data-testid={`member-${index}`}
      className={`flex h-48 flex-col items-center justify-between rounded-lg border-4 bg-plank p-2 shadow-lg ${member.online ? "" : "opacity-50"}`}
      style={{ borderColor: color }}
    >
      <span className="w-full truncate text-center font-semibold" style={{ color }}>
        {member.nick}
        {member.host && " ★"}
      </span>
      <Portrait cowboy={member.cowboy} />
      <span className="flex w-full items-center justify-between font-western text-base">
        {mine ? (
          <button type="button" aria-label="Previous cowboy" onClick={() => send({ t: "cowboy", dir: -1 })}>◀</button>
        ) : (
          <span />
        )}
        {COWBOY_NAMES[member.cowboy]}
        {mine ? (
          <button type="button" aria-label="Next cowboy" onClick={() => send({ t: "cowboy", dir: 1 })}>▶</button>
        ) : (
          <span />
        )}
      </span>
      <span className="text-[11px] text-dust">{member.online ? (mine ? "you" : "") : "reconnecting…"}</span>
    </li>
  );
}
```

`src/app/room/[code]/page.tsx`:

```tsx
import { Suspense } from "react";
import RoomScreen from "@/components/RoomScreen";

export default function RoomPage(props: PageProps<"/room/[code]">) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-dusk" />}>
      <Room params={props.params} />
    </Suspense>
  );
}

async function Room({ params }: { params: PageProps<"/room/[code]">["params"] }) {
  const { code } = await params;
  return <RoomScreen code={code.toUpperCase()} />;
}
```

- [x] **Passo 7: rodar o e2e e ver passar**

Run: `npm run test:e2e`
Esperado: PASS em `online.spec.ts`, `play.spec.ts` (agora em `/local`) e `smoke.spec.ts`.
Se o e2e falhar porque a aba B entrou com o mesmo id da A, o token está indo para o
`localStorage`: ele precisa ficar no `sessionStorage` (por aba).

- [x] **Passo 8: verificação, commit, push e PR da Etapa 2**

```bash
npm run lint && npm run typecheck && npm test
git add src e2e docs/superpowers/plans/2026-10-15-online-rooms.md
git commit -m "feat: tela título, salas e lobby online"
git push -u origin feat/online-2-lobby
gh pr create --base feat/online-1-rollback --title "feat: servidor, salas e lobby online (online 2/4)" --body "Etapa 2 do plano docs/superpowers/plans/2026-10-15-online-rooms.md: server.ts com WebSocket, protocolo, salas em memória, tela título e lobby online. A partida online vem na etapa 3; o modo local continua em /local até a etapa 4.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Anote o link do PR no "Registro".

---

## Etapa 3 — Partida online

### Tarefa 9: Partida autoritativa e sala completa

**Arquivos:**
- Criar: `src/server/match.ts`, `src/server/testing/tiny.ts`
- Modificar: `src/server/room.ts` (substituir pelo conteúdo abaixo), `src/server/hub.ts`
  (passa `now` para `join` e `handle`), `src/server/room.test.ts` (`now` nas chamadas; testes novos)
- Teste: `src/server/match.test.ts`

**Interfaces:**
- Consome: `createTimeline`, `Change` (Tarefa 2); `STEP_MS` (Tarefa 3); `worldToJson`, `hashWorld` (Tarefa 1)
- Produz:
  - `COUNTDOWN_MS = 3_000`, `MAX_FUTURE = 120`, `TICK_EVERY = 2`, `HASH_EVERY = 60`
  - `createMatch(level: Level, players: number, now: number): Match` com
    `world(): World`, `frame(): number`, `virtualFrame(now: number): number`,
    `input(seat: number, f: number, bits: number, now: number): boolean`, `restart(): void`,
    `pause(): void`, `resume(now: number): ServerMsg`, `snapshot(): ServerMsg`, `tick(now: number): ServerMsg[]`
  - `RoomDeps` ganha `onCleared: (slug: string, players: number, timeMs: number) => Promise<number | null>`
  - `CLEARED_MS = 5_000`
  - `join(nick, token, send, now)` e `handle(id, msg, now)` (agora com `now`)
  - `TINY: LevelDef & { slug: "99-1" }`

- [x] **Passo 1: criar a branch da etapa**

```bash
git checkout feat/online-2-lobby && git checkout -b feat/online-3-match
```

- [x] **Passo 2: fase mínima de teste**

`src/server/testing/tiny.ts`:

```ts
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
```

- [x] **Passo 3: testes da partida**

`src/server/match.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseLevel } from "@/game/engine/level";
import { createWorld, step } from "@/game/engine/world";
import { decodeInput, RIGHT } from "@/net/bits";
import { STEP_MS } from "@/net/clock";
import type { ServerMsg } from "@/net/protocol";
import { createTimeline } from "@/net/timeline";
import { COUNTDOWN_MS, createMatch, MAX_FUTURE } from "./match";
import { TINY } from "./testing/tiny";

const level = parseLevel(TINY);
/** Instante em que o quadro f fica devido (com folga contra arredondamento). */
const at = (f: number) => COUNTDOWN_MS + f * STEP_MS + 0.5;
const ticks = (msgs: ServerMsg[]) => msgs.filter((m) => m.t === "tick") as Extract<ServerMsg, { t: "tick" }>[];

describe("partida autoritativa", () => {
  it("a fase de teste se conclui andando para a direita", () => {
    const w = createWorld(level, 2);
    for (let f = 0; f < 600 && w.status === "playing"; f++) step(w, [decodeInput(RIGHT), decodeInput(RIGHT)]);
    expect(w.status).toBe("cleared");
  });

  it("nada acontece durante a contagem", () => {
    const m = createMatch(level, 2, 0);
    expect(m.tick(COUNTDOWN_MS - 1)).toEqual([]);
    expect(m.frame()).toBe(0);
  });

  it("input a tempo vale no quadro carimbado; atrasado vale no próximo quadro", () => {
    const m = createMatch(level, 2, 0);
    expect(m.input(0, 5, RIGHT, at(0))).toBe(true);
    const first = ticks(m.tick(at(6)));
    expect(first.flatMap((t) => t.changes)).toEqual([[5, 0, RIGHT]]);
    m.input(1, 2, RIGHT, at(6)); // carimbado no 2, mas o servidor já está no 6
    const later = ticks(m.tick(at(8)));
    expect(later.flatMap((t) => t.changes)).toEqual([[7, 1, RIGHT]]);
  });

  it("transmite a cada 2 quadros e o hash ao cruzar múltiplos de 60; o hash bate com o cliente", () => {
    const m = createMatch(level, 2, 0);
    m.input(0, 1, RIGHT, at(0));
    const msgs: ServerMsg[] = [];
    for (let f = 1; f <= 61; f++) msgs.push(...m.tick(at(f)));
    expect(ticks(msgs).map((t) => t.s)).toEqual(Array.from({ length: 30 }, (_, i) => 2 * (i + 1)));
    const hash = msgs.find((x) => x.t === "hash") as Extract<ServerMsg, { t: "hash" }>;
    expect(hash.s).toBe(60);

    const client = createTimeline(level, 2, 1);
    for (const t of ticks(msgs)) client.confirm(t.s, t.changes, t.resets);
    expect(client.frame()).toBe(60);
    expect(client.hash()).toBe(hash.h);
  });

  it("reinício pedido entra no próximo quadro", () => {
    const m = createMatch(level, 2, 0);
    m.tick(at(10));
    m.restart();
    const t = ticks(m.tick(at(12)));
    expect(t.flatMap((x) => x.resets)).toEqual([11]);
    expect(m.world().resets).toBe(1);
  });

  it("pausa congela; retomar dá contagem e o próximo quadro só depois dela", () => {
    const m = createMatch(level, 2, 0);
    m.tick(at(10));
    m.pause();
    expect(m.tick(at(500))).toEqual([]);
    expect(m.resume(10_000)).toEqual({ t: "resume", s: 10, inMs: COUNTDOWN_MS });
    m.tick(10_000 + COUNTDOWN_MS - 1);
    expect(m.frame()).toBe(10);
    m.tick(10_000 + COUNTDOWN_MS + STEP_MS + 0.5);
    expect(m.frame()).toBe(11);
  });

  it("input carimbado longe demais no futuro é recusado", () => {
    const m = createMatch(level, 2, 0);
    expect(m.input(0, MAX_FUTURE + 5, RIGHT, at(0))).toBe(false);
  });

  it("para de avançar quando a fase é concluída e manda o último tick", () => {
    const m = createMatch(level, 2, 0);
    m.input(0, 1, RIGHT, at(0));
    m.input(1, 1, RIGHT, at(0));
    const msgs: ServerMsg[] = [];
    for (let f = 1; f <= 600 && m.world().status === "playing"; f++) msgs.push(...m.tick(at(f)));
    expect(m.world().status).toBe("cleared");
    expect(ticks(msgs).at(-1)!.s).toBe(m.frame());
  });

  it("snapshot traz quadro, mundo e bits", () => {
    const m = createMatch(level, 2, 0);
    m.input(0, 1, RIGHT, at(0));
    m.tick(at(4));
    const snap = m.snapshot() as Extract<ServerMsg, { t: "snapshot" }>;
    expect(snap.s).toBe(4);
    expect(snap.bits).toEqual([RIGHT, 0]);
    expect(typeof snap.world).toBe("string");
  });
});
```

- [x] **Passo 4: rodar e ver falhar**

Run: `npx vitest run src/server/match.test.ts`
Esperado: FAIL com "Failed to resolve import ./match". (Se só o primeiro teste falhar por causa
do mapa da `TINY`, ajuste o mapa até a fase concluir; ele é a base dos outros.)

- [x] **Passo 5: implementar `match.ts`**

```ts
import type { Level } from "@/game/engine/level";
import { worldToJson } from "@/game/engine/snapshot";
import { STEP_MS } from "@/net/clock";
import type { ServerMsg } from "@/net/protocol";
import { createTimeline, type Change } from "@/net/timeline";

/** Contagem antes do primeiro quadro e na volta de uma pausa: tempo para todos sincronizarem. */
export const COUNTDOWN_MS = 3_000;
/** Input carimbado mais longe que isso no futuro só vem de cliente adulterado. */
export const MAX_FUTURE = 120;
export const TICK_EVERY = 2;
export const HASH_EVERY = 60;
/** Teto de quadros numa chamada: servidor engasgado não trava o processo. */
const MAX_CATCH_UP = 60;

export type Match = ReturnType<typeof createMatch>;

/**
 * Partida autoritativa. O quadro f fica devido em `t0 + f * STEP_MS`; inputs chegam carimbados
 * com o quadro do cliente e, se atrasados, valem no próximo quadro do servidor.
 */
export function createMatch(level: Level, players: number, now: number) {
  const tl = createTimeline(level, players, -1);
  let t0 = now + COUNTDOWN_MS;
  let paused = false;
  let pending: Change[] = [];
  let resets: number[] = [];
  let outChanges: Change[] = [];
  let outResets: number[] = [];
  let lastSent = 0;
  const lastAt = Array<number>(players).fill(0);

  const virtualFrame = (now: number) => (now - t0) / STEP_MS;

  return {
    world: () => tl.world(),
    frame: () => tl.frame(),
    virtualFrame,

    input(seat: number, f: number, bits: number, now: number): boolean {
      if (f > virtualFrame(now) + MAX_FUTURE) return false;
      // nunca no passado e nunca antes de um input anterior do mesmo assento
      const fAt = Math.max(f, tl.frame() + 1, lastAt[seat]);
      lastAt[seat] = fAt;
      pending = [...pending.filter(([pf, ps]) => !(pf === fAt && ps === seat)), [fAt, seat, bits]];
      return true;
    },

    restart() {
      const fAt = tl.frame() + 1;
      if (!resets.includes(fAt)) resets.push(fAt);
    },

    pause() {
      paused = true;
    },

    resume(now: number): ServerMsg {
      paused = false;
      t0 = now + COUNTDOWN_MS - tl.frame() * STEP_MS;
      return { t: "resume", s: tl.frame(), inMs: COUNTDOWN_MS };
    },

    snapshot(): ServerMsg {
      return { t: "snapshot", s: tl.frame(), world: worldToJson(tl.world()), bits: tl.bits() };
    },

    tick(now: number): ServerMsg[] {
      if (paused) return [];
      const due = Math.min(Math.floor(virtualFrame(now)), tl.frame() + MAX_CATCH_UP);
      while (tl.frame() < due && tl.world().status === "playing") {
        const f = tl.frame() + 1;
        const changes = pending.filter(([pf]) => pf === f);
        pending = pending.filter(([pf]) => pf !== f);
        const rs = resets.filter((r) => r === f);
        resets = resets.filter((r) => r !== f);
        tl.confirm(f, changes, rs);
        outChanges.push(...changes);
        outResets.push(...rs);
      }
      const s = tl.frame();
      const ended = tl.world().status === "cleared";
      if (s === lastSent || (s - lastSent < TICK_EVERY && !ended)) return [];
      const msgs: ServerMsg[] = [{ t: "tick", s, changes: outChanges, resets: outResets }];
      if (Math.floor(s / HASH_EVERY) > Math.floor(lastSent / HASH_EVERY)) msgs.push({ t: "hash", s, h: tl.hash() });
      outChanges = [];
      outResets = [];
      lastSent = s;
      return msgs;
    },
  };
}
```

Run: `npx vitest run src/server/match.test.ts`
Esperado: PASS.

- [x] **Passo 6: testes novos da sala**

Em `src/server/room.test.ts`: troque o `setup` para receber `onCleared` e incluir a `TINY`,
passe `now` em todo `join`/`handle` (use `0` nos testes de lobby) e acrescente:

```ts
import { COUNTDOWN_MS } from "./match";
import { STEP_MS } from "@/net/clock";
import { RIGHT } from "@/net/bits";
import { TINY } from "./testing/tiny";
import { CLEARED_MS } from "./room";

// novo setup (substitui o anterior)
function setup() {
  let n = 0;
  const cleared: [string, number, number][] = [];
  const room = createRoom(
    "ABCD",
    {
      random: () => 0,
      newId: () => `id${++n}`,
      levels: [TINY, ...LEVELS],
      onCleared: async (slug, players, ms) => {
        cleared.push([slug, players, ms]);
        return 1234;
      },
    },
    0,
  );
  const client = () => {
    const msgs: ServerMsg[] = [];
    const send = (m: ServerMsg) => void msgs.push(m);
    const last = <T extends ServerMsg["t"]>(t: T) => msgs.findLast((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined;
    return { msgs, send, last, room: () => last("room")!.room as RoomView };
  };
  return { room, client, cleared };
}

/** Sala com Ana (anfitriã, id1) e Bia (id3) jogando a TINY a partir de t = 0. */
function playing() {
  const s = setup();
  const a = s.client();
  const b = s.client();
  s.room.join("Ana", null, a.send, 0);
  s.room.join("Bia", null, b.send, 0);
  s.room.handle("id1", { t: "pick", slug: "99-1" }, 0);
  expect(s.room.handle("id1", { t: "start" }, 0)).toBeNull();
  return { ...s, a, b };
}
const at = (f: number) => COUNTDOWN_MS + f * STEP_MS + 0.5;

describe("sala — partida", () => {
  it("só o anfitrião inicia, com fase escolhida e 2 conectados; assentos na ordem de entrada", () => {
    const s = setup();
    const a = s.client();
    s.room.join("Ana", null, a.send, 0);
    s.room.handle("id1", { t: "pick", slug: "99-1" }, 0);
    expect(s.room.handle("id1", { t: "start" }, 0)).toBe("bad_state"); // sozinha
    const b = s.client();
    s.room.join("Bia", null, b.send, 0);
    expect(s.room.handle("id3", { t: "start" }, 0)).toBe("not_host");
    expect(s.room.handle("id1", { t: "start" }, 0)).toBeNull();
    expect(b.last("start")).toEqual({ t: "start", slug: "99-1", seats: [{ id: "id1", cowboy: 0 }, { id: "id3", cowboy: 1 }] });
    expect(a.room().state).toBe("playing");
    expect(a.room().members.every((m) => m.playing)).toBe(true);
  });

  it("inputs viram ticks; concluir grava o tempo, avisa todos e volta ao lobby", async () => {
    const { room, a, b, cleared } = playing();
    room.handle("id1", { t: "input", f: 1, bits: RIGHT }, at(0));
    room.handle("id3", { t: "input", f: 1, bits: RIGHT }, at(0));
    let f = 1;
    while (!cleared.length && f < 600) room.tick(at(f++));
    expect(cleared).toEqual([["99-1", 2, expect.any(Number)]]);
    await new Promise((r) => setTimeout(r, 0)); // deixa o onCleared resolver
    expect(b.last("cleared")).toEqual({ t: "cleared", timeMs: cleared[0][2], bestMs: 1234 });
    room.tick(at(f) + CLEARED_MS);
    expect(a.room().state).toBe("lobby");
  });

  it("queda de quem está jogando pausa; reconexão manda start + snapshot e retoma", () => {
    const { room, a, b } = playing();
    room.tick(at(30));
    const bTok = b.last("welcome")!.token;
    room.disconnect("id3", b.send, at(30));
    expect(a.last("paused")).toMatchObject({ t: "paused", ids: ["id3"] });
    expect(a.room().state).toBe("paused");

    const b2 = { msgs: [] as ServerMsg[] };
    const send2 = (m: ServerMsg) => void b2.msgs.push(m);
    expect(room.join("Bia", bTok, send2, at(30) + 5000)).toEqual({ ok: true, id: "id3" });
    expect(b2.msgs.map((m) => m.t)).toEqual(expect.arrayContaining(["welcome", "room", "start", "snapshot", "resume"]));
    expect(a.last("resume")).toMatchObject({ t: "resume", s: 30 });
  });

  it("prazo expira na pausa: volta ao lobby sem ele e o próximo vira anfitrião", () => {
    const { room, a, b } = playing();
    room.tick(at(10));
    room.disconnect("id1", a.send, at(10));
    expect(b.room().state).toBe("paused");
    room.tick(at(10) + GRACE_MS);
    const r = b.room();
    expect(r.state).toBe("lobby");
    expect(r.members.map((m) => [m.nick, m.host])).toEqual([["Bia", true]]);
  });

  it("quem entra durante a partida espera e não recebe ticks", () => {
    const { room, client } = playing();
    const c = client();
    room.join("Cris", null, c.send, at(0));
    room.tick(at(20));
    expect(c.room().members.find((m) => m.nick === "Cris")!.playing).toBe(false);
    expect(c.msgs.some((m) => m.t === "tick")).toBe(false);
  });

  it("resync devolve snapshot só para quem pediu", () => {
    const { room, a, b } = playing();
    room.tick(at(10));
    room.handle("id3", { t: "resync" }, at(10));
    expect(b.last("snapshot")).toMatchObject({ t: "snapshot", s: 10 });
    expect(a.last("snapshot")).toBeUndefined();
  });

  it("input absurdo derruba o socket", () => {
    const { room } = playing();
    expect(room.handle("id1", { t: "input", f: 9_999_999, bits: 1 }, at(0))).toBe("drop");
  });
});
```

- [x] **Passo 7: rodar e ver falhar**

Run: `npx vitest run src/server/room.test.ts`
Esperado: FAIL (sala ainda não tem partida; `onCleared` e `now` não existem).

- [x] **Passo 8: substituir `room.ts` pela versão completa**

```ts
import { MAX_PLAYERS } from "@/game/engine/constants";
import { parseLevel, type LevelDef } from "@/game/engine/level";
import { nextFreeCowboy } from "@/game/cowboys";
import { STEP_MS } from "@/net/clock";
import type { ClientMsg, ErrorCode, RoomView, ServerMsg } from "@/net/protocol";
import { createMatch, type Match } from "./match";

/** Quanto tempo um desconectado mantém o lugar (F5, queda de Wi-Fi). */
export const GRACE_MS = 30_000;
/** Sala sem ninguém conectado por este tempo é removida. */
export const EMPTY_MS = 60_000;
/** Depois de concluir a fase, todos voltam ao lobby. */
export const CLEARED_MS = 5_000;

export type Send = (msg: ServerMsg) => void;
export type RoomDeps = {
  random: () => number;
  newId: () => string;
  levels: (LevelDef & { slug: string })[];
  /** Grava o tempo e devolve o recorde para esse número de jogadores. */
  onCleared: (slug: string, players: number, timeMs: number) => Promise<number | null>;
};
export type JoinResult = { ok: true; id: string } | { ok: false; code: ErrorCode };
export type Room = ReturnType<typeof createRoom>;

type Member = { id: string; token: string; nick: string; cowboy: number; send: Send | null; offSince: number };

/** Regras de uma sala. Sem sockets nem relógio: quem chama passa `send` e `now`. */
export function createRoom(code: string, deps: RoomDeps, now: number) {
  let members: Member[] = [];
  let state: RoomView["state"] = "lobby";
  let slug: string | null = null;
  let emptySince: number | null = now;
  let match: Match | null = null;
  /** Ids na ordem dos jogadores da partida (assento = índice). */
  let seats: string[] = [];
  let clearedAt: number | null = null;

  const find = (id: string) => members.find((m) => m.id === id);
  const view = (): RoomView => ({
    code,
    state,
    slug,
    members: members.map((m, i) => ({
      id: m.id,
      nick: m.nick,
      cowboy: m.cowboy,
      host: i === 0,
      online: m.send !== null,
      playing: seats.includes(m.id),
    })),
  });
  const broadcast = (msg: ServerMsg) => {
    for (const m of members) m.send?.(msg);
  };
  /** Mensagens da partida só para quem está jogando. */
  const toSeats = (msg: ServerMsg) => {
    for (const id of seats) find(id)?.send?.(msg);
  };
  const sendRoom = () => broadcast({ t: "room", room: view() });
  const startMsg = (): ServerMsg => ({ t: "start", slug: slug!, seats: seats.map((id) => ({ id, cowboy: find(id)!.cowboy })) });
  const offlineSeats = () => seats.filter((id) => !find(id)?.send);
  const pausedMsg = (now: number): ServerMsg => {
    const since = Math.min(...offlineSeats().map((id) => find(id)!.offSince));
    return { t: "paused", ids: offlineSeats(), ms: Math.max(0, since + GRACE_MS - now) };
  };
  const toLobby = () => {
    state = "lobby";
    match = null;
    seats = [];
    clearedAt = null;
  };

  function join(nick: string, token: string | null, send: Send, now: number): JoinResult {
    let m = token ? members.find((x) => x.token === token) : undefined;
    if (m) {
      m.send = send;
      m.offSince = 0;
    } else {
      if (members.length >= MAX_PLAYERS) return { ok: false, code: "full" };
      const cowboy = nextFreeCowboy(members.map((x) => x.cowboy), -1, 1)!;
      m = { id: deps.newId(), token: deps.newId(), nick, cowboy, send, offSince: 0 };
      members.push(m);
    }
    emptySince = null;
    send({ t: "welcome", you: m.id, token: m.token });
    sendRoom();
    if (match && seats.includes(m.id)) {
      send(startMsg());
      send(match.snapshot());
      if (state === "paused") {
        if (offlineSeats().length === 0) {
          state = "playing";
          toSeats(match.resume(now));
          sendRoom();
        } else send(pausedMsg(now));
      }
    }
    return { ok: true, id: m.id };
  }

  function disconnect(id: string, send: Send, now: number) {
    const m = find(id);
    if (!m || m.send !== send) return; // socket antigo de quem já reconectou
    m.send = null;
    m.offSince = now;
    if (match && seats.includes(id) && clearedAt === null) {
      if (state === "playing") {
        state = "paused";
        match.pause();
      }
      toSeats(pausedMsg(now));
    }
    if (!members.some((x) => x.send)) emptySince = now;
    sendRoom();
  }

  function handle(id: string, msg: ClientMsg, now: number): ErrorCode | "drop" | null {
    const m = find(id);
    if (!m) return "drop";
    const isHost = members[0] === m;
    switch (msg.t) {
      case "cowboy": {
        if (state !== "lobby") return "bad_state";
        const c = nextFreeCowboy(members.map((x) => x.cowboy), m.cowboy, msg.dir);
        if (c !== null) {
          m.cowboy = c;
          sendRoom();
        }
        return null;
      }
      case "pick": {
        if (!isHost) return "not_host";
        if (state !== "lobby") return "bad_state";
        const picked = msg.slug === "random" ? deps.levels[Math.floor(deps.random() * deps.levels.length)].slug : msg.slug;
        if (!deps.levels.some((l) => l.slug === picked)) return "bad_state";
        slug = picked;
        sendRoom();
        return null;
      }
      case "start": {
        if (!isHost) return "not_host";
        const online = members.filter((x) => x.send);
        if (state !== "lobby" || !slug || online.length < 2) return "bad_state";
        const def = deps.levels.find((l) => l.slug === slug)!;
        seats = online.map((x) => x.id);
        match = createMatch(parseLevel(def), seats.length, now);
        state = "playing";
        toSeats(startMsg());
        sendRoom();
        return null;
      }
      case "toLobby":
        if (!isHost) return "not_host";
        if (state === "lobby") return "bad_state";
        toLobby();
        sendRoom();
        return null;
      case "restart":
        if (state === "playing" && match && seats.includes(id)) match.restart();
        return null;
      case "input": {
        const seat = seats.indexOf(id);
        if (!match || seat < 0) return null; // input atrasado de partida que já acabou
        return match.input(seat, msg.f, msg.bits, now) ? null : "drop";
      }
      case "resync":
        if (match && seats.includes(id)) m.send?.(match.snapshot());
        return null;
      case "ping":
        m.send?.({ t: "pong", at: msg.at, frame: match ? match.virtualFrame(now) : 0 });
        return null;
      case "join":
        return "bad_state";
    }
  }

  function tick(now: number) {
    const expired = members.filter((m) => !m.send && now - m.offSince >= GRACE_MS);
    if (expired.length) {
      members = members.filter((m) => !expired.includes(m));
      if (expired.some((m) => seats.includes(m.id))) toLobby(); // a partida não continua sem ele
      sendRoom();
    }
    if (!match || state !== "playing") return;
    for (const msg of match.tick(now)) toSeats(msg);
    if (clearedAt === null && match.world().status === "cleared") {
      clearedAt = now;
      const timeMs = Math.round(match.world().frame * STEP_MS);
      deps
        .onCleared(slug!, seats.length, timeMs)
        .catch(() => null)
        .then((bestMs) => toSeats({ t: "cleared", timeMs, bestMs }));
    }
    if (clearedAt !== null && now - clearedAt >= CLEARED_MS) {
      toLobby();
      sendRoom();
    }
  }

  const isDead = (now: number) => emptySince !== null && now - emptySince >= EMPTY_MS;

  return { code, join, disconnect, handle, tick, isDead, view };
}
```

Atenção ao `cleared` da partida: `toSeats` roda depois do `.then`; se a sala já voltou ao
lobby (`seats = []`), ninguém recebe. Por isso `CLEARED_MS` (5 s) é bem maior que a gravação.

- [x] **Passo 9: hub passa `now` e `onCleared`**

Em `src/server/hub.ts`: `room.join(msg.nick, msg.token, send, now)` e
`bound.room.handle(bound.id, msg, Date.now())`. O tipo de `deps` continua
`Omit<RoomDeps, "newId">` (agora exige `onCleared`). Em `hub.test.ts`, o `createHub` do
`beforeEach` passa `onCleared: async () => null`. Em `server.ts`, passe
`onCleared: async () => null` por enquanto (a Tarefa 10 liga ao banco).

- [x] **Passo 10: rodar e ver passar**

Run: `npx vitest run src/server`
Esperado: PASS.

- [x] **Passo 11: verificação padrão e commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/server server.ts docs/superpowers/plans/2026-10-15-online-rooms.md
git commit -m "feat(server): partida autoritativa com pausa, reconexão e conclusão"
```

### Tarefa 10: Recordes por slug e integração com latência

**Arquivos:**
- Modificar: `src/db/queries.ts`, `server.ts`, `src/server/hub.test.ts`
- Criar: `src/app/room/[code]/actions.ts`

**Interfaces:**
- Produz: `bestTimeBySlug(slug: string, playerCount: number): Promise<number | null>`,
  `insertTimeBySlug(slug: string, playerCount: number, timeMs: number): Promise<void>`,
  server action `getBestTime(slug: string, playerCount: number): Promise<number | null>`

- [x] **Passo 1: teste de integração com latências diferentes**

Em `src/server/hub.test.ts`, mude o `beforeEach` para
`createHub({ random: () => 0, levels: [TINY, ...LEVELS], onCleared: async (...a) => (cleared.push(a), 999) })`,
com `let cleared: [string, number, number][] = []` zerado no `beforeEach`, e acrescente:

```ts
import { parseLevel } from "@/game/engine/level";
import { RIGHT } from "@/net/bits";
import type { ServerMsg } from "@/net/protocol";
import { createTimeline } from "@/net/timeline";
import { COUNTDOWN_MS } from "./match";
import { TINY } from "./testing/tiny";

/** Reproduz o confirmado a partir do que o cliente recebeu e confere cada hash. */
function replay(inbox: ServerMsg[]) {
  const tl = createTimeline(parseLevel(TINY), 2, -1);
  let checked = 0;
  let mismatches = 0;
  for (const m of inbox) {
    if (m.t === "tick") tl.confirm(m.s, m.changes, m.resets);
    if (m.t === "hash" && tl.frame() === m.s) {
      checked++;
      if (tl.hash() !== m.h) mismatches++;
    }
  }
  return { checked, mismatches, status: tl.world().status };
}

it("partida com latências diferentes: hashes batem em todos e a fase conclui", async () => {
  const a = await testClient(url);
  a.send({ t: "join", code: null, nick: "Ana", token: null });
  const { room } = await a.next("room");
  const b = await testClient(url);
  b.send({ t: "join", code: room.code, nick: "Bia", token: null });
  await b.next("welcome");
  a.send({ t: "pick", slug: "99-1" });
  a.send({ t: "start" });
  await a.next("start");
  await b.next("start");
  // os dois seguram → desde o quadro 1; o de Bia chega depois da contagem, atrasado:
  // o servidor reagenda para o próximo quadro dele e todos precisam continuar iguais
  a.send({ t: "input", f: 1, bits: RIGHT }, 30);
  b.send({ t: "input", f: 1, bits: RIGHT }, COUNTDOWN_MS + 300);

  const doneA = await a.next("cleared", 15_000);
  const doneB = await b.next("cleared", 15_000);
  expect(doneA).toEqual(doneB);
  expect(doneA.bestMs).toBe(999);
  for (const c of [a, b]) {
    const r = replay(c.inbox);
    expect(r.checked).toBeGreaterThan(0);
    expect(r.mismatches).toBe(0);
    expect(r.status).toBe("cleared");
  }
  expect(cleared).toEqual([["99-1", 2, doneA.timeMs]]);
}, 20_000);
```

Run: `npx vitest run src/server/hub.test.ts`
Esperado: PASS (a lógica já existe; este teste prova o caminho real por socket). Se falhar,
o defeito está na Tarefa 9: corrija lá, não afrouxe o teste.

- [x] **Passo 2: consultas por slug**

Em `src/db/queries.ts`, acrescente (mantenha as antigas até a Etapa 4):

```ts
export async function bestTimeBySlug(slug: string, playerCount: number): Promise<number | null> {
  const [row] = await db
    .select({ ms: min(bestTimes.timeMs) })
    .from(bestTimes)
    .innerJoin(levels, eq(levels.id, bestTimes.levelId))
    .where(and(eq(levels.slug, slug), eq(bestTimes.playerCount, playerCount)));
  return row?.ms ?? null;
}

export async function insertTimeBySlug(slug: string, playerCount: number, timeMs: number) {
  const [level] = await db.select({ id: levels.id }).from(levels).where(eq(levels.slug, slug));
  if (level) await db.insert(bestTimes).values({ levelId: level.id, playerCount, timeMs });
}
```

`src/app/room/[code]/actions.ts`:

```ts
"use server";

import { bestTimeBySlug } from "@/db/queries";
import { MAX_PLAYERS } from "@/game/engine/constants";

export async function getBestTime(slug: string, playerCount: number): Promise<number | null> {
  const valid = /^\d{1,2}-\d{1,2}$/.test(slug) && Number.isInteger(playerCount) && playerCount >= 1 && playerCount <= MAX_PLAYERS;
  return valid ? bestTimeBySlug(slug, playerCount) : null;
}
```

- [x] **Passo 3: `server.ts` grava no banco**

```ts
import { bestTimeBySlug, insertTimeBySlug } from "./src/db/queries";
// ...
const hub = createHub({
  random: Math.random,
  levels: LEVELS,
  onCleared: async (slug, players, timeMs) => {
    await insertTimeBySlug(slug, players, timeMs);
    return bestTimeBySlug(slug, players);
  },
});
```

Verifique: `npm run db:up`, `npm run dev`, e no `psql` (ou `npx tsx --env-file=.env -e`) que
`bestTimeBySlug("1-1", 2)` responde sem erro.

- [x] **Passo 4: verificação padrão e commit**

```bash
npm run lint && npm run typecheck && npm test
git add src server.ts docs/superpowers/plans/2026-10-15-online-rooms.md
git commit -m "feat(server): recordes por slug e teste de integração com latência"
```

### Tarefa 11: Partida online no navegador

**Arquivos:**
- Criar: `src/components/OnlineGame.tsx`
- Modificar: `src/game/input.ts` (+ `readSoloInput`), `src/game/input.test.ts`,
  `src/components/RoomScreen.tsx` (mostra a partida), `e2e/online.spec.ts`

**Interfaces:**
- Consome: `useRoom` (`start`, `subscribe`, `send`), `createTimeline`, `MAX_AHEAD`,
  `createClock`, `STEP_MS`, `encodeInput`, `getBestTime`
- Produz: `readSoloInput(down: Set<string>): PlayerInput`;
  `OnlineGame({ start, you, isHost, nicks, send, subscribe })`

- [x] **Passo 1: teste de `readSoloInput`**

Em `src/game/input.test.ts`:

```ts
import { readSoloInput } from "./input";

it("um jogador por dispositivo: setas ou WASD, mais qualquer controle", () => {
  vi.stubGlobal("navigator", { getGamepads: () => [null, pad([0.9, 0], [0])] });
  expect(readSoloInput(new Set(["KeyA"]))).toEqual({ left: true, right: true, jump: true, down: false });
  vi.stubGlobal("navigator", { getGamepads: () => [] });
  expect(readSoloInput(new Set(["ArrowUp", "ArrowDown"]))).toEqual({ left: false, right: false, jump: true, down: true });
});
```

Run: `npx vitest run src/game/input.test.ts` → FAIL (`readSoloInput` não existe).

- [x] **Passo 2: implementar `readSoloInput`**

Em `src/game/input.ts`:

```ts
/** Online: um jogador por dispositivo. Setas ou WASD, mais qualquer controle conectado. */
export function readSoloInput(down: Set<string>): PlayerInput {
  const key = (...codes: string[]) => codes.some((c) => down.has(c));
  const pads = [0, 1, 2, 3].map(readGamepad);
  const pad = (k: keyof PlayerInput) => pads.some((p) => p[k]);
  return {
    left: key("ArrowLeft", "KeyA") || pad("left"),
    right: key("ArrowRight", "KeyD") || pad("right"),
    jump: key("ArrowUp", "KeyW") || pad("jump"),
    down: key("ArrowDown", "KeyS") || pad("down"),
  };
}
```

Run: `npx vitest run src/game/input.test.ts` → PASS.

- [x] **Passo 3: e2e da partida (falha: não há jogo na sala)**

Acrescente em `e2e/online.spec.ts`:

```ts
import type { Page } from "@playwright/test";

const playerX = (page: Page, i: number) => page.evaluate((i) => window.__sunsetPark!.world.players[i].x, i);

test("partida online: cada aba move o próprio cowboy e a outra vê", async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await a.goto("/");
  await a.getByLabel("Nickname").fill("Ana");
  await a.getByRole("button", { name: "Create room" }).click();
  await expect(a).toHaveURL(/\/room\/[A-HJ-NP-Z]{4}$/);
  await b.goto(a.url());
  await b.getByLabel("Nickname").fill("Bia");
  await b.getByRole("button", { name: "Join" }).click();
  await expect(a.getByTestId("member-1")).toContainText("Bia");

  await a.getByRole("button", { name: /^1-1 ·/ }).click();
  await a.getByRole("button", { name: /Start/ }).click();
  for (const p of [a, b]) {
    await expect(p.getByTestId("game-canvas")).toBeVisible();
    // passou a contagem e os dois estão no chão
    await p.waitForFunction(() => {
      const w = window.__sunsetPark?.world;
      return !!w && w.frame > 30 && w.players.every((pl) => pl.onGround);
    }, null, { timeout: 15_000 });
  }

  // Bia (assento 1) anda para a direita; Ana vê
  const before = await playerX(a, 1);
  await b.bringToFront();
  await b.keyboard.down("ArrowRight");
  await b.waitForTimeout(600);
  await b.keyboard.up("ArrowRight");
  await expect.poll(() => playerX(a, 1), { timeout: 5_000 }).toBeGreaterThan(before + 20);

  // aba escondida segurando a tecla: os outros veem o cowboy parar
  await b.keyboard.down("ArrowRight");
  await b.waitForTimeout(200);
  await b.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await a.waitForTimeout(500);
  const stopped = await playerX(a, 1);
  await a.waitForTimeout(500);
  expect(await playerX(a, 1)).toBeCloseTo(stopped, 0);
  await b.keyboard.up("ArrowRight");

  // Esc da anfitriã volta todos para a sala
  await a.bringToFront();
  await a.keyboard.press("Escape");
  await expect(b.getByTestId("member-0")).toBeVisible();
});
```

Run: `npm run test:e2e -- online.spec.ts` → FAIL (a sala não mostra o jogo).

- [x] **Passo 4: `OnlineGame.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { getBestTime } from "@/app/room/[code]/actions";
import { sharedAudio } from "@/game/audio";
import { VIEW_H, VIEW_W } from "@/game/engine/constants";
import { parseLevel } from "@/game/engine/level";
import type { World } from "@/game/engine/world";
import { createKeyboard, readSoloInput } from "@/game/input";
import { LEVELS } from "@/game/levels";
import { PLAYER_COLORS, render } from "@/game/render";
import { encodeInput } from "@/net/bits";
import { createClock, STEP_MS } from "@/net/clock";
import type { ClientMsg, ServerMsg } from "@/net/protocol";
import { createTimeline, MAX_AHEAD } from "@/net/timeline";

const SCALE = 3;
const PING_MS = 1000;

type Start = Extract<ServerMsg, { t: "start" }>;
type Props = {
  start: Start;
  you: string;
  isHost: boolean;
  nicks: Record<string, string>;
  send: (msg: ClientMsg) => void;
  subscribe: (listener: (msg: ServerMsg) => void) => () => void;
};

declare global {
  interface Window {
    __sunsetPark?: { world: World };
  }
}

const formatTime = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

/** Partida online: aplica o próprio input na hora, prevê os outros e corrige com o servidor. */
export default function OnlineGame({ start, you, isHost, nicks, send, subscribe }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState({ elapsed: 0, resets: 0, countdown: 0 });
  const [paused, setPaused] = useState<string[] | null>(null);
  const [cleared, setCleared] = useState<{ timeMs: number; bestMs: number | null } | null>(null);
  const [bestMs, setBestMs] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const def = LEVELS.find((l) => l.slug === start.slug)!;

  useEffect(() => {
    getBestTime(start.slug, start.seats.length).then(setBestMs, () => {});
  }, [start]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);

    const level = parseLevel(LEVELS.find((l) => l.slug === start.slug)!);
    const mySeat = start.seats.findIndex((s) => s.id === you);
    const tl = createTimeline(level, start.seats.length, mySeat);
    const clock = createClock();
    const looks = start.seats.map((s) => s.cowboy);
    const keyboard = createKeyboard(window);
    const audio = sharedAudio();
    setMuted(audio.muted());
    let frame = 0;
    let lastBits = 0;
    let isPaused = false;
    let hudAt = 0;
    let raf = 0;

    const ping = () => send({ t: "ping", at: performance.now() });
    const sendBits = (bits: number) => {
      lastBits = bits;
      const f = Math.max(frame, tl.frame() + 1);
      tl.setOwn(f, bits);
      send({ t: "input", f, bits });
    };

    const unsubscribe = subscribe((msg) => {
      switch (msg.t) {
        case "tick":
          tl.confirm(msg.s, msg.changes, msg.resets);
          break;
        case "hash":
          if (tl.frame() === msg.s && tl.hash() !== msg.h) send({ t: "resync" });
          break;
        case "snapshot":
          tl.load(msg.s, msg.world, msg.bits);
          frame = Math.max(frame, msg.s);
          break;
        case "pong":
          clock.sample(msg.at, performance.now(), msg.frame);
          break;
        case "paused":
          isPaused = true;
          setPaused(msg.ids);
          break;
        case "resume":
          isPaused = false;
          setPaused(null);
          clock.clear();
          ping();
          break;
        case "cleared":
          setCleared({ timeMs: msg.timeMs, bestMs: msg.bestMs });
          break;
      }
    });
    const pinger = setInterval(ping, PING_MS);
    ping();

    const onKey = (e: KeyboardEvent) => {
      audio.unlock();
      if (e.code === "KeyR") send({ t: "restart" });
      if (e.code === "KeyM") {
        audio.setMuted(!audio.muted());
        setMuted(audio.muted());
      }
      if (e.code === "Escape" && isHost) send({ t: "toLobby" });
    };
    // aba escondida não roda o laço: solta tudo para o cowboy não andar sozinho para os outros
    const onVisibility = () => {
      if (document.hidden && lastBits !== 0) sendBits(0);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);

    const loop = (now: number) => {
      if (!isPaused && clock.ready() && !document.hidden) {
        frame = Math.max(frame, Math.min(clock.target(now), tl.frame() + MAX_AHEAD));
        const bits = encodeInput(readSoloInput(keyboard.down));
        if (bits !== lastBits) sendBits(bits);
      }
      const { world, events } = tl.predict(frame);
      window.__sunsetPark = { world };
      for (const e of events) audio.play(e);
      render(ctx, world, looks);
      if (now - hudAt > 200) {
        hudAt = now;
        const startsIn = clock.ready() ? (tl.frame() - clock.serverFrame(now)) * STEP_MS : 0;
        setHud({ elapsed: world.frame * STEP_MS, resets: world.resets, countdown: startsIn > 0 ? Math.ceil(startsIn / 1000) : 0 });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(pinger);
      unsubscribe();
      keyboard.dispose();
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      delete window.__sunsetPark;
    };
  }, [start, you, isHost, send, subscribe]);

  const toggleMute = () => {
    const audio = sharedAudio();
    audio.setMuted(!audio.muted());
    setMuted(audio.muted());
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-dusk p-4">
      <div className="flex w-full max-w-[960px] flex-col gap-3">
        <div className="flex items-center justify-between text-sm text-sand">
          <span className="font-western text-base text-gold">
            {start.slug} · {def.name}
          </span>
          <span className="flex items-center gap-3">
            <span className="tabular-nums">
              {formatTime(hud.elapsed)} · deaths {hud.resets}
              {bestMs !== null && ` · best ${formatTime(bestMs)}`}
            </span>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Turn sound on" : "Turn sound off"}
              aria-pressed={muted}
              className="rounded border border-plank-edge bg-plank px-2 py-0.5 text-xs hover:bg-plank-edge"
            >
              {muted ? "🔇 sound" : "🔊 sound"}
            </button>
          </span>
        </div>

        <div className="relative">
          <canvas
            ref={canvasRef}
            width={VIEW_W * SCALE}
            height={VIEW_H * SCALE}
            className="block h-auto w-full rounded-lg border-4 border-plank-edge [image-rendering:pixelated]"
            data-testid="game-canvas"
          />
          {hud.countdown > 0 && !paused && (
            <div className="absolute inset-0 flex items-center justify-center font-western text-8xl text-gold drop-shadow-[0_4px_0_#1d1118]">
              {hud.countdown}
            </div>
          )}
          {paused && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-dusk/75 text-sand">
              <p className="font-western text-3xl text-gold">Paused</p>
              <p>Waiting for {paused.map((id) => nicks[id] ?? "a player").join(", ")} to reconnect (up to 30 s)…</p>
            </div>
          )}
          {cleared && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-dusk/75 text-sand">
              <p className="font-western text-4xl text-gold">Level clear!</p>
              <p className="tabular-nums">
                {formatTime(cleared.timeMs)}
                {cleared.bestMs !== null && ` · best ${formatTime(cleared.bestMs)}`}
              </p>
              <p className="text-sm text-dust">Back to the room in a few seconds…</p>
            </div>
          )}
        </div>

        <ul className="flex flex-wrap gap-4 text-xs text-dust">
          {start.seats.map((s) => (
            <li key={s.id} className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: PLAYER_COLORS[s.cowboy] }} />
              {nicks[s.id] ?? "?"}
              {s.id === you && " (you)"}
            </li>
          ))}
          <li>← → ↑ or WASD · R restart · M sound{isHost && " · Esc back to room"}</li>
        </ul>
      </div>
    </main>
  );
}
```

O `declare global` de `window.__sunsetPark` repete o de `Game.tsx` com o mesmo tipo (o
TypeScript aceita declarações idênticas); o de `Game.tsx` sai na Etapa 4.

- [x] **Passo 5: `RoomScreen` mostra a partida**

Em `Connected` (`src/components/RoomScreen.tsx`), pegue `start` e `subscribe` do `useRoom`
e, antes do `return <RoomLobby …/>`:

```tsx
const me = room.members.find((m) => m.id === you);
if (start && room.state !== "lobby" && me?.playing) {
  const nicks = Object.fromEntries(room.members.map((m) => [m.id, m.nick]));
  return <OnlineGame key={start.slug + start.seats.map((s) => s.id).join()} start={start} you={you} isHost={me.host} nicks={nicks} send={send} subscribe={subscribe} />;
}
```

com `import OnlineGame from "./OnlineGame";`.

- [x] **Passo 6: rodar o e2e e ver passar; conferir no navegador**

Run: `npm run test:e2e`
Esperado: PASS. Depois, manualmente, abra duas janelas em `http://localhost:3000`, jogue a 1-1
até o fim e confira: contagem 3-2-1, seu cowboy responde na hora, o outro se move, sons tocam
uma vez só, "Level clear!" com tempo e recorde, volta à sala. Teste também F5 no meio da fase:
a outra janela mostra "Paused", e a partida retoma após a contagem.

- [x] **Passo 7: verificação, commit, push e PR da Etapa 3**

```bash
npm run lint && npm run typecheck && npm test
git add src e2e docs/superpowers/plans/2026-10-15-online-rooms.md
git commit -m "feat: partida online com rollback no navegador"
git push -u origin feat/online-3-match
gh pr create --base feat/online-2-lobby --title "feat: partida online (online 3/4)" --body "Etapa 3 do plano docs/superpowers/plans/2026-10-15-online-rooms.md: partida autoritativa no servidor, rollback no navegador, pausa por queda, reconexão e recordes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Anote o link do PR no "Registro".

---

## Etapa 4 — Remoção do multiplayer local

### Tarefa 12: Tirar o modo local e atualizar a documentação

**Arquivos:**
- Apagar: `src/app/levels/`, `src/app/play/`, `src/app/local/`, `src/components/Game.tsx`,
  `src/components/Lobby.tsx`, `src/game/lobby.ts`, `src/game/lobby.test.ts`,
  `src/game/progress.ts`, `src/game/progress.test.ts`, `e2e/play.spec.ts`
- Modificar: `src/game/input.ts`, `src/game/input.test.ts`, `src/db/queries.ts`,
  `README.md`, `PROGRESS.md`

- [ ] **Passo 1: criar a branch da etapa**

```bash
git checkout feat/online-3-match && git checkout -b feat/online-4-cleanup
```

- [ ] **Passo 2: apagar o modo local**

```bash
git rm -r src/app/levels src/app/play src/app/local src/components/Game.tsx src/components/Lobby.tsx \
  src/game/lobby.ts src/game/lobby.test.ts src/game/progress.ts src/game/progress.test.ts e2e/play.spec.ts
```

- [ ] **Passo 3: `input.ts` só com o necessário**

Substitua `src/game/input.ts` por:

```ts
import { NO_INPUT, type PlayerInput } from "./engine/world";

/** Teclas de um jogador: setas ou WASD. */
const KEYS: Record<keyof PlayerInput, string[]> = {
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  jump: ["ArrowUp", "KeyW"],
  down: ["ArrowDown", "KeyS"],
};

export function createKeyboard(target: Window) {
  const down = new Set<string>();
  const handled = new Set(Object.values(KEYS).flat());
  const onDown = (e: KeyboardEvent) => {
    if (handled.has(e.code)) e.preventDefault();
    down.add(e.code);
  };
  const onUp = (e: KeyboardEvent) => down.delete(e.code);
  const onBlur = () => down.clear();
  target.addEventListener("keydown", onDown);
  target.addEventListener("keyup", onUp);
  target.addEventListener("blur", onBlur);
  return {
    down,
    dispose() {
      target.removeEventListener("keydown", onDown);
      target.removeEventListener("keyup", onUp);
      target.removeEventListener("blur", onBlur);
    },
  };
}

function readGamepad(index: number): PlayerInput {
  const pad = typeof navigator !== "undefined" ? navigator.getGamepads?.()[index] : null;
  if (!pad) return NO_INPUT;
  const x = pad.axes[0] ?? 0;
  const y = pad.axes[1] ?? 0;
  const pressed = (b: number) => pad.buttons[b]?.pressed ?? false;
  return { left: x < -0.4 || pressed(14), right: x > 0.4 || pressed(15), jump: pressed(0), down: y > 0.6 || pressed(13) };
}

/** Um jogador por dispositivo: setas ou WASD, mais qualquer controle conectado. */
export function readSoloInput(down: Set<string>): PlayerInput {
  const pads = [0, 1, 2, 3].map(readGamepad);
  const read = (k: keyof PlayerInput) => KEYS[k].some((c) => down.has(c)) || pads.some((p) => p[k]);
  return { left: read("left"), right: read("right"), jump: read("jump"), down: read("down") };
}
```

Em `src/game/input.test.ts`, apague os testes de `readInputs`, `deviceLabel` e `inputLabel`
e mantenha o de `readSoloInput` (Tarefa 11) e os de gamepad adaptados a `readSoloInput`.

- [ ] **Passo 4: consultas antigas**

Em `src/db/queries.ts`, apague `listLevels`, `getBestTime`, `insertTime`, `clearedLevelIds`
e o tipo `LevelRow` se ficarem sem uso. Confirme com:

```bash
grep -rn "listLevels\|clearedLevelIds\|insertTime(\|getBestTime(\|game/lobby\|game/progress\|readInputs\|KEYMAPS" src e2e server.ts
```

Esperado: só `getBestTime` da server action em `src/app/room/[code]/actions.ts` e o uso em `OnlineGame.tsx`.

- [ ] **Passo 5: rodar tudo**

```bash
npm run lint && npm run typecheck && npm test && npm run test:e2e
```

Esperado: PASS (`smoke.spec.ts` e `online.spec.ts`).

- [ ] **Passo 6: README e PROGRESS**

No `README.md`: o subtítulo vira "A Wild West co-op platformer for 2 to 8 players, online with
your friends."; a lista de features troca "2 to 8 players: up to 4 on a shared keyboard, plus
up to 4 gamepads" por "2 to 8 players online: create a room, share the link, everyone plays from
their own browser", troca "Progress, level unlocks and best times" por "All levels open; the host
picks one or hits Random. Best times per player count saved in Postgres"; a seção do lobby
descreve a sala online (apelido, código/link, ← → para o cowboy, anfitrião escolhe a fase). Mantenha
as imagens; as legendas que falam de teclado compartilhado mudam para a sala online. Na seção de
desenvolvimento, `npm run dev` agora sobe `server.ts` (Next + WebSocket).

No `PROGRESS.md`: item 3 vira "Multiplayer local (substituído pelo online)" com status
`verificado` e nota "removido na etapa 4 do online"; item 11 vira "Seleção de fase e melhores
tempos (todas liberadas)"; item 12 vira `verificado` com testes
`timeline.test.ts`, `match.test.ts`, `room.test.ts`, `hub.test.ts`, e2e `online.spec.ts`.

- [ ] **Passo 7: commit, push e PR da Etapa 4**

```bash
git add -A
git commit -m "feat: remove o multiplayer local; jogo só online"
git push -u origin feat/online-4-cleanup
gh pr create --base feat/online-3-match --title "feat: remove o multiplayer local (online 4/4)" --body "Etapa 4 do plano docs/superpowers/plans/2026-10-15-online-rooms.md: tira teclado compartilhado, lobby local, /levels e /play; README e PROGRESS atualizados.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Anote o link do PR no "Registro".

---

## Registro

| Etapa | PR | Observações |
|---|---|---|
| 1 | https://github.com/nardocesar/sunset-park/pull/14 | inclui spec, plano e loop |
| 2 | https://github.com/nardocesar/sunset-park/pull/15 | lint React 19: useSyncExternalStore no título/sala |
| 3 | https://github.com/nardocesar/sunset-park/pull/16 | bug da contagem corrigido; 4-1 jogada de ponta a ponta |
| 4 | | |
