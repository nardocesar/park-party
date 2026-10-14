# 07 — Gravidade invertida e portais

## Gravidade invertida (`PlayerComponent`)

- Métodos: `IsEnableReversalGravity`/`SetEnableReversalGravity` `0x2069218`/`0x2069228`,
  `GetGravityDir` `0x206c3ec`, `checkReverseGravity` `0x2076d8c` (`ev_942bf7e5…`), `reverseGravity`
  `0x20791b0`.
- `checkReverseGravity`: com a flag de habilitação (bit 0x16) e o botão de ação, se o jogador está
  apoiado (consulta de contato no lado do "chão" atual) e nada bloqueia, chama `reverseGravity`;
  também inverte ao tocar certas áreas (bit 0x17 + atores de contato).
- No clone: `flipGravity` na fase; "baixo" (S / ↓ / K / Num 5 / d-pad) com o jogador apoiado inverte
  `gravDir`. Pulo, gravidade, apoio e morte (sair pelo topo) respeitam a direção. Botões podem ficar no
  teto (`ceiling: true`).

## Portais (`WarpComponent`)

- `OnCollided` `0x20f9234` (`ev_3f339c99…`): quem toca recebe evento de teletransporte para `m_Dest`
  (+ `m_DestOffset × m_Counter` para escalonar chegadas). Com `m_IsTargetAll`, todos os jogadores vão
  para `m_Dest + m_DestOffset × índice`. `m_IsResetVelo` zera a velocidade; `m_IsDestInitPos` usa a
  posição inicial.
- No clone: `warps` com `to` e `all`; chegada lado a lado, velocidade zerada e 0,5 s sem reusar portal.
