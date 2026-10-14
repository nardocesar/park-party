# 01 — Constantes do jogador e do Quantum (via REA + Ghidra)

Alvo: fatia arm64 de `GameAssembly.dylib`
(sha256 `fba068eeb716096240229569d09f5b5ed6973cbe34982fd9ee2624cc760dab4f`),
Ghidra 12.1.4 pelo REA. Valores `FP` em Q16.16 (`0x10000` = 1,0).

## Como chegamos aos métodos (binário sem símbolos)

1. String `PhotonQuantumCode.dll` em `0x340d975` (`ev_462397bd…`).
2. `dyld_info -fixups`: único ponteiro para ela em `0x368f178` = `Il2CppCodeGenModule`.
3. `read_bytes 0x368f178` (`ev_53f448bd…`): 8630 métodos, `methodPointers` em `0x3870b68`.
4. Ponteiro do método = `methodPointers[rid-1]`, com o rid do token no `global-metadata.dat`.
5. Slots de metadata (ex.: `0x372d948` = `0x2000c35b`) → TypeInfo índice 25005 →
   `Il2CppMetadataRegistration.types` (`0x35fb700`, tabela em `0x3631160`) →
   typedef 2546 = `Quantum.QFP` (tabela de constantes FP nomeadas pelo valor:
   `_0`, `_0_001`, …, `_3` no offset `0x128`, `_100` no `0x1f8`).

## Observado

| Campo | Valor | Evidência |
|---|---|---|
| `QPlayerDefine.WEIGHT_MAX` | `QFP._100` = 100 | `.cctor` `0x214aae0`, `ev_18ba0ed1…` |
| `QPlayerDefine.SPEED_X` | `QFP._3` = 3 | idem |
| `PlayerComponent.PLAYER_W` / `PLAYER_H` | 44 / 48 | `.cctor` `0x207dcec`, `ev_779c1de4…` |
| `PlayerComponent.SPACE_W` / `SPACE_H` | 12 / 2 | idem |
| `PlayerComponent.COLLISION_W` / `COLLISION_H` | 32 / 46 (W−SPACE_W, H−SPACE_H) | idem |
| `PlayerComponent.HEAD_HEIGHT` | 49 | idem |
| `PlayerComponent.STEP_HEIGHT` | 2 | idem |
| `PlayerComponent.WALK_SPEED_SCALE` | 1,5 | idem |
| `PlayerComponent.INVINCIBLE_TIME` | 0,5 | idem |
| `PlayerComponent.BLOW_VELO_X` / `_Y` | 8 / −4 | idem |
| `PlayerComponent.FAINT_TIME` | `QFP._2_50` = 2,5 | idem |
| Queda máxima em `calcGravity` | `0x138000` = 19,5 (= `Game.SideAction.GRAVITY_MAX`) | `0x206c56c`, `ev_90f669dd…` |

- `InitWalkSpeed` (`0x2069ab4`, `ev_43500660…`): `walkSpeed = SPEED_X × (config+0x10 × escala)`.
- `GetJumpVelo` (`0x206bdec`, `ev_60488b8c…`): `jumpVelo = config(...) × escala`, com sinal
  invertido quando a gravidade está invertida.
- `calcGravity`: soma a gravidade da config à velocidade, limita a 19,5 e aplica a escala.

## Inferido

- As constantes de `Game.SideAction` (gravidade 19,5 máx.) são as mesmas do Quantum, e as
  unidades são as do jogador de colisão 32×46.
- A velocidade base de caminhada é 3 unidades/frame (≈ 0,065 altura de jogador por frame;
  hoje usamos 1,5 px para um jogador de 14 px ≈ 0,107).

## Desconhecido

- O multiplicador da caminhada (`config+0x10`), a gravidade e a velocidade de pulo efetivas:
  vêm de um objeto de configuração (asset de dados do Unity), não do código. Para fechar,
  é preciso ler os assets do jogo (`Data/*.assets`), fora do escopo do REA, ou medir em runtime.
- Com `JUMP_VELO=5,1` e `GRAVITY=0,65`, o pulo subiria só 0,42 altura de jogador, o que não
  bate com a sensação do jogo. Indício de que a config sobrescreve esses valores.

## Decisão

Mantidas as constantes atuais do clone. A jogabilidade foi aprovada pelo Carlos e os únicos
valores com efeito confirmado (`GRAVITY_MAX`, proporções de colisão) já são compatíveis ou
dependem de fatores ainda desconhecidos.
