# PROGRESS — ledger de obrigações

Status: `todo` | `investigando` | `implementado` | `verificado` | `bloqueado`

## Fase 0 — Bootstrap

| Passo | Status | Notas |
|---|---|---|
| Localizar alvo | bloqueado | Jogo não instalado (biblioteca Steam vazia em 2026-10-14). Carlos vai instalar e passar o caminho. |
| Identificar runtime (Mono/IL2CPP) | todo | Depende do alvo |
| Mapa inicial (`docs/re/00-overview.md`) | todo | Depende do alvo |
| Scaffold (Next 16, Tailwind 4, Drizzle, Postgres :5434, Vitest, Playwright) | verificado | lint, typecheck, test e e2e smoke passando |

## Backlog (hipóteses a confirmar com o REA)

| # | Item | Status | RE | Testes |
|---|---|---|---|---|
| 1 | Movimento, pulo, gravidade, coyote/jump buffer | todo | | |
| 2 | Colisão tiles + AABB entre jogadores; empilhar e ser carregado | todo | | |
| 3 | Multiplayer local (teclado 2–4 + Gamepad API) | todo | | |
| 4 | Chave compartilhada, porta, vitória com todos na porta | todo | | |
| 5 | Morte/reset coletivo | todo | | |
| 6 | Câmera compartilhada | todo | | |
| 7 | Bloco empurrável que exige N jogadores | todo | | |
| 8 | Botões/placas de pressão e portões | todo | | |
| 9 | Plataformas móveis/elevadores com carga mínima | todo | | |
| 10 | Formato de fase + 5 fases próprias no Postgres | todo | | |
| 11 | Seleção de fase, progresso, melhores tempos | todo | | |
| 12 | Multiplayer online | todo | | Só com aprovação do Carlos |

## Notas operacionais

- Postgres do projeto em `localhost:5434` (5433 é de outro projeto local).
- `npm run typecheck` roda `next typegen` antes do `tsc` (tipos de rota do Next 16).
