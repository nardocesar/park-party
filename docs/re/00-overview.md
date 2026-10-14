# 00 — Visão geral do alvo

## Alvo

- **PICO PARK 2** (Steam app 2644470), macOS, instalado em
  `~/Library/Application Support/Steam/steamapps/common/PICO PARK 2/pico_park_2.app`.
- Unity **IL2CPP**, binário universal (x86_64 + arm64):
  - `Contents/Frameworks/GameAssembly.dylib` (116 MB, sem símbolos: 748 no `nm`),
    sha256 `ff738134f2049bbbc769e89ab94555d2c4c07ac32d58327f1f1b0e8bafc802c2`
  - `Contents/Resources/Data/il2cpp_data/Metadata/global-metadata.dat` (v29)
- A simulação de jogo roda no **Photon Quantum** (namespace `Quantum`,
  determinístico, ponto fixo `FP`). A camada de apresentação fica em `Game`.

## Ferramentas

- REA `open_binary` no `GameAssembly.dylib`: sessão aberta, mas **nenhum
  provider nativo disponível** (Ghidra sem `GHIDRA_INSTALL_DIR` e Java 11 no
  PATH; Hopper e IDA ausentes). Por isso não há pseudocódigo nem Evidence de
  função.
- `tools/il2cpp_consts.py`: lê do `global-metadata.dat` os nomes de tipos,
  campos e métodos e os **valores padrão de campos `const`**.

## Observado

### Constantes (`const`, lidas do metadata)

| Campo | Valor |
|---|---|
| `Game.SideAction.GRAVITY` | 0.65 |
| `Game.SideAction.GRAVITY_WEAK` | 0.5 |
| `Game.SideAction.GRAVITY_MAX` | 19.5 |
| `Game.SideAction.AIR_RESISTIVITY` | 0.98 |
| `Game.SideAction.JUMP_VELO` | -5.1 (negativo = para cima) |
| `Game.SideAction.ENABLE_JUMP_SEC` | 0.07 |
| `Game.SideAction.PLAYER_JUMP_COUNT_MAX` | 14 |
| `Game.SideAction.PLAYER_JUMP_VELO_COEF` | 0.2 |

### Estrutura (nomes de enums, campos e métodos)

- `Quantum.QPlayerState`: None, Default, Faint, Dead, DeadEnd, **Clear**, Plane,
  BattlePlane, Target, TopView, PoleLadder, GoKart, Graph, Gesture, Mouse.
- `Quantum.InputButtons` (bitmask): Decision, Cancel, Menu1, Menu2, Up, Down,
  Left, Right, Shot, **Jump**, Action1, Action2, botões do mouse.
- `Quantum.QTileMapChipAttr`: Collision, Ice, Break, BreakColor, Fall, TopViewIce.
- `Quantum.QActorType`: 265 tipos. Os do núcleo do jogo: `Player`, `Key`,
  `Goal`, `PushBox*` (Small/Middle/Big/Tall), `Switch`, `Gate`, `Bridge`,
  `WeightedLift*`, `UpDownLift`, `Lift`, `MoveWall`, `CheckPoint`,
  `DistanceConstraint` (corda).
- `PlayerComponent`: `m_WalkSpeed`, `m_JumpVelo`, `m_EnabelJumpSec`,
  `STEP_HEIGHT`, `PLAYER_W/H`, `HEAD_HEIGHT`; métodos `isEnableJump`, `jump`,
  `calcGravity`, `calcScreenEndWalkVeloX`, `getUpperPlayerEdgeX`, `InFrontOfGoal`,
  `calcLittleStep`, `IsEnablePushByPlayer`.
- `KeyComponent`: `m_AttachTarget`, `m_ExcludeTarget`, `m_ExcludeTimer`,
  `EXCLUDE_TIME`, `PLAYER_COUNT_SCALE`, `checkOutMap`, `returnToInitPos`.
- `GoalComponent`: `IsOpen`, `Open`, `OnCollided`.
- `PushBoxComponent`: `m_PushCount`, `m_PushCountBorderPercent`,
  `m_PushCountBorderOffset`, `VELO_X`, `getPushCountBorder`, `isEnablePush`.
- `WeightedLiftComponent`: `m_ContactCount`, `m_MoveContactCount`, `m_Speed`,
  `m_ReturnSpeed`, `WAIT_TIME`, `CalcMoveContactCount`, `MoveLift`.
- `SwitchComponent`: `m_IsOn`, `m_PressedActor`, `m_TargetName`, `NotifyTarget`.
- `QPlayerDefine`: `WEIGHT_MAX`, `SPEED_X`.

## Inferido

- O eixo Y cresce para baixo (o pulo é negativo) e as velocidades são por frame
  a 60 Hz.
- Pulo com altura variável: `GRAVITY_WEAK` vale enquanto o botão de pulo está
  pressionado na subida, e `GRAVITY` no resto do tempo.
- `ENABLE_JUMP_SEC` (0.07 s, cerca de 4 frames) é o *coyote time*, e
  `PlayerComponent.m_EnabelJumpSec` guarda o timer.
- `AIR_RESISTIVITY` amortece a velocidade horizontal no ar.
- A chave gruda num jogador. Ao trocar de portador, o anterior fica excluído
  por `EXCLUDE_TIME`. Se sair do mapa, a chave volta à posição inicial.
- A porta abre quando a chave encosta nela. Cada jogador que chega à porta
  aberta passa ao estado `Clear`, e a fase termina quando todos estão `Clear`.
- A borda da câmera compartilhada limita o andar (`calcScreenEndWalkVeloX`).
- A caixa só se move quando o número de jogadores empurrando atinge um mínimo
  que depende do total de jogadores (`getPushCountBorder`).
- O elevador com peso só se move a partir de um mínimo de jogadores em cima.

## Desconhecido

- Os valores `FP` de `PlayerComponent`, `QPlayerDefine`, `PushBoxComponent`,
  `KeyComponent` e `WeightedLiftComponent` (`static readonly` inicializados em
  `.cctor`, em código nativo). Registrado no REA como
  `unk_32ca01d69bf29ed98e4d8ba272ad8d23a81268a4c7563f7929f551bed3d4b317`.
- Se as constantes de `Game.SideAction` regem o jogador do Quantum ou só um
  modo/visual específico.
- Escala de unidades: quantos pixels/unidades tem um tile.

## Escolhas de design (até o desconhecido ser resolvido)

- Escala adotada: 1 unidade = 1 px lógico; tile de 16 px; jogador de 14×14.
  Com `JUMP_VELO=-5.1` e `GRAVITY=0.65`, o ápice fica em cerca de 20 px (26 px
  segurando o pulo). Assim um jogador sozinho sobe 1 tile, e paredes de 2 ou 3
  tiles exigem empilhar. Isso reproduz o núcleo cooperativo do jogo.
- Velocidade de caminhada de 1.5 px/frame (`SPEED_X` desconhecido).
- `EXCLUDE_TIME` da chave de 0.5 s.
- Entrar na porta é automático ao encostar nela já aberta (no teclado
  compartilhado não sobra tecla para "cima").
