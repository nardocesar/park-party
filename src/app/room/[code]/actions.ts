"use server";

import { bestTimeBySlug } from "@/db/queries";
import { MAX_PLAYERS } from "@/game/engine/constants";

export async function getBestTime(slug: string, playerCount: number): Promise<number | null> {
  const valid = /^\d{1,2}-\d{1,2}$/.test(slug) && Number.isInteger(playerCount) && playerCount >= 1 && playerCount <= MAX_PLAYERS;
  return valid ? bestTimeBySlug(slug, playerCount) : null;
}
