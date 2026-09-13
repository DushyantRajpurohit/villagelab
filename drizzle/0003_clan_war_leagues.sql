CREATE TABLE "league_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"clan_tag" text NOT NULL,
	"season" text NOT NULL,
	"state" text NOT NULL,
	"clans" text DEFAULT '[]' NOT NULL,
	"rounds" text DEFAULT '[]' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "league_wars" (
	"war_tag" text PRIMARY KEY NOT NULL,
	"season" text NOT NULL,
	"round" integer NOT NULL,
	"state" text NOT NULL,
	"team_size" integer NOT NULL,
	"sides" text NOT NULL,
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "league_groups_clan_season_idx" ON "league_groups" USING btree ("clan_tag","season");--> statement-breakpoint
CREATE INDEX "league_wars_season_idx" ON "league_wars" USING btree ("season");