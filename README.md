# CampusSquad

Campus-scoped discovery for tech events (hackathons, quizzes, coding contests, workshops, CTFs) and a skill-matched **team vacancy board**: teams post open roles, students apply, leaders accept.

Product context: [`BLUEPRINT.md`](BLUEPRINT.md) · MVP scope: [`BUILD_PROMPT.md`](BUILD_PROMPT.md) · plan & schema: [`PLAN.md`](PLAN.md) · decisions log: [`DECISIONS.md`](DECISIONS.md)

**Stack:** Next.js 16 (App Router, TypeScript strict) · Tailwind + shadcn/ui · Supabase (Postgres, Auth, Realtime, Storage) · Drizzle ORM · Zod · Vitest · Playwright.

## What's in the MVP

| Area | Highlights |
| --- | --- |
| Accounts | Email link **or 6-digit code**, password sign-up/sign-in with reset, Google (when enabled); new accounts go straight to onboarding (college, year, branch, skills 1–5, GitHub/LinkedIn, cross-college toggle), college verification by email domain, public profiles at `/u/[username]` |
| Organizations | Verified students create clubs; owner adds admins by email; follow button |
| Events (host) | Create/edit/publish/unpublish/close registrations, poster upload, rules in Markdown, external (Unstop/Devfolio) link, **share kit** (tracked short links per channel, QR PNG, WhatsApp caption), **dashboard** (views → registrations → teams → check-ins, by channel and by college), CSV export, announcements, **QR check-in** with the phone camera |
| Events (student) | Feed with **My campus · Nearby · All India**, filters, search, "closing in 48 h" strip, save + Google Calendar, register solo or with a team, WhatsApp-friendly OG previews |
| Team formation | Team board per event: open roles + "looking for a team" cards, filters (skill, my college/other colleges, college, hours), rule-based **match score**, apply with screening question, leader review (shortlist / accept / reject / message), **transactional accept**, invites |
| Realtime | Notification bell, live applications for leaders, live status for applicants, team chat and checklist |
| Endorsements | After an event ends, teammates endorse each other's skills; counts appear on profiles |
| Organizer extras | Followers notified when an event first goes live, one-click "nudge solo registrants", automatic reminders 72 h / 24 h / 2 h before the start, finalize attendance (no-shows feed a **reliability score**) |
| Matching extras | **Suggested teammates** for leaders (solo registrants and "looking" cards ranked against open roles), skill suggestions from a student's public GitHub repos, avatar upload |
| Admin | `/admin` for platform admins: approve student-requested colleges (sets the email domain and verifies matching students), toggle org verified badges |
| Installable | PWA manifest + generated icons, so it can be added to a phone's home screen |
| First-run guide | **Getting-started checklist** driven by real activity (student and organizer tracks), **spotlight tours** of the feed, event, team and organizer pages (auto on first visit, replay from the **?** menu, deep-linkable with `?tour=&step=`) |

## Setup

