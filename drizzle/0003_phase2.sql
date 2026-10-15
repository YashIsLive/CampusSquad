CREATE TYPE "public"."reminder_kind" AS ENUM('h72', 'h24', 'h2');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'new_event';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'team_nudge';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'event_reminder';--> statement-breakpoint
CREATE TABLE "reminder_log" (
	"registration_id" uuid NOT NULL,
	"kind" "reminder_kind" NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_log_registration_id_kind_pk" PRIMARY KEY("registration_id","kind")
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "solo_nudged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "attendance_finalized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Events already live count as published, so followers are not notified retroactively.
UPDATE "events" SET "published_at" = "created_at" WHERE "status" <> 'draft' AND "published_at" IS NULL;
