# Loop: clone jogável do Pico Park no navegador

Você está em uma iteração de um loop autônomo. Cada iteração entrega **um
incremento pequeno, verificado e commitado**. Leia este arquivo inteiro antes de
agir, toda vez.

## Objetivo

Recriar no navegador a experiência de jogo do **Pico Park** (co-op de
plataforma de 2 a 8 jogadores, em que os jogadores sobem uns nos outros, dividem
uma chave e só terminam a fase quando todos chegam à porta). O REA serve para
**entender o comportamento** do jogo original (física, regras, máquinas de
estado, estrutura das fases) e reproduzi-lo com fidelidade.

Stack fixa (não trocar sem perguntar ao Carlos):

- **Next.js** (App Router, TypeScript estrito) + **React** + **Tailwind CSS**
- Jogo renderizado em `<canvas>` com game loop próprio em TS puro
  (`requestAnimationFrame` + passo fixo de física, 60 Hz). React só para UI
  (menus, lobby, HUD, seleção de fase), nunca para estado por frame.
- **PostgreSQL** via Drizzle ORM (migrations versionadas) para: definições de
  fase, progresso/fases desbloqueadas, salas/lobbies e melhores tempos.
- Testes: Vitest para a engine (física, colisão, regras), Playwright para o
  fluxo de ponta a ponta.

## Limites (não negociáveis)

- Use o REA apenas sobre a cópia do jogo que o Carlos possui legalmente,
  para estudar comportamento.
- **Não copie assets** (sprites, sons, músicas, fontes, textos, layouts exatos
  de fase) nem código decompilado. Reimplemente a partir do comportamento
  observado, com arte e áudio próprios (formas geométricas simples bastam).
- O projeto não usa o nome "Pico Park" nem a marca na UI; nome de trabalho:
  **"Sunset Park"**.
- Não execute ações destrutivas fora deste repositório.

## Estado do loop

O estado vive em arquivos, não na sua memória:

- `PROGRESS.md` — ledger de obrigações: cada mecânica/feature com status
  (`todo` | `investigando` | `implementado` | `verificado` | `bloqueado`),
  link para as notas de RE e para os testes que a cobrem.
- `docs/re/<mecanica>.md` — achados de engenharia reversa, separados em
  **Observado** (com Evidence IDs do REA), **Inferido** e **Desconhecido**.
  Inclua constantes numéricas (gravidade, velocidade, altura de pulo, coyote
  time etc.) com a fonte de cada uma.

Se `PROGRESS.md` não existir, esta é a iteração 0: execute a **Fase 0** e pare.

## Fase 0 — Bootstrap (só na primeira iteração)

1. **Localizar o alvo.** Procure a instalação do jogo (ex.:
   `~/Library/Application Support/Steam/steamapps/common/` no macOS). Se não
   encontrar um único alvo claro, **pare e pergunte o caminho ao Carlos**. Não
   chute.
2. **Identificar o runtime.** É Unity? Mono (`Managed/Assembly-CSharp.dll`) ou
   IL2CPP (`GameAssembly` + `global-metadata.dat`)?
   - Mono → `inspect_managed_artifact` e `inspect_managed_members` no
     `Assembly-CSharp.dll`.
   - IL2CPP/nativo → `open_binary` e as ferramentas nativas
     (`binary_overview`, `search_procedures`, `procedure_pseudo_code`).
   - Bundle `.app`/archive → `open_binary` + `inspect_artifact` para inventário.
3. Faça um mapa inicial: classes de jogador, controle, física, objetos de fase
   (chave, porta, botão, bloco empurrável, plataforma móvel), câmera e fluxo de
   fase. Registre em `docs/re/00-overview.md`.
4. Monte o scaffold: `create-next-app` (TS, Tailwind, App Router, `--yes`),
   Drizzle + Postgres local (`docker compose` com `postgres:16`), Vitest,
   Playwright, scripts `lint`, `typecheck`, `test`, `test:e2e`.
5. Crie `PROGRESS.md` com o backlog abaixo, refinado pelo que o REA mostrou.
6. Rode a verificação, commite e encerre a iteração.

