# CampusSquad MVP — Plan & Final Schema

Source of truth: `BUILD_PROMPT.md` (scope) > `BLUEPRINT.md` (product). Decisions get logged in `DECISIONS.md`.

## Architecture in one paragraph

Next.js (App Router, TS strict) on Vercel. Server Components read via **Drizzle** over a direct Postgres
connection; all writes go through **Server Actions** (Zod-validated, authorization checked in code).
**Supabase Auth** (Google + magic link) via `@supabase/ssr` cookies. The browser uses `supabase-js` only for
**Realtime** subscriptions (notifications, applications, team chat) and Storage uploads — those paths are
protected by **RLS**. RLS is also enabled on every table as defense-in-depth. Integrity rules live in the
database as constraints + triggers, so they hold no matter which path writes.

## Milestones (one commit each, app runnable after each)

1. Scaffold: Next.js, Tailwind, shadcn/ui, Drizzle, Supabase clients, schema + migrations (incl. SQL triggers & RLS), seed script.
2. Auth (Google + magic link), onboarding, profiles `/u/[username]`, college verification by email domain.
3. Organizations (`/orgs/[slug]`, owner/admin, follow), event create/edit/publish, event page with OG tags + poster upload.
4. Feed (My campus / Nearby / All India), filters, full-text search, closing-soon strip, save + Google Calendar link, registration rules.
5. Teams, vacancies, applications, `matchScore()` pure fn, transactional accept, availability posts, invites.
6. Realtime: notification bell, live applications/status, team workspace chat + checklist.
7. Organizer dashboard: funnel counts, share links `/s/[code]` + click tracking, QR PNG, CSV export, announcements, check-in (camera QR + search).
8. Endorsements, empty/loading states, mobile pass, tests (Vitest + one Playwright happy path), README.

## Final schema (Drizzle, Postgres)

Conventions: `uuid` PKs (`gen_random_uuid()`), `created_at timestamptz default now()`, enums as Postgres enums.

