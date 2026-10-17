-- Lock down Supabase's auto-generated REST/GraphQL API (PostgREST) for app tables.
--
-- The app never reads or writes app tables through supabase-js: every query runs on the server
-- (as the table owner) behind authorization checks in server actions. The browser only needs
-- SELECT on four tables, for Realtime subscriptions — and RLS still filters those rows.
--
-- Before this migration, the anon key (public, shipped to every browser) could read every
-- profile's email, and signed-in users could update their own is_admin / reliability_score /
-- endorsed_count directly. Revoking table privileges closes that regardless of RLS policies.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
--> statement-breakpoint

-- Realtime (postgres_changes) needs SELECT; RLS policies decide which rows each user receives.
GRANT SELECT ON public.messages, public.notifications, public.applications, public.team_tasks TO authenticated;
--> statement-breakpoint

-- Tables created later stay private unless a migration grants access explicitly.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
--> statement-breakpoint

-- RLS helper functions are only used inside policies; don't expose them as RPC endpoints.
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid), public.is_org_admin(uuid), public.is_event_admin(uuid),
  public.is_vacancy_leader(uuid), public.college_for_email(text) FROM anon;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon, authenticated;
--> statement-breakpoint

-- Defence in depth: even if a grant is added back by mistake, the remaining write policies
-- can't be used to change privileged columns.
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
--> statement-breakpoint
DROP POLICY IF EXISTS user_skills_own ON public.user_skills;
--> statement-breakpoint
DROP POLICY IF EXISTS events_admin_write ON public.events;
--> statement-breakpoint
DROP POLICY IF EXISTS orgs_admin_update ON public.organizations;
--> statement-breakpoint
DROP POLICY IF EXISTS messages_member_insert ON public.messages;
--> statement-breakpoint
DROP POLICY IF EXISTS team_tasks_member ON public.team_tasks;
--> statement-breakpoint
CREATE POLICY team_tasks_member_read ON public.team_tasks FOR SELECT USING (public.is_team_member(team_id));
--> statement-breakpoint
DROP POLICY IF EXISTS notifications_own_update ON public.notifications;
