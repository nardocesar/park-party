import { and, eq, min } from "drizzle-orm";
import { db } from "./index";
import { bestTimes, levels } from "./schema";

export async function bestTimeBySlug(slug: string, playerCount: number): Promise<number | null> {
  const [row] = await db
    .select({ ms: min(bestTimes.timeMs) })
    .from(bestTimes)
    .innerJoin(levels, eq(levels.id, bestTimes.levelId))
    .where(and(eq(levels.slug, slug), eq(bestTimes.playerCount, playerCount)));
  return row?.ms ?? null;
}

export async function insertTimeBySlug(slug: string, playerCount: number, timeMs: number) {
  const [level] = await db.select({ id: levels.id }).from(levels).where(eq(levels.slug, slug));
  if (level) await db.insert(bestTimes).values({ levelId: level.id, playerCount, timeMs });
}
