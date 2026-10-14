CREATE TABLE "best_times" (
	"id" serial PRIMARY KEY NOT NULL,
	"level_id" integer NOT NULL,
	"player_count" integer NOT NULL,
	"time_ms" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "levels" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"order" integer NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "levels_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "best_times" ADD CONSTRAINT "best_times_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE no action ON UPDATE no action;