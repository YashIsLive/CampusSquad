# Decisions

Ambiguities resolved during the build, newest last. Format: what was decided, and why.

**D-001 — Hosted Supabase, no local stack.** Docker isn't available on the dev machine, so development targets a free hosted Supabase project.

**D-002 — Next.js Cache Components turned off.** Next 16 enables `cacheComponents` by default. Nearly every page here is per-user (auth cookies, personalised feed), so the classic dynamic rendering model is simpler; mutations call `revalidatePath`.

**D-003 — Server reads/writes via Drizzle; RLS guards Supabase APIs.** The Next.js server connects as the table owner and enforces authorization in each server action (Zod + explicit checks). RLS is enabled on every table and governs anything that goes through Supabase's APIs from the browser: Realtime subscriptions, Storage uploads. This keeps transactional logic (accept application) in one place in TypeScript.

**D-004 — `profiles` instead of `users`.** Supabase owns `auth.users`; the app's user table is `profiles` with `id = auth.users.id`, created by a trigger on signup.

**D-005 — `team_min` is not a hard DB constraint.** A team must exist before it has members, so a minimum can't be enforced on insert. Teams below `team_min` show as "incomplete" to members and on the organizer's dashboard. `team_max` is enforced by a trigger that row-locks the team.

**D-006 — `team_members.event_id` is denormalized** (filled by trigger) so a single unique index enforces "one team per user per event".

**D-007 — Event `city` and `college_id` are copied from the organizing org's college** at creation. "My campus" = same college, "Nearby" = same city (PostGIS is out of scope).

**D-008 — Eligibility scope.** `college`: only verified students of the host college may register. `city`: students whose college is in the event's city. `india`: anyone. Users without a college can register only for `india` events.

**D-009 — Seed users use `*.seed.test` emails** so no real inbox can receive mail for them. A dev-only "demo login" route (enabled by `E2E_TEST_LOGIN=1`) signs in as a seed user for demos and Playwright. A 4th college (VJTI, Mumbai) is seeded so "Nearby" vs "All India" is demoable.

**D-010 — College verification = email domain match** (exact or subdomain, e.g. `students.coeptech.ac.in` matches `coeptech.ac.in`). Picking a college whose domain doesn't match leaves the user unverified. Creating an organization requires being verified.

**D-011 — Team chat only.** The blueprint's `messages.channel_type` (team/direct) is narrowed to team chat; "message applicant" from leader review opens an invite-style note via notification for MVP. DMs can be added by introducing a `channel_type` column later.

**D-012 — Followers are notified once per event.** `events.published_at` is stamped by a conditional update the first time an event goes live; only that update sends follower notifications, so unpublish → republish (or editing a live event) never re-notifies.

**D-013 — Reminders run lazily and from cron.** Vercel's free cron is daily, too coarse for a 2-hour reminder. Each signed-in page load also runs that user's due reminders after the response. Rows are claimed atomically (an INSERT into `reminder_log`, or a conditional UPDATE on `saved_events`) so concurrent runs can't double-send. A tighter reminder also marks the looser ones as sent: registering 10 h before the start gives one "tomorrow" reminder, not two.

**D-014 — Reliability score is Laplace-smoothed.** `100 × (attended + 1) / (attended + no-shows + 1)`, recomputed when an organizer finalizes attendance. Newcomers start at 100 and one no-show doesn't zero anyone. Finalizing requires at least one check-in, so an event that didn't use check-in can't mark everyone absent.

**D-015 — Teammate suggestions are rule-based.** They reuse `matchScore` against each open role, apply the same cross-college rules as applications, require ≥ 40 % fit, and break ties in favour of people who posted a "looking for a team" card. The `suggestTeammates` interface can later sit on top of embeddings without changing callers.

**D-016 — Requested colleges need an admin.** Admins set the verified email domain on `/admin`, which also verifies existing students whose emails match. A rejected request unlinks its students, who then pick another college.

**D-017 — Auth links are verified by the app (`/auth/confirm`).** Supabase's default links use PKCE, which only works in the browser that requested the email; students often open mail on another device or in an in-app browser. `/auth/confirm` accepts `token_hash` (any device), PKCE `code`, and `#fragment` tokens (via `/auth/finish`), and the sign-in page accepts the 6-digit code as a fallback. The email templates in docs/AUTH_SETUP.md make the cross-device path the default.

**D-018 — Passwords are optional.** The email link stays the default (it proves the college address). Password sign-up/sign-in and reset exist for students whose mail apps mangle links; Supabase still confirms the email before the first session.

**D-019 — The browser has no table access except Realtime reads.** All reads and writes run in server code; `0005_api_lockdown.sql` revokes the grants Supabase adds by default. This closed real holes (every email readable with the public key, users able to make themselves admin). New tables are private by default.

**D-020 — No `loading.tsx` on routes that can 404.** A route-level Suspense boundary makes Next stream a 200 before the page calls `notFound()`. Detail pages render directly; a top progress bar gives navigation feedback instead.

**D-021 — Guide = checklist from real data + per-page tours.** Checklist items tick off from database state, not clicks, so they're accurate wherever the user did the thing. Tours are non-blocking, skip steps whose targets aren't on screen, auto-run once per page type (stored in `profiles.guide`, with a per-session guard against restarts on remount), and can be deep-linked from checklist items.

