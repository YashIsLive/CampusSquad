-- Hand-written migration: integrity rules, auth hook, RLS, realtime, storage.
-- Errors raised here use the prefix "CS:" so the app can map them to friendly messages (src/lib/errors.ts).

-- ============ profiles ↔ auth.users ============
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_auth_users_fk FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
--> statement-breakpoint

-- Match an email domain to a college: exact match or a subdomain (e.g. students.coep.ac.in → coep.ac.in).
CREATE OR REPLACE FUNCTION public.college_for_email(p_email text)
RETURNS uuid LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT c.id FROM public.colleges c
  WHERE c.email_domain IS NOT NULL
    AND (lower(split_part(p_email, '@', 2)) = c.email_domain
         OR lower(split_part(p_email, '@', 2)) LIKE '%.' || c.email_domain)
  ORDER BY length(c.email_domain) DESC
  LIMIT 1;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base text;
  candidate text;
  n int := 0;
  v_college uuid;
BEGIN
  base := regexp_replace(lower(split_part(NEW.email, '@', 1)), '[^a-z0-9_]', '', 'g');
  IF length(base) < 3 THEN base := 'user' || base; END IF;
  candidate := left(base, 24);
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    n := n + 1;
    candidate := left(base, 20) || n::text;
  END LOOP;

  v_college := public.college_for_email(NEW.email);

  INSERT INTO public.profiles (id, username, name, email, avatar_url, college_id, college_verified)
  VALUES (
    NEW.id,
    candidate,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    v_college,
    v_college IS NOT NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--> statement-breakpoint
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
--> statement-breakpoint

-- ============ team_members: one-team-per-event, team_max, cross-college ============
CREATE OR REPLACE FUNCTION public.team_members_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  t record;
  member_count int;
  leader_college uuid;
  member_college uuid;
BEGIN
  -- Lock the team row so concurrent joins are serialized.
  SELECT tm.id, tm.event_id, tm.leader_id, e.team_max, e.allow_cross_college
    INTO t
    FROM public.teams tm JOIN public.events e ON e.id = tm.event_id
   WHERE tm.id = NEW.team_id
   FOR UPDATE OF tm;

  IF NOT FOUND THEN RAISE EXCEPTION 'CS:TEAM_NOT_FOUND'; END IF;

  NEW.event_id := t.event_id;

  SELECT count(*) INTO member_count FROM public.team_members WHERE team_id = NEW.team_id;
  IF member_count >= t.team_max THEN
    RAISE EXCEPTION 'CS:TEAM_FULL';
  END IF;

  IF NOT t.allow_cross_college AND NEW.user_id <> t.leader_id THEN
    SELECT college_id INTO leader_college FROM public.profiles WHERE id = t.leader_id;
    SELECT college_id INTO member_college FROM public.profiles WHERE id = NEW.user_id;
    IF leader_college IS NULL OR member_college IS DISTINCT FROM leader_college THEN
      RAISE EXCEPTION 'CS:CROSS_COLLEGE_NOT_ALLOWED';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER team_members_guard
  BEFORE INSERT ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.team_members_guard();
--> statement-breakpoint

-- ============ vacancies: cross scope only if the event allows it ============
CREATE OR REPLACE FUNCTION public.vacancies_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  allow_cross boolean;
BEGIN
  IF NEW.scope = 'cross' THEN
    SELECT e.allow_cross_college INTO allow_cross
      FROM public.teams t JOIN public.events e ON e.id = t.event_id
     WHERE t.id = NEW.team_id;
    IF NOT allow_cross THEN RAISE EXCEPTION 'CS:CROSS_COLLEGE_NOT_ALLOWED'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER vacancies_guard
  BEFORE INSERT OR UPDATE OF scope ON public.vacancies
  FOR EACH ROW EXECUTE FUNCTION public.vacancies_guard();
--> statement-breakpoint

-- ============ endorsements: same team, team belongs to event, event over ============
CREATE OR REPLACE FUNCTION public.endorsements_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  ev_end timestamptz;
BEGIN
  SELECT e.ends_at INTO ev_end
    FROM public.teams t JOIN public.events e ON e.id = t.event_id
   WHERE t.id = NEW.team_id AND t.event_id = NEW.event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CS:ENDORSE_TEAM_MISMATCH'; END IF;
  IF ev_end > now() THEN RAISE EXCEPTION 'CS:ENDORSE_TOO_EARLY'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = NEW.team_id AND user_id = NEW.from_user)
     OR NOT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = NEW.team_id AND user_id = NEW.to_user) THEN
    RAISE EXCEPTION 'CS:ENDORSE_NOT_TEAMMATES';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER endorsements_guard
  BEFORE INSERT ON public.endorsements
  FOR EACH ROW EXECUTE FUNCTION public.endorsements_guard();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.endorsements_count()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_skills (user_id, skill_id, level, endorsed_count)
  VALUES (NEW.to_user, NEW.skill_id, 1, 1)
  ON CONFLICT (user_id, skill_id) DO UPDATE SET endorsed_count = public.user_skills.endorsed_count + 1;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER endorsements_count
  AFTER INSERT ON public.endorsements
  FOR EACH ROW EXECUTE FUNCTION public.endorsements_count();
--> statement-breakpoint

