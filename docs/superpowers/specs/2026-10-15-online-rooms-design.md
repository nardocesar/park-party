# Salas online e multiplayer em rede — design

Data: 2026-10-15 · Status: aguardando revisão

## Objetivo

Amigos em casas diferentes (inclusive em países diferentes, ex. Brasil + EUA) criam uma
sala, entram por código/link, escolhem cowboys e jogam as fases juntos pela internet, com
o próprio personagem respondendo com a mesma sensação do jogo local.

**Sucesso:** um grupo de 2 a 8 pessoas, cada uma no seu navegador, conclui uma fase que
exige cooperação apertada (torre humana, corda) com um jogador a ~150 ms do servidor,
sem divergência de estado entre os clientes.

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Multiplayer local | **Removido.** Um jogador por dispositivo (setas/WASD ou o primeiro controle). |
| Jogadores | 2 a 8 por sala; todas as 65 fases continuam. |
| Identidade | Sem contas. Apelido (até 16 caracteres) + token de reconexão no `sessionStorage`. |
| Progresso | **Tudo liberado.** O anfitrião escolhe qualquer fase ou aperta **Random**. Recordes continuam globais, por número de jogadores. |
| Controle da sala | **Só o anfitrião** escolhe fase, Random, inicia e volta ao lobby. Se ele sai, o membro mais antigo assume. |
| Queda no meio da fase | **Pausa e espera** até 30 s. Voltou → contagem 3-2-1 e continua. Expirou → todos ao lobby sem ele. Quem entra durante a partida espera no lobby. |
| Netcode | **Rollback com servidor árbitro** (detalhado abaixo). |
| Transporte | WebSocket no **mesmo serviço** do Railway, via `server.ts` customizado do Next. |
| Estado das salas | **Em memória.** Postgres só para `levels` e `best_times`. Deploy derruba salas abertas (aceito). Isso substitui a previsão do `LOOP.md` de salas no Postgres. |

Alternativas descartadas: servidor autoritativo com snapshots (o próprio personagem
responde com o atraso do ping, ruim para plataforma de precisão) e lockstep com atraso
fixo (todos pagam o atraso do jogador mais distante).

## Pré-requisito: determinismo da engine

`step(world, inputs)` já é pura, com passo fixo de 60 Hz, sem `Math.random` nem relógio,
e `World` é só dados (copiável com `structuredClone`). Único ponto não garantido entre
engines JS: `Math.hypot` (4 usos em `engine/world.ts`), cuja precisão a especificação
deixa a cargo da implementação. Troca por `Math.sqrt(x * x + y * y)` (arredondamento
correto em qualquer engine). Adicionar `hashWorld(world): number` para comparar estados.

## Arquitetura

```
server.ts (Node, tsx)
 ├─ HTTP   → Next (páginas, server components)
 ├─ upgrade de HMR (dev) → Next
 └─ WS /ws → RoomHub
               └─ Room (memória, uma por código)
                    ├─ membros: id, apelido, cowboy, conexão, entrada (ordem), anfitrião
                    ├─ estado: "lobby" | "playing" | "paused"
                    └─ Match: World autoritativo + linha do tempo de inputs
```

`package.json`: `dev` e `start` passam a rodar `tsx server.ts` (com `NODE_ENV`);
`build` continua `next build`.

### Unidades

| Arquivo | Responsabilidade | Depende de |
|---|---|---|
| `src/net/protocol.ts` | Tipos das mensagens cliente↔servidor + validação (formato, tamanho, faixas) | — |
| `src/net/timeline.ts` | Rollback puro: estado confirmado, aplicação de inputs reais, previsão até L, eventos sem duplicar | `engine/world` |
| `src/server/room.ts` | Regras da sala: entrar, sair, anfitrião, cowboy único, iniciar, pausar/retomar, expirar | `protocol`, `timeline` |
| `src/server/hub.ts` | Liga sockets a salas, gera códigos, remove salas vazias, rate limit | `room`, `ws` |
| `src/client/connection.ts` | Socket com reconexão, token, ping/RTT | `protocol` |
| `server.ts` | Sobe Next + `ws` no mesmo `http.Server` | `hub` |

Nova dependência: `ws` (servidor). O cliente usa o `WebSocket` nativo do navegador.

### Telas

1. **Título** → **Create room** ou **Join** (código + apelido).
2. **`/room/[code]`** → lobby online: cards dos jogadores, escolha de cowboy com ← →
   (cowboy já escolhido é recusado), botão para copiar o link. O anfitrião vê a lista de
   fases (todas liberadas, agrupadas por mundo) e o botão **Random**.
3. **Partida** na mesma rota, sem navegação: canvas, HUD, overlay de pausa/contagem.
   Ao concluir: tempo + recorde, e após alguns segundos todos voltam ao lobby da sala.

### O que sai

`KEYMAPS` 1–4 / `Device` / leitura de múltiplos dispositivos em `game/input.ts` (fica
um leitor de um jogador), `game/lobby.ts`, `game/progress.ts`, rotas `/levels` e
`/play/[slug]`, server action `saveTime`, `clearedLevelIds`.

