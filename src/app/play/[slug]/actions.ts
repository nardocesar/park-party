"use server";

import { insertTime } from "@/db/queries";
import { MAX_PLAYERS } from "@/game/engine/constants";

export async function saveTime(levelId: number, playerCount: number, timeMs: number) {
  const valid =
    Number.isInteger(levelId) &&
    Number.isInteger(playerCount) && playerCount >= 1 && playerCount <= MAX_PLAYERS &&
    Number.isInteger(timeMs) && timeMs > 0 && timeMs < 60 * 60 * 1000;
  if (!valid) throw new Error("Invalid time");
  await insertTime(levelId, playerCount, timeMs);
}