-- ============ RLS helpers (security definer so policies don't recurse) ============
CREATE OR REPLACE FUNCTION public.is_team_member(p_team uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = p_team AND user_id = auth.uid());
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.is_org_admin(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members
                 WHERE org_id = p_org AND user_id = auth.uid() AND role IN ('owner', 'admin'));
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.is_event_admin(p_event uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.events e
                 JOIN public.org_members m ON m.org_id = e.org_id
                 WHERE e.id = p_event AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin'));
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.is_vacancy_leader(p_vacancy uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.vacancies v JOIN public.teams t ON t.id = v.team_id
                 WHERE v.id = p_vacancy AND t.leader_id = auth.uid());
$$;
--> statement-breakpoint

-- ============ RLS ============
-- The Next.js server connects as the table owner (bypasses RLS) and enforces authorization in code.
-- These policies govern everything that goes through Supabase's APIs: Realtime, Storage and supabase-js.
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.org_followers ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.saved_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.share_link_clicks ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.vacancies ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.vacancy_skills ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.availability_posts ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.team_tasks ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.endorsements ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Public directory data
CREATE POLICY colleges_read ON public.colleges FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY skills_read ON public.skills FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY profiles_read ON public.profiles FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());--> statement-breakpoint
CREATE POLICY user_skills_read ON public.user_skills FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY user_skills_own ON public.user_skills FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());--> statement-breakpoint

-- Organizations & events
CREATE POLICY orgs_read ON public.organizations FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY orgs_admin_update ON public.organizations FOR UPDATE
  USING (public.is_org_admin(id)) WITH CHECK (public.is_org_admin(id));--> statement-breakpoint
CREATE POLICY org_members_read ON public.org_members FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY org_followers_read ON public.org_followers FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY org_followers_own ON public.org_followers FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());--> statement-breakpoint
CREATE POLICY events_read ON public.events FOR SELECT
  USING (status <> 'draft' OR public.is_org_admin(org_id));--> statement-breakpoint
CREATE POLICY events_admin_write ON public.events FOR ALL
  USING (public.is_org_admin(org_id)) WITH CHECK (public.is_org_admin(org_id));--> statement-breakpoint
CREATE POLICY saved_events_own ON public.saved_events FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());--> statement-breakpoint
CREATE POLICY share_links_admin ON public.share_links FOR ALL
  USING (public.is_event_admin(event_id)) WITH CHECK (public.is_event_admin(event_id));--> statement-breakpoint
CREATE POLICY share_link_clicks_admin ON public.share_link_clicks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.share_links s WHERE s.id = share_link_id AND public.is_event_admin(s.event_id)));--> statement-breakpoint
CREATE POLICY registrations_read ON public.registrations FOR SELECT
  USING (user_id = auth.uid() OR public.is_event_admin(event_id));--> statement-breakpoint
CREATE POLICY announcements_read ON public.announcements FOR SELECT USING (true);--> statement-breakpoint

-- Teams (public listings; private workspace)
CREATE POLICY teams_read ON public.teams FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY team_members_read ON public.team_members FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY vacancies_read ON public.vacancies FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY vacancy_skills_read ON public.vacancy_skills FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY applications_read ON public.applications FOR SELECT
  USING (applicant_id = auth.uid() OR public.is_vacancy_leader(vacancy_id));--> statement-breakpoint
CREATE POLICY availability_read ON public.availability_posts FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY availability_own ON public.availability_posts FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());--> statement-breakpoint
CREATE POLICY invites_read ON public.invites FOR SELECT
  USING (user_id = auth.uid() OR public.is_team_member(team_id));--> statement-breakpoint
CREATE POLICY messages_member_read ON public.messages FOR SELECT
  USING (public.is_team_member(team_id));--> statement-breakpoint
CREATE POLICY messages_member_insert ON public.messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND public.is_team_member(team_id));--> statement-breakpoint
CREATE POLICY team_tasks_member ON public.team_tasks FOR ALL
  USING (public.is_team_member(team_id)) WITH CHECK (public.is_team_member(team_id));--> statement-breakpoint
CREATE POLICY endorsements_read ON public.endorsements FOR SELECT USING (true);--> statement-breakpoint

-- Notifications
CREATE POLICY notifications_own_read ON public.notifications FOR SELECT USING (user_id = auth.uid());--> statement-breakpoint
CREATE POLICY notifications_own_update ON public.notifications FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());--> statement-breakpoint

-- ============ Realtime ============
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages, public.notifications, public.applications, public.team_tasks;
  END IF;
END $$;
--> statement-breakpoint

-- ============ Storage (public-read buckets; users write only under their own uid folder) ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('posters', 'posters', true), ('avatars', 'avatars', true), ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
CREATE POLICY cs_storage_public_read ON storage.objects FOR SELECT
  USING (bucket_id IN ('posters', 'avatars', 'logos'));--> statement-breakpoint
CREATE POLICY cs_storage_own_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('posters', 'avatars', 'logos') AND (storage.foldername(name))[1] = auth.uid()::text);--> statement-breakpoint
CREATE POLICY cs_storage_own_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('posters', 'avatars', 'logos') AND (storage.foldername(name))[1] = auth.uid()::text);--> statement-breakpoint
CREATE POLICY cs_storage_own_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('posters', 'avatars', 'logos') AND (storage.foldername(name))[1] = auth.uid()::text);
