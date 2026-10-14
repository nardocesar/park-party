import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const levels = pgTable("levels", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  data: jsonb("data").notNull(),
});

export const bestTimes = pgTable("best_times", {
  id: serial("id").primaryKey(),
  levelId: integer("level_id")
    .notNull()
    .references(() => levels.id),
  playerCount: integer("player_count").notNull(),
  timeMs: integer("time_ms").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
