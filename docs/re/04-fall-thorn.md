# 04 — Chão que cai e espinhos

## `FallBoxComponent`

- `.cctor` `0x220fbf8` (`ev_39fc3eb8…`): `WAIT_TIME_DEFAULT` e `WAIT_TIME_MAX` vêm de literais
  convertidos em FP: slots `0x3767478` → literal #1165 = `"0.22"` e `0x377f3e8` → #13435 =
  `"99.999999"` (`tools/il2cpp_literal.py`). `MARGIN = 4`, `CULLING_MARGIN = 8`.
- `OnContacted` `0x220fbe4` (`ev_263d97f4…`): contato vindo de cima (normal < 0) marca a flag.
- `OnUpdate` `0x220f8d4` (`ev_d3f37741…`): com a flag, espera `m_Timer` (= espera da fase) e então
  cai com a gravidade do jogo enquanto não houver contato embaixo; ao pousar, para.

## `ThornComponent`

- `.cctor` `0x20e5bf4` (`ev_b426d32a…`): `CollisionTable[4][2]` — por direção, duas caixas em
  unidades (célula 32, origem no centro da base): base 24×6 a 2..8 e ponta 8×8 a 10..18 a partir da
  base. No clone (×0,5): base 12×3 px e ponta 4×4 px (`THORN_RECTS_UP`), giradas por direção.
- `OnContacted` → `KillPlayer`: tocar a área mortal reinicia a fase.
- Campos `m_MoveDirection`, `m_MoveDistance`, `m_Speed`, `m_WaitTime`, `m_Belt*`: espinhos que se
  movem e em esteira. No clone: vai e volta em linha (`dx`/`dy`, `speed`).

## Consequência de design

Com a área mortal real (metade inferior da célula, ponta estreita) e o pulo do clone, um espinho de
chão isolado deixa ~1 px de margem no pulo. As fases usam espinhos no fundo de valas, no teto e em
esmagadores verticais, em vez de obstáculos rasteiros.
