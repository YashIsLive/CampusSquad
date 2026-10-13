# Build Prompt — CampusSquad MVP

> Paste this into Claude Code along with the blueprint document (exported as `BLUEPRINT.md` in the repo root).

---

## Your role and goal

You are a senior full-stack engineer. Build a working **MVP** of **CampusSquad**: a web platform where college clubs post tech events (hackathons, quizzes, coding contests, workshops), students discover and register for them, and students form teams through a **vacancy board** (teams post open roles, individuals apply).

Read `BLUEPRINT.md` first. It is the product source of truth for the problem, personas, features and schema. This prompt narrows it to what to build **now**. Where they differ, this prompt wins. Anything the blueprint lists that is not in scope below is **out of scope** — leave a clean place for it, do not build it.

The goal is a demo-able product one campus could start using, not a finished platform. Prefer working end-to-end flows over polish.

---

## Tech stack (decided — do not substitute without asking)

- **Framework:** Next.js (latest stable, App Router) + TypeScript (strict)
- **UI:** Tailwind CSS + shadcn/ui, mobile-first (most users are on phones)
- **Backend:** Next.js Server Actions and Route Handlers (no separate API service yet)
- **Database:** PostgreSQL on Supabase, schema and migrations with **Drizzle ORM**
- **Auth:** Supabase Auth — Google sign-in + email magic link
- **Realtime:** Supabase Realtime (team chat, new-application and status-change updates)
- **Storage:** Supabase Storage (event posters, avatars)
- **Validation:** Zod on every form and server action
- **Deploy target:** Vercel + Supabase free tiers

Use environment variables for all keys; provide `.env.example`.

---

## MVP scope

### 1. Accounts & profiles
- Sign in with Google or magic link.
- Onboarding: name, college (pick from `colleges` table or request a new one), year, branch, skills (tag picker with level 1–5), GitHub URL, LinkedIn URL, bio, "open to cross-college teams" toggle.
- **College verification:** if the user's email domain matches `colleges.email_domain`, mark them verified for that college. Otherwise unverified (still usable, shown with no badge).
- Public profile page: skills, links, events joined, teams joined.

### 2. Organizations (clubs / departments / communities)
- Any verified student can create an organization tied to their college; creator is `owner`, can add `admin` members by email.
- Organization page with logo, description, follow button, and its events.

### 3. Event portal — host side
- Create/edit event form: title, type, domain tags, mode (offline/online/hybrid), venue, start/end, registration deadline, team size min–max, eligibility scope (`college` / `city` / `india`), allow cross-college teams (bool), fee text, prizes text, rules (markdown), poster upload, optional `external_url` (for events whose official registration is on Unstop/Devfolio).
- Publish / unpublish / close registrations.
- **Share kit** on the event page for organizers: copy-able short link per channel label (e.g. "CSE-2nd-yr WhatsApp", "Notice board QR"), downloadable QR code PNG, and a pre-written WhatsApp caption. Track clicks per link in `share_links`.
- **Organizer dashboard** per event: counts for views, registrations, teams formed, solo registrants; registrations broken down by share link and by college; registrant table with CSV export; announcement composer (posts an in-app notification to all registrants).
- **Check-in:** each registration has a QR code; organizer page to scan (use the device camera) or search by name and mark `checked_in`.

### 4. Event portal — student side
- Home feed with three tabs: **My campus · Nearby (same city) · All India**. Default: My campus.
- Filters: type, domain, mode, free/paid, deadline within N days, team size, beginner-friendly.
- Search by title/organization (Postgres full-text is enough).
- "Closing soon" strip (deadline within 48 h).
- Save event → appears in "My events" and offers an "Add to Google Calendar" link.
- Register as individual or as part of a team; registration enforces deadline, eligibility scope and team size rules.
- Server-rendered event pages with proper Open Graph tags (title, date, poster) so links preview well on WhatsApp.

