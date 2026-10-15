# CampusSquad

Campus-scoped discovery for tech events (hackathons, quizzes, coding contests, workshops, CTFs) and a skill-matched **team vacancy board**: teams post open roles, students apply, leaders accept.

Product context: [`BLUEPRINT.md`](BLUEPRINT.md) · MVP scope: [`BUILD_PROMPT.md`](BUILD_PROMPT.md) · plan & schema: [`PLAN.md`](PLAN.md) · decisions log: [`DECISIONS.md`](DECISIONS.md)

**Stack:** Next.js 16 (App Router, TypeScript strict) · Tailwind + shadcn/ui · Supabase (Postgres, Auth, Realtime, Storage) · Drizzle ORM · Zod · Vitest · Playwright.

## What's in the MVP

| Area | Highlights |
| --- | --- |
| Accounts | Google + magic-link sign-in, onboarding (college, year, branch, skills 1–5, GitHub/LinkedIn, cross-college toggle), college verification by email domain, public profiles at `/u/[username]` |
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

### Supabase dashboard settings

1. **Authentication → URL Configuration:** set Site URL to your app URL and add `http://localhost:3000/auth/callback` (and your production `/auth/callback`) to Redirect URLs.
2. **Google sign-in (optional):** Authentication → Providers → Google, paste a Google Cloud OAuth client ID/secret. Magic links work without this.
3. Realtime is enabled by the migration (it adds `messages`, `notifications`, `applications`, `team_tasks` to the `supabase_realtime` publication).

### Demo login (local only)

With `E2E_TEST_LOGIN=1` in `.env.local`, the login page shows "Demo login" buttons that sign you in as seed users without email (Riya the organizer, Aarav the solo student, Neha/Dev the team leaders…). The route refuses to run in production builds and only accepts `*.seed.test` accounts.

Seed users never receive mail: their addresses end in `.seed.test`.

### Admins

Riya is an admin in the seed data. To make a real account an admin (it must have signed in once):

```bash
npm run make-admin -- you@example.com
```

Add `--revoke` to remove the flag. Admins see an **Admin** item in the account menu.

## Database

- Schema: [`src/db/schema.ts`](src/db/schema.ts) (Drizzle). Generated migration: `drizzle/0000_init.sql`.
- Hand-written migration [`drizzle/0001_integrity_rls.sql`](drizzle/0001_integrity_rls.sql): signup trigger creating `profiles`, integrity triggers, RLS policies, Realtime publication, storage buckets/policies.
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
npm test             # Vitest: match score + eligibility (unit), accept-application transaction (integration)
npm run test:e2e     # Playwright happy path: sign in → find event → apply → leader accepts
```

- Integration tests need `DIRECT_URL` (or `TEST_DATABASE_URL`) pointing at a migrated database. Each test runs in a transaction that is **rolled back**, so it's safe against your dev project. Without a DB URL they're skipped.
- E2E needs a freshly seeded DB (`npm run db:seed -- --reset`); Playwright starts `npm run dev` with `E2E_TEST_LOGIN=1`. First run: `npx playwright install chromium`.

## Deploy (Vercel + Supabase free tiers)

1. Push to GitHub and import the repo in Vercel.
2. Add the env vars above in Vercel (**do not** set `E2E_TEST_LOGIN`). Set `NEXT_PUBLIC_SITE_URL` to the production URL.
3. Run `npm run db:migrate` once against the production database (from your machine with production `DIRECT_URL`).
4. Add `https://<your-domain>/auth/callback` to Supabase Redirect URLs.
5. `vercel.json` schedules `/api/cron/deadline-reminders` daily; Vercel sends `CRON_SECRET` automatically. Reminders are also created lazily when a user loads any page, so hourly precision isn't required.

## Project layout

```
src/app/            routes (feed, events, manage, teams, orgs, profiles, notifications) + server actions in app/actions
src/lib/            auth, feed query, eligibility rules, match score, accept-application transaction, reminders
src/db/             Drizzle schema + client
drizzle/            SQL migrations
scripts/seed.ts     demo data
tests/, e2e/        Vitest and Playwright
```
