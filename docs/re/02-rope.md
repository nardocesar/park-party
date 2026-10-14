# 02 — Corda (`Quantum.DistanceConstraintComponent`)

Métodos (via `tools/il2cpp_methods.py`, conferidos no REA/Ghidra):
`.cctor` `0x21e6a40` (`ev_3f2cdcac…`), `OnUpdate` `0x21e4d70` (`ev_ccec2b20…`),
`calcPrevTension` `0x21e5508` (`ev_fee9a47b…`), `calcF` externo `0x21e5aa8` (`ev_cf63edde…`),
`calcF` do par `0x21e6308` (`ev_78896a8f…`), `calcTension` `0x21e613c` (`ev_81ce2cbe…`).

## Observado

| Campo | Valor |
|---|---|
| `K` | `0x3333` = 0,2 |
| `GRAVITY_TENSION_DEFAULT` | `0x8000` = 0,5 |
| `s_CalcInfos` | array de 8 (até 8 jogadores) |
| `RESULT_Y_MAX` | `0x142666` ≈ 20,15 |
| `MIN_X` | `0x1999` ≈ 0,1 |
| `FRICTION_SCALE` | 1,0 |
| `FRICTION_MOVE_SCALE_BEGIN` | 0 |
| `m_Distance` | por fase (`ParseParameter`) |

- `OnUpdate`: jogadores em corrente pela ordem de índice. Para cada um calcula tensão com o
  anterior e com o seguinte; depois `calcF` com os dois vizinhos; aplica a força como
  deslocamento com colisão.
- Par (`0x21e6308`): `d = |B − A|`; se `d ≤ m_Distance` → 0. Senão
  `F = K × (d − m_Distance) × s × dir`, onde `s` divide o esforço pela tensão de cada lado
  (`s = 1 − (tA+1)/(tA+tB+2)`; sem outras tensões, 0,5; vizinho fixo → 1).
- Puxão horizontal contra contato lateral (`FUN_020281f8` com lado 2/3) vira componente vertical
  (`|Fx| × FRICTION_SCALE`): é o "içar pela parede".
- `calcF` externo: jogador no chão não é puxado para baixo (`Fy < −0,1` zerado); `|Fy|` limitado
  a `RESULT_Y_MAX`.
- `calcTension`: a tensão escala com `(número de pendurados + 1)`.

## Inferido / adaptado

- Divisão `s`: o clone usa 0,5 entre dois jogadores e 0/1 quando um está no chão segurando quem
  está no ar (âncora), em vez da fórmula completa de tensões.
- `RESULT_Y_MAX` convertido para px pela altura do jogador (46 → 14).
- Velocidade: puxão para cima zera a queda (`vy`), para o pendurado não acumular gravidade.