### 5. Team formation engine (the core differentiator — build this carefully)
- On each event page: **Teams** tab with two lists — **Open vacancies** and **Looking for a team** (availability posts).
- **Create team** for an event (creator = leader). One team per user per event (DB constraint).
- **Post a vacancy:** role title, required skills, nice-to-have skills, hours/week, number of slots, short idea pitch, scope (`intra` = same college only, `cross` = any college allowed by the event). One optional screening question.
- **Apply:** short message + answer to screening question. Applicant cannot apply if already on a team for that event, or if scope/eligibility blocks them.
- **Match score** (simple, rule-based for now): % of required skills the applicant has, + small bonus for nice-to-haves and same-college. Show it and sort applications by it. Keep the scoring in one pure function so it can be swapped for AI later.
- **Leader review:** list of applications with applicant skills, links and match score; actions: shortlist, accept, reject, message.
- **Accept** → adds the member to `team_members`, links their registration to the team, decrements open slots, auto-closes the vacancy when full, notifies other applicants when it closes. All of this in a single DB transaction.
- **Availability post:** "Looking for a team" card with roles wanted and a note; team leaders can send an invite; invitee accepts/declines.
- Filters on both lists: skills, intra-college / cross-college, college, hours/week.
- Realtime: leaders see new applications appear without refresh; applicants see status changes live.

### 6. Team workspace
- Team page (members only): member list with roles, realtime chat, pinned event deadlines, a simple shared checklist.

### 7. Notifications
- In-app notification bell (realtime) for: new application, application accepted/rejected, team invite, organizer announcement, saved event closing in 24 h.
- Email is optional; if implemented, use Resend behind a single `sendEmail` helper so it can be disabled.

### 8. Endorsements (lightweight)
- After an event's end date, teammates can endorse each other on a skill (one per skill per pair per event). Show endorsement counts on profiles.

---

## Out of scope for this MVP
Payments/ticketing, featured listings, recruiter access, certificates, WhatsApp API messages, AI recommendations, poster OCR import, native mobile app, admin moderation console beyond a basic `is_admin` flag, PostGIS radius search (use city match for "Nearby").

---

## Data model

Implement the schema from the blueprint's "High-level database schema" table in Drizzle: `colleges, users (profiles), skills, user_skills, organizations, org_members, org_followers, events, saved_events, registrations, teams, team_members, vacancies, vacancy_skills, applications, availability_posts, invites, messages, endorsements, notifications, share_links, share_link_clicks`.

Enforce in the database (constraints, unique indexes, or transactional checks):
- one team per user per event;
- team size within `events.team_min` / `team_max`;
- cross-college membership only if `events.allow_cross_college` is true;
- one application per user per vacancy;
- endorsements only between members of the same team.

Use Supabase Row Level Security so users can only edit their own profile, org admins can only manage their org's events, and only team members can read team chat.

---

## Pages (suggested routes)

`/` feed · `/events/[id]` (overview, teams, discussion tabs) · `/events/new` · `/events/[id]/manage` (dashboard, registrants, share kit, check-in) · `/orgs/[slug]` · `/teams/[id]` · `/u/[username]` · `/me/events` · `/me/applications` · `/onboarding` · `/notifications`

---

## Build order (commit after each milestone, keep the app runnable)

1. Project scaffold, Tailwind + shadcn, Supabase + Drizzle setup, schema + migrations, seed script.
2. Auth, onboarding, profiles, college verification.
3. Organizations, event create/edit, event pages with OG tags.
4. Feed with campus/nearby/all scopes, filters, search, save, registration.
5. Teams, vacancies, applications, match score, accept flow (transactional), availability posts, invites.
6. Realtime: notifications, application updates, team chat.
7. Organizer dashboard, share links + click tracking, QR, CSV export, check-in.
8. Endorsements, polish, empty states, loading states, mobile pass.

## Seed data
Seed 3 Pune colleges with email domains, ~30 users with varied skills, 3 organizations, 8 events (mix of types, deadlines, past and upcoming), several teams with open vacancies and pending applications — enough to demo every flow immediately.

## Quality bar
- TypeScript strict, no `any` without a comment explaining why.
- Every server action validates input with Zod and checks authorization.
- Tests: unit tests for the match-score function and the accept-application transaction; one Playwright happy path (sign in → find event → apply → leader accepts).
- README: setup steps, env vars, how to run migrations and seed, how to deploy.

## How to work
- Start by reading `BLUEPRINT.md`, then propose a short plan and the final schema before writing code.
- Ask me before adding any paid service or changing the stack.
- When a requirement is ambiguous, pick the simplest option that keeps the data model extensible, note the decision in `DECISIONS.md`, and keep going.
