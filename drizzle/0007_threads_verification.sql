CREATE TABLE "application_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_messages_body_check" CHECK (char_length("application_messages"."body") BETWEEN 1 AND 2000)
);
--> statement-breakpoint
CREATE TABLE "verification_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"college_id" uuid NOT NULL,
	"id_card_path" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text,
	"reviewer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "verification_requests_status_check" CHECK ("verification_requests"."status" IN ('pending', 'approved', 'rejected', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "vouches" (
	"voucher_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"college_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vouches_voucher_id_user_id_pk" PRIMARY KEY("voucher_id","user_id"),
	CONSTRAINT "vouches_not_self" CHECK ("vouches"."voucher_id" <> "vouches"."user_id")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "college_verified_via" text;--> statement-breakpoint
ALTER TABLE "application_messages" ADD CONSTRAINT "application_messages_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_messages" ADD CONSTRAINT "application_messages_sender_id_profiles_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_reviewer_id_profiles_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouches" ADD CONSTRAINT "vouches_voucher_id_profiles_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouches" ADD CONSTRAINT "vouches_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouches" ADD CONSTRAINT "vouches_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_messages_app_created_idx" ON "application_messages" USING btree ("application_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_requests_one_pending" ON "verification_requests" USING btree ("user_id") WHERE "verification_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "verification_requests_college_status_idx" ON "verification_requests" USING btree ("college_id","status");--> statement-breakpoint
CREATE INDEX "vouches_user_college_idx" ON "vouches" USING btree ("user_id","college_id");
--> statement-breakpoint

-- 1) Application threads: leader ↔ applicant conversation about one application.
-- 2) Campus verification without a college email: student ID card review, or vouches from verified classmates.

-- ============ Application threads ============
-- The applicant or the team's leader.
CREATE OR REPLACE FUNCTION public.is_application_party(p_application uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.vacancies v ON v.id = a.vacancy_id
    JOIN public.teams t ON t.id = v.team_id
    WHERE a.id = p_application AND (a.applicant_id = auth.uid() OR t.leader_id = auth.uid())
  );
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.is_application_party(uuid) FROM anon;
--> statement-breakpoint

ALTER TABLE public.application_messages ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY application_messages_party_read ON public.application_messages FOR SELECT
  USING (public.is_application_party(application_id));
--> statement-breakpoint
-- Read-only for Realtime; writes go through server actions.
GRANT SELECT ON public.application_messages TO authenticated;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.application_messages;
  END IF;
END $$;
--> statement-breakpoint

-- ============ How a student's campus was verified ============
ALTER TABLE public.profiles ADD CONSTRAINT profiles_verified_via_check
  CHECK (college_verified_via IN ('email', 'id_card', 'vouch', 'admin'));
--> statement-breakpoint
UPDATE public.profiles SET college_verified_via = 'email' WHERE college_verified;
--> statement-breakpoint

-- Server-only tables: RLS on, no policies, no grants.
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.vouches ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- ============ Private bucket for ID cards ============
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('id-cards', 'id-cards', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
-- Students may upload into their own folder only. Nobody can read through the API; reviewers get
-- short-lived signed URLs minted on the server.
CREATE POLICY cs_idcards_own_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'id-cards' AND (storage.foldername(name))[1] = auth.uid()::text);
--> statement-breakpoint

-- Keep college_verified_via consistent wherever college_verified is written (sign-up trigger,
-- email proof, admin approval, seed): verified without a method means the email domain matched.
CREATE OR REPLACE FUNCTION public.profiles_verified_via()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.college_verified THEN
    NEW.college_verified_via := coalesce(NEW.college_verified_via, 'email');
  ELSE
    NEW.college_verified_via := NULL;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER profiles_verified_via BEFORE INSERT OR UPDATE OF college_verified, college_verified_via ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_verified_via();
