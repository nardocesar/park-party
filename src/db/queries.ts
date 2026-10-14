import { and, asc, eq, min } from "drizzle-orm";
import type { LevelDef } from "@/game/engine/level";
import { db } from "./index";
import { bestTimes, levels } from "./schema";

export type LevelRow = { id: number; slug: string; name: string; order: number; data: LevelDef };

export async function listLevels(): Promise<LevelRow[]> {
  return (await db.select().from(levels).orderBy(asc(levels.order))) as LevelRow[];
}

export async function getBestTime(levelId: number, playerCount: number): Promise<number | null> {
  const [row] = await db
    .select({ ms: min(bestTimes.timeMs) })
    .from(bestTimes)
    .where(and(eq(bestTimes.levelId, levelId), eq(bestTimes.playerCount, playerCount)));
  return row?.ms ?? null;
}

export async function insertTime(levelId: number, playerCount: number, timeMs: number) {
  await db.insert(bestTimes).values({ levelId, playerCount, timeMs });
}
