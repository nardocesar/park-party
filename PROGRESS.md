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
| 3 | Multiplayer local (teclado 4 + Gamepad API) | verificado | — | `input.test.ts` (teclado + gamepad mockado), e2e `play.spec.ts`; gamepad físico não testado |
| 4 | Chave compartilhada, porta, vitória com todos na porta | verificado | `KeyComponent`, `GoalComponent` | `world.test.ts` › chave, porta |
| 5 | Morte/reset coletivo | verificado | — | `world.test.ts` › morte e reset |
| 6 | Câmera compartilhada + borda da tela bloqueia | verificado | `calcScreenEndWalkVeloX` | `world.test.ts` › câmera compartilhada |
| 7 | Caixa empurrável que exige N jogadores | verificado | `PushBoxComponent` (regra inferida; `VELO_X` desconhecido) | `world.test.ts` › caixa; fase 1-4 |
| 8 | Botões/placas de pressão e portões | verificado | `SwitchComponent`, `GateComponent` (velocidades desconhecidas) | `world.test.ts` › botão e portão; fase 1-4 |
| 9 | Plataformas/elevadores com carga mínima | verificado | `WeightedLiftComponent` (`WAIT_TIME`, `MOVE_SPEED_DEFAULT` desconhecidos) | `world.test.ts` › elevador; fase 1-5 |
| 10 | Formato de fase + 5 fases próprias no Postgres | verificado | — | 5 fases; `levels.test.ts` resolve todas com 2 jogadores |
| 11 | Seleção de fase, progresso, melhores tempos | verificado | — | `progress.test.ts`; desbloqueio e avanço verificados no navegador |
| 12 | Multiplayer online | todo | | Só com aprovação do Carlos |

## Mundos (mecânicas lidas do binário via REA; fases originais, 4 por mundo)

Regra: as fases do PICO PARK 2 ficam criptografadas em `StreamingAssets/Stage/PP2`
e não são extraídas nem copiadas. Cada mundo reimplementa uma mecânica a partir do código
(`tools/il2cpp_methods.py` + REA/Ghidra) e traz fases próprias com teste de solução.

| Mundo | Mecânica (componente) | Status | RE |
|---|---|---|---|
| 1 | Empilhar, chave, caixa, botão/portão, elevador | verificado | 00, 01 |
| 2 | Corda (`DistanceConstraintComponent`) | verificado | 02-rope |
| 3 | Botão com tempo / atraso (`SwitchTimer`, `DelaySwitch`) + blocos que piscam (`BlinkBlock`) | verificado | 03-timing |
| 4 | Chão que cai (`FallBox`) + espinhos (`Thorn`) | verificado | 04-fall-thorn |
| 5 | Plataformas em trilho (`LinePathLift`, `UpDownLift`) + paredes que empurram (`MoveWall`) | verificado | 05-rails |
| 6 | Vento (`Wind`) | verificado | 06-wind-spring |
| 7 | Trampolim (`JumpStand`); `JumpSwitch` pendente | verificado | 06-wind-spring |
| 8 | Gravidade invertida (`PlayerComponent.reverseGravity`) | verificado | 07-gravity-warp |
| 9 | Teletransporte (`Warp`) | verificado | 07-gravity-warp |
| 10 | Caixas de cor (`ColorBox`) | verificado | 08-color |
| 11 | Apagão (`Blackout`); holofote pendente | verificado | 09-blackout-scale |
| 12 | Escala (`ScaleSwitch`); maioria pendente | verificado | 09-blackout-scale |
| 13 | Mistura: mecânicas anteriores combinadas | verificado | — |
| 14 | Desafio: combinações mais longas | verificado | — |
| 15 | Grande final: fases longas que encadeiam quase tudo (15-4 "Park Party") | verificado | — |

### Dificuldade

- Fases 3 e 4 de cada mundo (1-4 e 1-5 no Mundo 1) foram endurecidas: encadeiam 2–4 trechos e
  combinam a mecânica do mundo com as anteriores. Os Mundos 13–15 são só de desafio.
- O que é "de todos" (caixas, trilhos e elevadores com `need: ALL`, portões `needAll`, portais
  `all`) escala com o número de jogadores (2 a 4).
- Cada fase difícil tem roteiro de solução em `src/game/levels.hard.test.ts` (2 jogadores),
  composto pelos trechos de `src/game/testing/bot.ts`. Não há roteiro com 4 jogadores ainda.

## Desconhecidos abertos

- `unk_b931977a…` (REA): multiplicador de caminhada, gravidade e pulo efetivos. O código
  lê esses valores de um asset de configuração do Unity, não do binário. As constantes de
  código já foram lidas: `docs/re/01-player-constants.md`. Próxima sonda: medir no jogo rodando.

## Notas operacionais

- Postgres do projeto em `localhost:5434` (5433 é de outro projeto local).
- `npm run typecheck` roda `next typegen` antes do `tsc`.
- `npm run db:seed` regrava as fases de `src/game/levels.ts` no banco.
- Next 16: acesso a dados sem cache precisa ficar dentro de `<Suspense>`.
