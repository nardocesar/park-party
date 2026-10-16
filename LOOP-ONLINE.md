# Loop: salas online e multiplayer em rede

Você está numa iteração de um loop autônomo. Cada iteração entrega **uma tarefa** do
plano, verificada e commitada. Leia este arquivo inteiro antes de agir, toda vez.

Para iniciar ou retomar: `/loop Leia LOOP-ONLINE.md e execute uma iteração`.

## Fontes

- Spec (o porquê): `docs/superpowers/specs/2026-10-15-online-rooms-design.md`
- Plano (o como, com código e testes): `docs/superpowers/plans/2026-10-15-online-rooms.md`
- `AGENTS.md`: o Next 16 tem APIs diferentes do que você conhece. Leia
  `node_modules/next/dist/docs/` antes de mexer em rotas ou no servidor.

## Estado

O estado vive em arquivos, não na sua memória:

- **Checkboxes do plano.** A próxima tarefa é a primeira com algum `- [ ]` aberto.
  Tarefa bloqueada fica com `**BLOQUEADA:** motivo` logo abaixo do título.
- **Tabela "Registro"** no fim do plano: link do PR de cada etapa.
- `git log --oneline -15` e `git status`.

## Cada iteração

1. **Orientar.** Rode `git status` e `git branch --show-current`. A árvore precisa estar
   limpa. Se não estiver, a iteração anterior parou no meio: entenda o que ficou pela
   metade (diff + checkboxes) e termine ou desfaça, sem perder trabalho. Ache a próxima
   tarefa no plano e confira que você está na branch da etapa dela (tabela "Branches e
   PRs"). O primeiro passo de cada etapa cria a branch.
2. **Ler a tarefa inteira** e as "Interfaces" dela antes de editar qualquer arquivo.
   Confira que os nomes consumidos existem no código (`grep`): o plano pode ter divergido
   do código em detalhe. Se divergiu, siga o código e anote no commit.
3. **Executar os passos em ordem (TDD).** Teste primeiro, veja falhar pelo motivo
   esperado, implemente, veja passar. Não pule o "ver falhar". Não afrouxe teste para
   passar: se o teste estiver errado, corrija o teste e explique no commit por quê.
4. **Verificar (close the loop).** Antes de todo commit:
   `npm run lint && npm run typecheck && npm test`. Tarefas com e2e também rodam
   `npm run test:e2e` (Postgres local: `npm run db:up`; o Playwright sobe o servidor).
   Passos que pedem conferência no navegador são obrigatórios: use o Playwright ou o
   Chrome e descreva o que viu no relato.
5. **Registrar.** Marque os checkboxes concluídos no plano e commite o plano junto com o
   código, com mensagem clara em PT-BR (`feat(net): …`, `feat(server): …`). Termine com:

   ```
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   ```

6. **Fim de etapa.** Na última tarefa de uma etapa: push, `gh pr create` com a base da
   tabela, link do PR no "Registro". **Nunca faça merge**: merge na `master` dispara deploy
   em produção no Railway, e quem decide é o Carlos. A etapa seguinte começa empilhada
   sobre a branch da anterior.
7. **Relatar** em 3 a 5 linhas: tarefa feita, evidência da verificação (testes, o que viu
   no navegador), desvios do plano, próxima tarefa.

## Quando parar e pedir ajuda

Pare, marque a tarefa como **BLOQUEADA** com o motivo, commite o plano e explique ao Carlos se:

- um teste não passar depois de 3 tentativas honestas de corrigir a causa;
- o teste de determinismo (Tarefa 2) ou de integração (Tarefa 10) mostrar divergência que
  você não consegue explicar: isso é defeito de arquitetura, não de teste;
- uma mudança exigir decisão fora da spec (arquitetura, novo serviço, nova dependência
  além de `ws`/`@types/ws`, mudança de comportamento do jogo);
- `npm run test:e2e`, o Postgres local ou o servidor falharem 2 a 3 vezes por motivo de
  infraestrutura;
- algo pedir ação fora deste repositório (Railway, produção, merge, apagar branch remota).

## Quando encerrar

O loop termina quando todas as tarefas de 1 a 12 estiverem marcadas e os 4 PRs estiverem
no "Registro". Na última iteração, relate o resumo final (PRs, o que foi verificado no
navegador, desvios do plano) e encerre o loop (`ScheduleWakeup` com `stop: true`).
Nunca declare algo pronto sem verificação real. Se pulou uma etapa, diga.
