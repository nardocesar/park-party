/**
 * A primeira fase sempre abre; as demais abrem quando a anterior (na ordem) já foi concluída.
 * Fase já concluída continua aberta (tempos antigos podem vir de antes do desbloqueio existir).
 */
export function unlockedIds(levels: { id: number }[], cleared: Set<number>): Set<number> {
  return new Set(
    levels.filter((l, i) => i === 0 || cleared.has(l.id) || cleared.has(levels[i - 1].id)).map((l) => l.id),
  );
}
