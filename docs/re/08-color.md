# 08 — Caixas coloridas (`ColorBoxComponent`)

- `isPushedByColor` `0x21cbdc0` (`ev_776ee990…`): percorre os contatos no lado pedido (2 = esquerda,
  3 = direita), inclusive em cadeia por outras caixas; só conta um jogador (tipo 1) **da mesma cor**
  (`m_ColorIndex`) que esteja empurrando (velocidade > 0x41 no sentido).
- `normalProc` `0x21cb5bc` (`ev_ae9c0f9b…`): empurrada pela esquerda → vx = +1 (`0x10000`), pela
  direita → −1; aplica a gravidade do jogo; se `isEnableJump` e o dono (`m_PlayerIndex`) aperta pulo
  com a caixa apoiada, a caixa recebe a velocidade de pulo do dono (`GetJumpVelo`), com sustentação
  enquanto o botão segue apertado; `restrictVeloScreenRange` mantém a caixa na tela.
- No clone: `boxes[].color` (índice do jogador dono); só o dono empurra, a 0,5 px/frame
  (`COLOR_BOX_SPEED`); a caixa pula com `JUMP_VELO` quando o dono aperta pulo e ela está apoiada,
  levando quem está em cima.
