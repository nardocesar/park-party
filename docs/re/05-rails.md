# 05 — Trilhos e paredes que empurram

## `LinePathLiftComponent`

- `.cctor` `0x224f020` (`ev_69ab6c0e…`): `SIGN_OFFSET_Y = -110` (placa acima), `COLLISION_RECT =
  (-59, -9, 118, 18)` (plataforma 118×18 unidades ≈ 3,7 células × 0,56).
- Campos: `m_PathPositionsPtr` (caminho), `m_NeedRideCount`, `m_Return`, `m_WaitInEndPoint`,
  `m_Speed`, `m_AbsLoop`, `m_IsInertia`.
- `calcNeedRideCount` `0x224e828` (`ev_8fb827d2…`): combina o parâmetro da fase com a contagem de
  jogadores — a exigência pode ser relativa a todos.
- No clone: `rails` com `path`, `need` (>0 absoluto limitado aos jogadores, <0 relativo a todos,
  0 = automático), `returns`, `wait`, `speed`.

## `UpDownLiftComponent`

- `.cctor` `0x20f74f0` (`ev_6c0a8d55…`): `SIZE_WIDTH_DEFAULT = 120`, `SIZE_HEIGHT_DEFAULT = 20`,
  `HEIGHT_DEFAULT = -70`, `SPEED_DEFAULT = 1`, `INTERVAL_SEC = 5`. No clone: trilho com `need = 0`
  (vai e volta esperando `wait` nas pontas), velocidade padrão 0,5 px/frame.

## `MoveWallComponent`

- `.cctor` `0x205ba1c` (`ev_0f51b741…`): `MOV_WIDTH_DEFAULT = 50`, `TRIGGER_WIDTH_DEFAULT = 50`,
  `SIZE_WIDTH_DEFAULT = 18`, `SIZE_HEIGHT_DEFAULT = 260`, `IDLE_TIME = 1,5`, `WAIT_TIME = 1,5`,
  `MOVE_SPEED = 2`, `RETURN_START_TIME = 1,5`, `RETURN_SPEED = 1,5`.
- `OnUpdate` `0x205b554` (`ev_79c2b1e5…`): máquina de estados 1→2→3→1: espera `IDLE_TIME`; avança
  `MOVE_SPEED` até `|offset| > |m_MoveWidth|`; espera `RETURN_START_TIME`; volta a `RETURN_SPEED` até
  0. O deslocamento empurra os corpos (`FUN_020363bc`, lado 2/3 conforme o sentido).
- No clone: `pushers` (×0,5: 1 px/frame, volta 0,75 px/frame, largura 8 px ou `w` da fase). Quem
  fica preso entre a parede e um sólido é esmagado (reinicia a fase).
