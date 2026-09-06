ALTER TABLE "war_attacks" ADD COLUMN "name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "war_attacks" ADD COLUMN "town_hall_level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "war_attacks" ADD COLUMN "defense_stars" integer;--> statement-breakpoint
ALTER TABLE "war_attacks" ADD COLUMN "defense_destruction" real;--> statement-breakpoint
ALTER TABLE "wars" ADD COLUMN "state" text DEFAULT 'warEnded' NOT NULL;--> statement-breakpoint
ALTER TABLE "wars" ADD COLUMN "attacks_per_member" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "wars" ADD COLUMN "opponent_roster" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "wars" ADD COLUMN "start_time" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "wars" ADD COLUMN "fetched_at" timestamp with time zone DEFAULT now() NOT NULL;