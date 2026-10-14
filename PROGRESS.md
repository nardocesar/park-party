# PROGRESS — ledger de obrigações

Status: `todo` | `investigando` | `implementado` | `verificado` | `bloqueado`

## Fase 0 — Bootstrap

| Passo | Status | Notas |
|---|---|---|
| Localizar alvo | verificado | PICO PARK 2 (Steam, macOS). O original não tem build oficial para Mac. |
| Identificar runtime | verificado | Unity IL2CPP: `GameAssembly.dylib` sem símbolos + `global-metadata.dat` v29; simulação em Photon Quantum |
| Mapa inicial | verificado | `docs/re/00-overview.md` |
| Scaffold | verificado | Next 16, Tailwind 4, Drizzle, Postgres :5434, Vitest, Playwright |

## Backlog

| # | Item | Status | RE | Testes |
|---|---|---|---|---|
| 1 | Movimento, pulo variável, gravidade, coyote time | verificado | 00-overview (consts `Game.SideAction`) | `world.test.ts` › movimento e pulo |
| 2 | Colisão tiles + AABB entre jogadores; empilhar e ser carregado | verificado | 00-overview (inferido) | `world.test.ts` › empilhar |
| 3 | Multiplayer local (teclado 4 + Gamepad API) | implementado | — | e2e `play.spec.ts` cobre teclado; gamepad não testado |
| 4 | Chave compartilhada, porta, vitória com todos na porta | verificado | `KeyComponent`, `GoalComponent` | `world.test.ts` › chave, porta |
| 5 | Morte/reset coletivo | verificado | — | `world.test.ts` › morte e reset |
| 6 | Câmera compartilhada + borda da tela bloqueia | implementado | `calcScreenEndWalkVeloX` | sem teste dedicado |
| 7 | Caixa empurrável que exige N jogadores | todo | `PushBoxComponent` | |
| 8 | Botões/placas de pressão e portões | todo | `SwitchComponent`, `GateComponent` | |
| 9 | Plataformas/elevadores com carga mínima | todo | `WeightedLiftComponent` | |
| 10 | Formato de fase + 5 fases próprias no Postgres | implementado | — | 3 de 5 fases; `levels.test.ts` resolve as 3 com bot de 2 jogadores |
| 11 | Seleção de fase, progresso, melhores tempos | implementado | — | menu + tempos gravados em `best_times`; falta desbloqueio progressivo |
| 12 | Multiplayer online | todo | | Só com aprovação do Carlos |

## Desconhecidos abertos

- `unk_32ca01d6…`: valores FP do jogador/objetos no Quantum. Para fechar, o REA
  precisa de um provider nativo (Ghidra 12.1 + JDK 21) numa fatia arm64
  do `GameAssembly.dylib`.

## Notas operacionais

- Postgres do projeto em `localhost:5434` (5433 é de outro projeto local).
- `npm run typecheck` roda `next typegen` antes do `tsc`.
- `npm run db:seed` regrava as fases de `src/game/levels.ts` no banco.
- Next 16: acesso a dados sem cache precisa ficar dentro de `<Suspense>`.
