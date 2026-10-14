<div align="center">

# Park Party

**Plataforma cooperativa para 2 a 4 jogadores no mesmo teclado.**
Peguem a chave, abram a porta e entrem juntos — ninguém passa sozinho.

![Quatro jogadores invertem a gravidade, andam pelo teto sobre os espinhos, pegam a chave e voltam ao chão para entrar na porta](docs/screenshots/gameplay.gif)

<sub>Fase 8-1 · "Teto": os quatro invertem a gravidade, passam pelo teto por cima dos espinhos e voltam ao chão com a chave.</sub>

</div>

---

Park Party é um jogo de navegador inspirado no **PICO PARK**: cada fase é um quebra-cabeça
que só se resolve em equipe. Um jogador sobe nos ombros do outro, todos empurram a mesma
caixa, a corda que amarra o grupo puxa quem ficou para trás. Se um morre, todos recomeçam.

- **61 fases** em **15 mundos**, cada mundo apresentando uma mecânica nova
- **2 a 4 jogadores** em teclado compartilhado ou gamepads
- O que é "de todos" (caixas pesadas, plataformas, portais) **escala com o tamanho do grupo**
- Progresso, desbloqueio de fases e **recordes por número de jogadores** salvos no Postgres

## Mecânicas

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/tower.png" alt="Três jogadores empilhados em torre ao lado de uma plataforma onde o quarto segura a chave"></td>
    <td width="50%"><img src="docs/screenshots/rope.png" alt="Quatro jogadores amarrados por uma corda pulando juntos em direção a um buraco"></td>
  </tr>
  <tr>
    <td><b>Torre humana</b> — empilhem-se para alcançar o que ninguém alcança sozinho.</td>
    <td><b>Amarrados</b> — uma corda liga o grupo; pular fora de sincronia derruba todo mundo.</td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/gravity.png" alt="Dois jogadores andando no teto com gravidade invertida enquanto os outros dois ficam no chão"></td>
    <td><img src="docs/screenshots/push.png" alt="Quatro jogadores em fila empurrando uma caixa que exige 4 pessoas"></td>
  </tr>
  <tr>
    <td><b>De ponta-cabeça</b> — inverta a gravidade e ande pelo teto.</td>
    <td><b>Força bruta</b> — a caixa marcada com 4 só anda se os quatro empurrarem.</td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/rail.png" alt="Quatro jogadores sobre uma plataforma azul marcada 4/4 atravessando um vão"></td>
    <td><img src="docs/screenshots/menu.png" alt="Menu de seleção de fases com mundos, fases concluídas e botões 2P, 3P e 4P"></td>
  </tr>
  <tr>
    <td><b>Engrenagens</b> — a plataforma em trilho só parte com todos a bordo (4/4).</td>
    <td><b>Seleção de fases</b> — escolha quantos jogam; a próxima fase abre ao concluir a anterior.</td>
  </tr>
</table>

### Os 15 mundos

| | Mundo | Mecânica |
|---|---|---|
| 1 | Primeiros passos | Empilhar, chave, caixa, botão e portão, elevador |
| 2 | Amarrados | Corda ligando os jogadores |
| 3 | Contra o tempo | Botões com timer e blocos que piscam |
| 4 | Chão traiçoeiro | Chão que cai e espinhos |
| 5 | Engrenagens | Plataformas em trilho e paredes que empurram |
| 6 | Ventania | Vento |
| 7 | Molas | Trampolins |
| 8 | De ponta-cabeça | Gravidade invertida |
| 9 | Portais | Teletransporte |
| 10 | Cores | Caixas de cor |
| 11 | Apagão | A luz apaga periodicamente |
| 12 | Tamanho | Encolher e crescer |
| 13–15 | Mistura · Desafio · Grande final | Tudo junto, terminando na fase 15-4 "Park Party" |

As fases 3 e 4 de cada mundo são as difíceis: encadeiam vários trechos e misturam a
mecânica do mundo com as anteriores.

## Controles

| Jogador | Andar | Pular | Ação (gravidade, etc.) |
|---|---|---|---|
| 🟧 J1 | `A` `D` | `W` | `S` |
| 🟦 J2 | `←` `→` | `↑` | `↓` |
| 🩷 J3 | `J` `L` | `I` | `K` |
| 🟩 J4 | `Num 4` `Num 6` | `Num 8` | `Num 5` |

Gamepads funcionam também: o gamepad N controla o jogador N. `R` reinicia a fase, `Esc`
volta ao menu e `Enter` vai para a próxima fase depois de concluir.

## Rodando localmente

Requisitos: Node 20.9+ e Docker (para o Postgres).

```bash
npm install
cp .env.example .env     # DATABASE_URL do Postgres local (porta 5434)
npm run db:up            # sobe o Postgres via docker compose
npm run db:migrate       # cria as tabelas
npm run db:seed          # grava as 61 fases no banco
npm run dev              # http://localhost:3000
```

## Como é feito

- **Next.js 16** (App Router, Server Components) + **React 19** + **Tailwind 4**
- **Canvas 2D** com resolução interna de 320×180, escalada em pixel art
- **Motor próprio** em TypeScript, em passo fixo (`src/game/engine/`): colisão por tiles e
  AABB, jogadores que carregam uns aos outros, corda, gravidade invertida, portais, escala…
- **Postgres + Drizzle** para fases, progresso e recordes
- **Vitest + Playwright**: cada fase tem um teste em que um bot a resolve com 2 jogadores,
  então nenhuma fase impossível vai para o jogo

```bash
npm test             # unidade + todas as fases resolvidas por bot
npm run test:e2e     # navegador: menu, teclado e reinício
npm run typecheck && npm run lint
```

As mecânicas foram reimplementadas a partir do estudo do comportamento do jogo original
(anotações em [`docs/re/`](docs/re/)). **Todas as fases são originais**: nenhuma fase, arte
ou asset do PICO PARK foi copiado.

---

<sub>Projeto de fã, sem fins comerciais. Não é afiliado à TECOPARK nem ao PICO PARK.</sub>