## Protocolo

Códigos de sala: 4 letras de um alfabeto sem ambíguos (sem O/0, I/1). Mensagens em JSON.

Cliente → servidor: `join {code?, nick, token?}` (sem `code` cria sala), `cowboy {dir}`,
`pick {slug | "random"}` (anfitrião), `start` (anfitrião), `toLobby` (anfitrião),
`input {f, bits}`, `ping {t}`, `resync`.

Servidor → cliente: `room {estado, membros, anfitrião, fase escolhida}`, `error {code}`
(`not_found`, `full`, `not_host`, `invalid`), `start {slug, def, seats, t0}`,
`tick {s, changes: [f, seat, bits][]}`, `hash {s, h}`, `snapshot {s, world, lastInputs}`,
`paused {seat, deadline}`, `resume {s, at}`, `cleared {timeMs, bestMs}`, `pong {t, s}`.

Input = 4 bits (`left`, `right`, `jump`, `down`), enviado só quando muda.

## Fluxo da partida (rollback)

- **Relógio:** a partida começa no frame 0 do relógio de 60 Hz do servidor. **S** = último
  frame simulado pelo servidor (confirmado).
- **Cliente à frente:** por `ping/pong`, o cliente estima RTT e mantém o frame local
  **L ≈ S + RTT/2 + 2**, para que seu input chegue antes do frame carimbado.
- **Chegada de input no servidor:** `f > S` → aplicado em `f`; `f ≤ S` (atrasado) →
  aplicado em `S + 1`. O servidor tem a palavra final.
- **Transmissão:** a cada 2 frames, `tick {s, changes}` com as mudanças de input até S.
- **Reconciliação no cliente**, a cada `tick`:
  1. parte do estado confirmado (cópia do `World` no frame C);
  2. aplica os inputs reais de C até S e guarda o novo confirmado;
  3. prevê de S até L (próprio input real; os outros repetem o último conhecido);
  4. desenha o estado em L.
- **Eventos (`GameEvent`):** som só na primeira vez que um frame é previsto; ressimular
  não toca de novo.
- **Divergência:** a cada 60 frames o servidor manda `hash {s, h}`. Hash diferente no
  confirmado do cliente → `resync` → `snapshot` substitui o confirmado. O mesmo
  `snapshot` serve para reconexão e para a volta de aba em segundo plano (em vez de
  ressimular centenas de frames).
- **Queda:** socket de um jogador fecha → servidor congela S, manda `paused` com prazo
  de 30 s. Volta → `snapshot` + nova sincronia de relógio + `resume` com contagem 3-2-1.
  Prazo esgota → todos ao lobby, sem o jogador.
- **Fim de fase:** decidido pelo `World` do servidor; ele grava o tempo em `best_times` e
  manda `cleared`.

Fora de escopo (YAGNI): suavização visual das correções de jogadores remotos; só entra se
os saltos incomodarem no teste real.

## Erros e casos de borda

- Sala inexistente/cheia → tela "Room not found" / "Room is full" com volta ao título.
- Sala sem ninguém por 60 s → removida.
- Deploy/restart → cliente mostra "Server restarted" e volta ao título.
- Reconexão (F5, queda curta) → token devolve o mesmo assento e cowboy.
- Anfitrião sai → membro mais antigo assume, inclusive durante a pausa.

## Segurança mínima

- Toda mensagem validada (formato, tamanho, frame plausível, jogador na sala); inválida
  derruba aquele socket.
- Apelido ≤ 16 caracteres, renderizado como texto (nunca HTML).
- Rate limit de mensagens por socket.
- Tempo de conclusão vem só do `World` do servidor.

## Testes

- **Determinismo (central):** mesma sequência de inputs aplicada em pedaços com rollback
  produz o mesmo hash que a simulação direta, em várias fases reais.
- **`timeline.ts`:** previsão, correção, input atrasado em `S + 1`, eventos sem duplicar.
- **`room.ts`:** entrar/sair, troca de anfitrião, cowboy duplicado, só anfitrião inicia,
  pausa e expiração.
- **`protocol.ts`:** mensagens válidas e inválidas.
- **Integração:** servidor real em porta aleatória + 2–3 clientes WebSocket simulados com
  latências artificiais diferentes; hashes confirmados batem e a fase conclui.
- **E2E (Playwright):** dois contextos de navegador criam/entram na sala, escolhem cowboy,
  iniciam uma fase e veem um ao outro se mexer.
- Testes atuais da engine continuam passando após a troca do `Math.hypot`.

## Entrega (um PR por etapa)

1. Determinismo da engine (`Math.hypot`, `hashWorld`) + `net/timeline.ts`, sem rede.
2. `server.ts` + protocolo + salas + lobby online, sem partida.
3. Partida online sobre o rollback, pausa por queda e recordes.
4. Remoção do multiplayer local e das rotas antigas; README atualizado.