Prerequisites: Node 20+ and a free [Supabase](https://supabase.com) project.

```bash
npm install
cp .env.example .env.local   # then fill it in (see below)
npm run db:migrate           # creates tables, triggers, RLS policies, storage buckets
npm run db:seed              # demo data: 4 colleges, 30 users, 3 clubs, 8 events, teams, applications
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable | Where to find it | Used for |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Auth, Realtime, Storage |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same | browser + server Supabase clients |
| `SUPABASE_SERVICE_ROLE_KEY` | same (secret) | seed script, dev demo login — **server only** |
| `DATABASE_URL` | Project Settings → Database → Connection string → **Transaction pooler** (port 6543) | app runtime queries |
| `DIRECT_URL` | same → **Session pooler** (port 5432) | migrations, seed, integration tests |
| `NEXT_PUBLIC_SITE_URL` | your URL (`http://localhost:3000` locally) | share links, OG/canonical URLs |
| `RESEND_API_KEY`, `EMAIL_FROM` | optional, [resend.com](https://resend.com) | emails for announcements/reminders (no-op if unset) |
| `CRON_SECRET` | any random string | protects `/api/cron/deadline-reminders` |
| `GITHUB_TOKEN` | optional, any GitHub token with no scopes | raises the GitHub API limit for "Suggest from my GitHub" (60 → 5,000 requests/hour) |
| `E2E_TEST_LOGIN` | set to `1` **only locally** | enables the demo login (see below) |

### Supabase dashboard settings — needed for real sign-ups

**Follow [`docs/AUTH_SETUP.md`](docs/AUTH_SETUP.md).** In short:

1. **Custom SMTP** (Project Settings → Authentication → SMTP). Without it Supabase only emails your own team, so nobody else can sign up.
2. **Email templates** that link to `/auth/confirm?token_hash=…` and include the 6-digit `{{ .Token }}` — links then work on any device.
3. **URL Configuration:** Site URL = your app URL; Redirect URLs include `https://<your-site>/auth/confirm` and `http://localhost:3000/auth/confirm`.
4. **Google sign-in (optional):** Authentication → Providers → Google. The button appears automatically once enabled.

Realtime is enabled by the migrations (`messages`, `notifications`, `applications`, `team_tasks` are in the `supabase_realtime` publication).

### Demo login (local only)

With `E2E_TEST_LOGIN=1` in `.env.local`, the login page shows a "Demo cast" list that sign you in as seed users without email (Riya the organizer, Aarav the solo student, Neha/Dev the team leaders…). The route refuses to run in production builds and only accepts `*.seed.test` accounts.

Seed users never receive mail: their addresses end in `.seed.test`. They share a local demo password (`SEED_PASSWORD` in `scripts/seed.ts`, overridable via env) so you can try password sign-in. Seed accounts count as existing users, so page tours don't auto-start for them — use **? → Replay all tours**, or sign up a new account to see the first-run experience.

### Admins

Riya is an admin in the seed data. To make a real account an admin (it must have signed in once):

```bash
npm run make-admin -- you@example.com
```

Add `--revoke` to remove the flag. Admins see an **Admin** item in the account menu.

## Database

- Schema: [`src/db/schema.ts`](src/db/schema.ts) (Drizzle). Generated migration: `drizzle/0000_init.sql`.
- Hand-written migration [`drizzle/0001_integrity_rls.sql`](drizzle/0001_integrity_rls.sql): signup trigger creating `profiles`, integrity triggers, RLS policies, Realtime publication, storage buckets/policies.
- [`drizzle/0005_api_lockdown.sql`](drizzle/0005_api_lockdown.sql): revokes Supabase REST/GraphQL access to app tables (the app reads and writes only on the server); the browser keeps `SELECT` on the four Realtime tables, filtered by RLS.
- After changing the schema: `npm run db:generate` then `npm run db:migrate`.
- Reseed from scratch: `npm run db:seed -- --reset` (deletes seed users and all app data; real users keep their accounts and profiles).

Integrity rules enforced **in the database**:

| Rule | How |
| --- | --- |
| One team per user per event | unique index on `team_members(event_id, user_id)` |
| Team size ≤ `team_max` | `team_members_guard` trigger (row-locks the team) |
| Cross-college only if the event allows it | `team_members_guard` + `vacancies_guard` triggers |
| One application per user per vacancy | unique index on `applications(vacancy_id, applicant_id)` |
| Endorsements only between teammates, after the event | `endorsements_guard` trigger + unique index |

`team_min` is shown as "incomplete" rather than enforced (see DECISIONS.md D-005).

## Tests

```bash
npm test             # Vitest: 43 unit + integration tests
npm run test:e2e     # Playwright: 21 end-to-end tests (reseeds the database first)
```

| Suite | Covers |
| --- | --- |
| `tests/*.test.ts` | match score, eligibility, reminders, reliability, GitHub mapping, teammate ranking, feed grouping; **accept-application transaction + DB integrity rules** (rolled back); **API lockdown** (an attacker with the anon key can't read emails, make themselves admin or tamper with data) |
| `e2e/auth.spec.ts` | protected-page redirect and return, wrong password, password rules, forgot password, new account → onboarding → destination, expired links |
| `e2e/student.spec.ts` | feed scopes, type filter, `/` shortcut, save → My events, register → ticket → cancel, start a team, post a role |
| `e2e/happy-path.spec.ts` | apply to a role → leader accepts → applicant sees it |
| `e2e/teams-realtime.spec.ts` | **live** chat and checklist between two browsers; invite → accept → join |
| `e2e/organizer.spec.ts` | post an event → followers notified; tracked-link click counting; CSV export; announcement delivery; check-in by code; admin verifies a college; non-admins get 404 |
| `e2e/guide.spec.ts` | new student: checklist progress, automatic tour, Escape, no repeat, replay from the ? menu, hide |
| `e2e/a11y-and-mobile.mobile.spec.ts` | phone layout (bottom nav, filter sheet, sticky register bar); **axe WCAG 2.1 AA** on public and signed-in pages |

- Integration tests need `DIRECT_URL` (or `TEST_DATABASE_URL`) and the Supabase keys; without them they're skipped (CI still runs the unit tests).
- E2E reseeds with `npm run db:seed -- --reset` in its global setup (`E2E_RESEED=0` skips it); Playwright starts `npm run dev` with `E2E_TEST_LOGIN=1`. First run: `npx playwright install chromium`. `npx playwright show-report` opens the last report.

## Deploy (Vercel + Supabase free tiers)

1. Push to GitHub and import the repo in Vercel. CI (`.github/workflows/ci.yml`) typechecks, lints, tests, builds and audits every push.
2. Add the env vars above in Vercel. **Do not** set `E2E_TEST_LOGIN`. `NEXT_PUBLIC_SITE_URL` must be the https production URL. Set `CRON_SECRET`.
   The build refuses to start with missing or unsafe production settings (see `src/env.ts`).
3. Run `npm run db:migrate` once against the production database (from your machine with the production `DIRECT_URL`). **Never** seed production — the seed script refuses unless forced.
4. Do the Supabase steps in [`docs/AUTH_SETUP.md`](docs/AUTH_SETUP.md) with your production URL.
5. Make yourself admin: sign up, then run `npm run make-admin -- you@college.edu` with the production env.
6. Point an uptime monitor at `/api/health` (200 when the database is reachable, 503 otherwise).
7. `vercel.json` schedules `/api/cron/deadline-reminders` daily; Vercel sends `CRON_SECRET` automatically. Reminders also run per user on page load, so 2-hour reminders reach active users on time.

### Production checklist

- [x] Security headers + CSP (`next.config.ts`), HSTS, no framing
- [x] Supabase REST API locked down; RLS on every table; storage writes limited to the owner's folder
- [x] Server actions validate input (Zod) and check authorization; per-user rate limits (`src/lib/rate-limit.ts`)
- [x] Auth links work across devices; open redirects blocked; email-link base URL never taken from request headers
- [x] Real 404s for missing pages; `robots.txt`, `sitemap.xml`; share images for every event
- [x] WCAG 2.1 AA checks in the E2E suite; reduced motion respected
- [ ] Custom SMTP + email templates in Supabase (dashboard — see `docs/AUTH_SETUP.md`)
- [ ] Error tracking (e.g. Sentry) — not included; errors go to Vercel logs

## Project layout

```
src/app/            routes (feed, events, manage, teams, orgs, profiles, notifications) + server actions in app/actions
src/lib/            auth, feed query, eligibility rules, match score, accept-application transaction, reminders
src/db/             Drizzle schema + client
drizzle/            SQL migrations
scripts/seed.ts     demo data
tests/, e2e/        Vitest and Playwright
```
