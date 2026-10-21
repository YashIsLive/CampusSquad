CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"target_label" text NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_target_type_check" CHECK ("reports"."target_type" IN ('event', 'profile', 'team', 'conversation')),
	CONSTRAINT "reports_reason_check" CHECK ("reports"."reason" IN ('spam', 'fake', 'harassment', 'inappropriate', 'other')),
	CONSTRAINT "reports_status_check" CHECK ("reports"."status" IN ('open', 'resolved', 'dismissed'))
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "terms_version" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "adult_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_profiles_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_profiles_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reports_status_created_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_reporter_idx" ON "reports" USING btree ("reporter_id","created_at");--> statement-breakpoint
-- Server-only table: RLS on, no policies, no grants (the REST API can't read or write reports).
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Demo accounts are treated as having accepted the current terms; real users confirm once.
UPDATE public.profiles SET terms_version = '2026-10-19', terms_accepted_at = now(), adult_confirmed_at = now()
WHERE email LIKE '%.seed.test' AND onboarded_at IS NOT NULL;
