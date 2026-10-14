# 06 — Vento e trampolins

- `WindComponent.OnCollided` `0x20ff0a0` (`ev_36984328…`): quem está na área recebe velocidade externa
  `m_Power` (vetor), × `m_StrongScale` se forte. `.cctor` `0x20ff188` (`ev_504bad91…`): retângulos do
  ventilador e da área (`m_Range`). No clone: `winds` com `fx`/`fy` px/frame e `target` (botão).
- `JumpStandComponent.notifyJump` `0x223e9d8` (`ev_b596afca…`): quem encosta por cima recebe evento de
  pulo com `m_JumpVelo` (x, y); `m_IsKeepVeloX` mantém o x. `.cctor` `0x223fb64` (`ev_2f2fb387…`):
  colisão 32×34. Campos `m_SwitchType`/`m_AppearSec`/`m_DisappearSec`: acionamento e ciclo.
  No clone: `springs` (bloco de 1 tile, `vy`/`vx`, `target`).
- `JumpSwitchComponent.onChangeSwitchState` `0x2240ae0` (`ev_9c5838d8…`): ao mudar o botão, envia o
  mesmo evento de pulo ao alvo (`m_TargetName`). Ainda não implementado no clone.
