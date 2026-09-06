CREATE TABLE "clan_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_tag" text NOT NULL,
	"player_tag" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "clan_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_tag" text NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"clan_points" integer NOT NULL,
	"members" integer NOT NULL,
	"war_wins" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clans" (
	"tag" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"clan_level" integer DEFAULT 1 NOT NULL,
	"clan_points" integer DEFAULT 0 NOT NULL,
	"members" integer DEFAULT 0 NOT NULL,
	"war_wins" integer DEFAULT 0 NOT NULL,
	"war_losses" integer DEFAULT 0 NOT NULL,
	"war_ties" integer DEFAULT 0 NOT NULL,
	"war_win_streak" integer DEFAULT 0 NOT NULL,
	"is_war_log_public" boolean DEFAULT false NOT NULL,
	"required_trophies" integer DEFAULT 0 NOT NULL,
	"required_townhall_level" integer DEFAULT 1 NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fetch_queue" (
	"tag" text NOT NULL,
	"kind" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"next_fetch_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"not_found" boolean DEFAULT false NOT NULL,
	CONSTRAINT "fetch_queue_tag_kind_pk" PRIMARY KEY("tag","kind")
);
--> statement-breakpoint
CREATE TABLE "player_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_tag" text NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"town_hall_level" integer NOT NULL,
	"trophies" integer NOT NULL,
	"war_stars" integer NOT NULL,
	"donations" integer NOT NULL,
	"donations_received" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"tag" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"town_hall_level" integer NOT NULL,
	"exp_level" integer DEFAULT 0 NOT NULL,
	"trophies" integer DEFAULT 0 NOT NULL,
	"best_trophies" integer DEFAULT 0 NOT NULL,
	"war_stars" integer DEFAULT 0 NOT NULL,
	"attack_wins" integer DEFAULT 0 NOT NULL,
	"donations" integer DEFAULT 0 NOT NULL,
	"donations_received" integer DEFAULT 0 NOT NULL,
	"league_name" text,
	"clan_tag" text,
	"role" text,
	"units" text DEFAULT '{}' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "war_attacks" (
	"id" serial PRIMARY KEY NOT NULL,
	"war_id" text NOT NULL,
	"player_tag" text NOT NULL,
	"map_position" integer NOT NULL,
	"attacks_used" integer DEFAULT 0 NOT NULL,
	"attacks_allowed" integer DEFAULT 2 NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"destruction" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wars" (
	"id" text PRIMARY KEY NOT NULL,
	"clan_tag" text NOT NULL,
	"opponent_tag" text,
	"opponent_name" text,
	"team_size" integer NOT NULL,
	"result" text,
	"stars" integer DEFAULT 0 NOT NULL,
	"opponent_stars" integer DEFAULT 0 NOT NULL,
	"destruction" real DEFAULT 0 NOT NULL,
	"opponent_destruction" real DEFAULT 0 NOT NULL,
	"end_time" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "membership_clan_idx" ON "clan_memberships" USING btree ("clan_tag","left_at");--> statement-breakpoint
CREATE INDEX "membership_player_idx" ON "clan_memberships" USING btree ("player_tag");--> statement-breakpoint
CREATE INDEX "clan_snap_tag_time_idx" ON "clan_snapshots" USING btree ("clan_tag","captured_at");--> statement-breakpoint
CREATE INDEX "clans_points_idx" ON "clans" USING btree ("clan_points");--> statement-breakpoint
CREATE INDEX "queue_due_idx" ON "fetch_queue" USING btree ("next_fetch_at","priority");--> statement-breakpoint
CREATE INDEX "player_snap_tag_time_idx" ON "player_snapshots" USING btree ("player_tag","captured_at");--> statement-breakpoint
CREATE INDEX "players_clan_idx" ON "players" USING btree ("clan_tag");--> statement-breakpoint
CREATE INDEX "players_fetched_idx" ON "players" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "war_attacks_war_idx" ON "war_attacks" USING btree ("war_id");--> statement-breakpoint
CREATE INDEX "war_attacks_player_idx" ON "war_attacks" USING btree ("player_tag");--> statement-breakpoint
CREATE INDEX "wars_clan_time_idx" ON "wars" USING btree ("clan_tag","end_time");