# 09 — Apagão e tamanho

## `BlackoutComponent`

- Campos `m_BrightTime`, `m_DarkTime`, `m_FadeTime`, `m_Darkness`, `m_SearchLightListPtr`; métodos
  `updatePhase`, `startFade`, `AddSearchLight`.
- `.cctor` `0x2157c74` (`ev_df97657a…`): `FADE_TIME_DEFAULT = QFP[0x138] × QFP[0x290]`;
  `DROP_CURTAIN_TIME = QFP._0_80` (0,8 s).
- No clone: `blackout: { bright, dark }`; luz cai em 0,4 s (`BLACKOUT_FADE`) e volta em 0,4 s. Só
  visual: escuridão com halo em volta de cada jogador. Holofotes (`SearchLight`) não implementados.

## `ScaleSwitchComponent` + escala do jogador

- Campos `m_ScaleVelo`, `m_IsDieSmall`; `OnCollided` `0x20b7e60` (`ev_7822c645…`) repassa o contato ao
  botão; `OnUpdate` aplica `m_ScaleVelo` enquanto o botão está pressionado.
- `PlayerComponent.SCALE_MIN = QFP._0_40`, `SCALE_MAX = QFP._3_50` (doc 01).
- `InitWalkSpeed`, `GetJumpVelo` e `calcGravity` multiplicam pela escala do jogador (`param_3+0x50`):
  maior anda mais rápido, pula mais forte e cai com mais gravidade (altura do pulo ∝ escala).
- No clone: `switches[].scale` (px de escala por frame) e `dieSmall`; tamanho, caminhada, pulo e
  gravidade × escala; cresce a partir dos pés e não cresce se colidir.
