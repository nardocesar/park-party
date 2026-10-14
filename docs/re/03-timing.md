# 03 — Botões com tempo e blocos que piscam

Endereços via `tools/il2cpp_methods.py`, decompilados no REA/Ghidra.

## `BlinkBlockComponent`

- `.cctor` `0x2159c24` (`ev_c20f5ff8…`): `INTERVAL_TIME = 1,0 s`; `COLLISION_RECT = (1, 1, 30, 30)`;
  `COLLISION_RECT_BIG = (1, 1, 46, 46)`. **Uma célula do jogo tem 32 unidades** (colisão de 30
  com margem de 1). Com o jogador de colisão 32×46, isso dá a escala do clone: tile 16 px ⇒ 0,5 px
  por unidade. `QPlayerDefine.SPEED_X = 3` ⇒ 1,5 px/frame, a velocidade que o clone já usava.
- `func_default` `0x21597b4` (`ev_ab463700…`): o timer decresce; ao zerar, se o bloco está
  invisível, consulta colisão na área (`FUN_021c1a2c(..., 3)`) e **só reaparece se estiver
  livre** (senão tenta no frame seguinte); ao aparecer, o timer recebe a duração visível; ao sumir,
  a duração invisível. Durações e estado inicial (`m_IsAppearAtStart`) vêm da fase.

## `DelaySwitchComponent`

- `onChangeSwitchState` `0x21e4600` (`ev_052d0b96…`): quando o botão muda, `m_RestSec = m_DelaySec`.
- `OnUpdate` `0x21e418c` (`ev_582d6874…`): `m_RestSec` decresce; ao zerar chama
  `SwitchComponent.NotifyTarget(..., 1)` (`0x20d8ef4`) e `SwitchComponent.RequestOff` (`0x20d84cc`):
  o alvo recebe o efeito depois do atraso e o botão volta para cima.

## `SwitchComponent` / `SwitchTimerActorComponent`

- Campos `m_TimerAddSecond` (botão) e `m_Second`/`m_TargetName` (ator): botão que soma tempo a um
  temporizador. No clone: `timer` mantém o botão ligado N segundos depois de solto.

## Adaptações

- Botão com atraso: o efeito fica (latch) depois de chegar.
- Portão com `needAll`: escolha de design para exigir vários botões ao mesmo tempo
  (o jogo encadeia alvos por nome, `m_TargetName`/`m_SubTargetName`).