## Backlog inicial (hipóteses; confirme cada uma com o REA)

1. Movimento horizontal, aceleração/desaceleração, pulo (altura variável?),
   gravidade, coyote time / jump buffer
2. Colisão com tiles e AABB entre jogadores; **jogadores ficam em pé uns sobre
   os outros** e são carregados pelo de baixo
3. Multiplayer local: 2 a 4 jogadores no mesmo teclado + Gamepad API
4. Chave compartilhada (pegar, carregar, passar), porta e condição de vitória
   (todos na porta)
5. Morte/reset coletivo da fase
6. Câmera compartilhada (enquadramento de todos, limites da tela empurram
   jogadores?)
7. Bloco empurrável que exige N jogadores empurrando juntos
8. Botões/placas de pressão e portões
9. Plataformas móveis e elevadores com carga mínima
10. Formato de fase (dados) + 5 fases originais próprias, guardadas no Postgres
11. Seleção de fase, progresso e melhores tempos persistidos
12. Multiplayer online (salas via WebSocket, simulação autoritativa no servidor
    ou lockstep; decida com o Carlos antes de começar este item)

## Cada iteração (depois da Fase 0)

1. **Orientar.** Leia `PROGRESS.md`, `git log --oneline -15` e as notas de RE
   da próxima mecânica. Escolha **um** item: o primeiro `investigando`, senão o
   primeiro `todo` cujas dependências estão `verificado`.
2. **Investigar com o REA** (só o necessário para esse item):
   - Comece pela classe/método relevante já mapeado; use buscas focadas, não
     varreduras repetidas. Reaproveite Evidence e sessões existentes
     (`binary_session`, `get_evidence_bundle` com filtros) antes de reanalisar.
   - Se a estática não fecha a dúvida (ex.: valor efetivo de uma constante,
     sensação do pulo), use observação em runtime (`capture_native_ui_scenario`
     / `capture_process_scenario`) com escopo declarado.
   - Registre achados em `docs/re/<mecanica>.md` com Evidence IDs. O que não
     for confirmado vira `record_unknown` e uma escolha de design explícita.
3. **Especificar e testar primeiro (TDD).** Escreva testes Vitest para a regra
   usando os valores observados (ex.: "jogador A sobre B se move junto quando B
   anda"; "porta só abre com a chave"; "fase termina só com todos na porta").
   Veja-os falhar.
4. **Implementar** o mínimo para passar, na engine em TS puro
   (`src/game/engine/**`), sem acoplar a React. Código simples; nada de
   abstração para features futuras.
5. **Verificar (close the loop)** — tudo precisa passar antes do commit:
   - `npm run lint && npm run typecheck && npm test`
   - Para itens jogáveis: suba o app, rode o Playwright e capture tela do jogo
     no navegador (`capture_web_screenshot` / `capture_browser_scenario` do
     REA ou o Playwright). Confira visualmente que a mecânica funciona.
   - Se houver mudança de schema: migration gerada e aplicada no Postgres local.
6. **Registrar.** Atualize o status no `PROGRESS.md` (`verificado` só com teste
   + verificação no navegador), commite com mensagem clara
   (`feat(engine): jogadores empilháveis` etc.).
7. **Relatar** em 3 a 5 linhas: o que foi feito, evidência usada, o que ficou
   desconhecido, próximo item.

## Quando parar ou pedir ajuda

- **Pare e pergunte** se: o alvo não for encontrado; o REA falhar 2 a 3 vezes
  na mesma operação; uma decisão for de arquitetura (online, autoridade de
  rede, troca de stack); ou um teste não passar após 3 tentativas honestas.
  Marque o item como `bloqueado` com o motivo antes de parar.
- **Encerre o loop** quando todos os itens de 1 a 11 estiverem `verificado` e
  houver 5 fases jogáveis de ponta a ponta com 2 jogadores locais. O item 12
  só começa com aprovação explícita.
- Nunca declare algo pronto sem verificação real. Se pulou uma etapa, diga.