| Table | Columns | Constraints / notes |
|---|---|---|
| **colleges** | id, name, city, state, email_domain (unique, nullable), verified bool, created_at | "Request new college" inserts `verified=false` |
| **profiles** | id (= `auth.users.id`), username (unique), name, email, avatar_url, college_id → colleges, college_verified bool, year smallint, branch, bio, github_url, linkedin_url, open_to_cross_college bool, reliability_score numeric default 100, is_admin bool, onboarded_at, created_at | Blueprint's `users`; trigger creates row on auth signup |
| **skills** | id, name (unique), category enum(frontend, backend, mobile, ml, data, design, devops, security, web3, iot, other) | seeded list |
| **user_skills** | user_id, skill_id, level 1–5, evidence_url, endorsed_count int | PK(user_id, skill_id); CHECK level 1–5 |
| **organizations** | id, slug (unique), name, type enum(club, department, community, company), college_id (nullable), description, logo_url, verified bool, created_by, created_at | creator must be college-verified (checked in action + RLS) |
| **org_members** | org_id, user_id, role enum(owner, admin, volunteer) | PK(org_id, user_id) |
| **org_followers** | org_id, user_id, created_at | PK(org_id, user_id) |
| **events** | id, org_id, title, description, type enum(hackathon, quiz, coding_contest, workshop, ideathon, ctf), domain_tags text[], mode enum(offline, online, hybrid), venue, city, starts_at, ends_at, reg_deadline, team_min, team_max, eligibility_scope enum(college, city, india), allow_cross_college bool, fee_text, is_free bool, prize_text, rules_md, poster_url, external_url, beginner_friendly bool, status enum(draft, published, closed), view_count int, search tsvector (generated), created_at, updated_at | CHECK 1 ≤ team_min ≤ team_max; CHECK reg_deadline ≤ starts_at ≤ ends_at; GIN index on `search` |
| **saved_events** | user_id, event_id, created_at | PK(user_id, event_id); drives "closing in 24 h" notifications |
| **registrations** | id, event_id, user_id, team_id (nullable), form_answers jsonb, share_link_id (nullable), status enum(registered, waitlisted, checked_in, no_show, cancelled), checkin_code (unique), checked_in_at, created_at | UNIQUE(event_id, user_id) |
| **teams** | id, event_id, name, leader_id, idea_pitch, is_open bool, created_at | UNIQUE(event_id, name) |
| **team_members** | team_id, user_id, **event_id** (denormalized), role_title, joined_at | PK(team_id, user_id); **UNIQUE(event_id, user_id) → one team per user per event**; trigger: count ≤ team_max; trigger: if `!allow_cross_college`, member college = leader college |
| **vacancies** | id, team_id, role_title, description, commitment_hours, slots_total, slots_open, scope enum(intra, cross), screening_question, status enum(open, filled, closed), created_at | CHECK 0 ≤ slots_open ≤ slots_total; `scope=cross` rejected if event disallows cross-college |
| **vacancy_skills** | vacancy_id, skill_id, required bool | PK(vacancy_id, skill_id) |
| **applications** | id, vacancy_id, applicant_id, message, screening_answer, match_score int, status enum(pending, shortlisted, accepted, rejected, withdrawn), created_at, decided_at | **UNIQUE(vacancy_id, applicant_id)** |
| **availability_posts** | id, event_id, user_id, roles_wanted text[], skill_ids uuid[], note, scope enum(intra, cross), hours_per_week, status enum(open, closed), created_at | UNIQUE(event_id, user_id) |
| **invites** | id, team_id, user_id, invited_by, message, status enum(pending, accepted, declined, cancelled), created_at | partial UNIQUE(team_id, user_id) WHERE pending |
| **messages** | id, team_id, sender_id, body, created_at | team chat only for MVP (DMs = later; `channel_type` dropped, see DECISIONS) |
| **team_tasks** | id, team_id, title, done bool, created_by, created_at | shared checklist |
| **endorsements** | id, event_id, team_id, from_user, to_user, skill_id, note, created_at | UNIQUE(event_id, from_user, to_user, skill_id); CHECK from≠to; trigger: both in `team_id`, team belongs to event, event has ended; bumps `user_skills.endorsed_count` |
| **notifications** | id, user_id, type enum(application_new, application_accepted, application_rejected, vacancy_closed, team_invite, invite_response, announcement, event_closing), payload jsonb, read_at, created_at | Realtime-subscribed per user |
| **announcements** | id, event_id, author_id, body, created_at | fan-out → notifications |
| **share_links** | id, event_id, channel_label, short_code (unique), clicks int, created_at | `/s/[code]` |
| **share_link_clicks** | id, share_link_id, clicked_at, user_agent_hash | raw clicks for funnel |

### Where each integrity rule lives
- **One team per user per event** — `UNIQUE(team_members.event_id, user_id)`.
- **Team size** — `team_max`: BEFORE INSERT trigger on `team_members` (row-locks the team). `team_min`: a team below min can exist while forming; registration of an under-sized team shows "incomplete" and organizer check-in flags it (DB can't enforce a minimum on a growing set without blocking creation).
- **Cross-college** — trigger on `team_members` + CHECK in vacancy insert/apply paths.
- **One application per vacancy** — `UNIQUE(vacancy_id, applicant_id)`.
- **Endorsements same team** — trigger on `endorsements`.
- **Accept application** — single `db.transaction()`: lock vacancy `FOR UPDATE` → verify applicant not on a team → insert `team_members` → upsert registration with `team_id` → decrement `slots_open` → if 0, set `filled` + reject other pendings → notifications. Covered by an integration test.

### RLS summary
- `profiles`, `user_skills`: public read; write own row only.
- `events`, `organizations`: public read of published; write only by `org_members` (owner/admin).
- `messages`, `team_tasks`: read/write only by team members.
- `notifications`: read/update own only.
- `applications`: read by applicant or the vacancy's team leader.
- Everything else: read per above, writes via server (service connection).

### Match score (pure function, `lib/match-score.ts`)
`score = 80 × (required skills held / required count)` (or 80 if none required)
`+ 15 × (nice-to-haves held / nice count)` + `5` if same college. Level ≥ 2 counts as "held". Clamped 0–100.

## Testing
- Vitest unit: `matchScore`.
- Vitest integration: accept-application transaction (runs against `DATABASE_URL_TEST`).
- Playwright happy path using a **dev-only** sign-in route (`/api/test-login`, enabled only when `E2E_TEST_LOGIN=1`) because magic links/Google can't be automated.
