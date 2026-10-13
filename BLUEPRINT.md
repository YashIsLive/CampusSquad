# Campus Hackathon & Team-Finder Platform — Market Research & Product Blueprint

Oct 13, 2026 · @sizkcnt

## Executive summary

The gap is not "another hackathon listing site" — it is the campus layer. National platforms (Unstop, Devfolio, Devpost) are built for big, flagship events and for recruiters; the long tail of club quizzes, department hackathons and intra-college coding contests still runs on WhatsApp posters and Google Forms, and teammate-finding still happens in chat groups.

The proposed product (working name **CampusSquad**) wins by owning three things the incumbents treat as afterthoughts:

1. **Campus-scoped discovery** — a verified feed of everything happening in *your* college and nearby colleges, including small events nobody would list on Unstop.
2. **A skill-verified team marketplace** — teams post role vacancies ("React Native dev for Hackathon X"), individuals apply, with intra-college and cross-college filters and proof-of-work profiles (GitHub, past events).
3. **Zero-effort hosting for student clubs** — post in 5 minutes, auto-generate a WhatsApp-ready poster and link, track registrations live, check people in by QR.

Go-to-market is college-by-college: win one campus's clubs (the supply), and the students follow. Monetization comes later from featured listings, club Pro tools and recruiter access to verified builder profiles.

# Phase 1 — Market research & gap analysis

## 1. Host pain points

Student hosts spend most of their effort on distribution and admin, not on the event itself. Even large communities still ask volunteers to stick posters on notice boards and forward them on WhatsApp, Facebook and mailing lists ([PyCon India call for promotions](https://www.python.org/pipermail/inpycon/2018-June/012134.html)); college clubs do the same at smaller scale with fewer hands.

| Current method | What goes wrong | Cost to the host |
| --- | --- | --- |
| WhatsApp poster forwarding | Reach stops at the groups volunteers happen to be in; posters get buried within hours; no click or view data | No idea which channel worked; same 200 people see it every time |
| Physical classroom campaigns | Needs faculty permission and volunteer hours per class; reaches only own campus, only the sections visited | Volunteer hours for every class visited, zero reach outside campus |
| Google Forms registration | No dedup, no team structure, no payment, no confirmation flow; data cleaned by hand in Sheets | Manual follow-ups, wrong phone numbers, duplicate entries |
| Manual team tracking | Team names, member lists and changes arrive over DMs | Last-minute swaps break the list; check-in day is chaos |
| Instagram / college page posts | Algorithm-dependent, poor for deadlines, no registration link in post | Engagement without conversions |
| Unstop / Devfolio listing | Built for flagship events; small club events get lost among corporate challenges | Effort is not worth it for a 60-person department quiz |

**The core problems, summarized:**

- **Fragmented reach.** Each channel reaches a different, overlapping slice; nothing aggregates them, so the inter-college audience is almost never reached.
- **No measurement.** Hosts cannot see views → clicks → registrations → attendance, so they cannot improve the next event.
- **Registration ≠ attendance.** No reminders or RSVP confirmation, so no-shows are high and food/venue planning is guesswork.
- **Team handling is manual.** Organizers end up running their own team-matching on Telegram, speed-matching sessions or forms, or even assigning leftover solo registrants to teams themselves ([Infor hackathon](https://community.developer.infor.com/discussion/66/start-forming-teams), [African Blockchain Championship](https://directed.notion.site/Team-formation-1c452c038379806995fde8b5394b6f93)).
- **No institutional memory.** Each year's committee starts from zero — no past participant list, no audience to re-invite.

## 2. Student pain points

Students lose events at two points: they never hear about them in time, and when they do, they cannot assemble the right team fast enough. Even a hackathon-listing blog notes that most students find the big events only after registrations close ([WhereUElevate](https://whereuelevate.com/blogs/hackathons-in-india-live-list-of-free-paid-events)).

| Friction | What it looks like | Why it hurts |
| --- | --- | --- |
| Information asymmetry | Events live in class groups, club Instagrams and seniors' forwards; students outside the "right" group never see them | Opportunities concentrate among already-connected students |
| Missed deadlines | A poster seen once in a busy WhatsApp group; no calendar entry, no reminder | Registration closes before the team is ready |
| The "lone wolf" problem | Interested student, no friends with matching interest or skills | Most people arrive at hackathons alone ([Builder's Guide](https://intercom.help/builderbase/en/articles/14836118-builder-s-guide-ch-07-finding-teammates)), so solo students skip events that require 2–4 member teams |
| Vetting skills | "I know React" in a chat message is unverifiable; no portfolio, no history | Teams form by friendship, not fit; a missing backend or design skill sinks the project |
| Cross-college isolation | Inter-college teams are often allowed ([Build With Bharat](https://www.startupgrantsindia.com/build-with-bharat)) but there is no place to meet students from other colleges | Strong teams across campuses never form |
| Signal-to-noise | National platforms mix jobs, courses, quizzes and corporate hiring challenges | Hard to find "tech events near me this month that fit my level" |

**The team-formation problem in particular** is visible in how many students build their own fix: TeamUp, Squadops, Find Your HackathonMates and similar projects all try to match teammates by skills ([Squadops](https://devfolio.co/projects/squadops-4219), [TeamUp](https://hackquest.io/zh-cn/projects/TeamUp-ViTEuc), [HackathonMates](https://find-your-hackathonmates.onrender.com/)). The demand is real; the problem is that each is detached from where events are actually listed, so none reaches critical mass.

## 3. Current market gaps

Every incumbent is strong at the macro, inter-college or national level and weak at the hyper-local, intra-college level — and none treats team formation as a first-class, skill-verified marketplace.

| Platform | Built for | Scale (self-reported) | Team formation today | What it misses for campus events |
| --- | --- | --- | --- | --- |
| [Unstop](https://apps.apple.com/app/id1601170365) | Hiring + competitions; free hosting for college societies | 21M+ students, 800+ brands, 20,000+ colleges | Register individually, then create or join a team ([example](https://www.startupgrantsindia.com/the-anvil-hackathon)) | Feed dominated by corporate challenges, jobs and courses; no "my campus" view; no open role-vacancy board; small club events get buried |
| [Devfolio](https://devfolio.co/organize) | Hackathon management; strongest in Web3 | Free for student-run hackathons ([profile](https://agentcommunity.org/m/devfolio)) | Teams created on the event page; builder profile doubles as vetting | Hackathons only — no quizzes, coding contests, workshops; no intra-college discovery; finding a stranger with a specific skill is still on you |
| [Devpost](https://yespress.io/devpost) | Global/virtual hackathons; paid private hackathons for companies | 6M+ developers; student-run events free | Participants can post roles they need — in Devpost for Teams ([product page](https://proxy-ga.blitzz.co/proxy/123456/info.devpost.com/product/devpost-for-teams)) | Little India-specific focus; no campus layer; not where Indian college clubs post |
| [Meetup](https://help.meetup.com/hc/en-us/articles/28677808413197) | Recurring interest groups | Pro starts at $55 per group per month | None | Paid for organizers, groups not events; not built for competitions or student budgets |
| [Reskilll](https://blogs.reskilll.com/top-10-hackathon-platforms-in-india-2026-why-reskilll-leads-the-pack/) | End-to-end hackathons for companies, colleges, government | Claims 7M+ registered innovators | Automatic team formation within its events | Organizer-run service for large events; not a student-to-student social layer |
| Student-built teammate finders | Matching only | Tiny (e.g. 25+ early users) | Core feature | No events attached, so no reason to return; no network effect |
| [Eventsliner](https://www.startinup.up.gov.in/crm/Welcome/startup_user_details/NDk1NA==) | Student event hub (DU/NCR) | Regional | Not described | Closest comparable; general events (cultural, academic), not tech teams |

### The gaps that matter

1. **Hyper-local discovery is unowned.** No platform answers "what tech events are happening on my campus and within 20 km this month?" Listing a 60-person department quiz on Unstop is overkill; WhatsApp is all that is left.
2. **Team formation is event-scoped and passive.** Incumbents let you *create* a team and invite people you already know. None offers an open, searchable **vacancy board** with applications, skill filters and an intra-/cross-college toggle.
3. **Skill claims are unverified.** Devfolio's profile is the best proxy for proof-of-work, but it is not used to rank or recommend teammates.
4. **Small hosts are underserved.** Tools are built for 1,000-person hackathons; a club running a 2-hour coding contest needs a 5-minute form, a share-ready poster and a QR check-in, not judging workflows.
5. **No continuity between events.** Teams dissolve after each event; nothing remembers "we worked well together" or lets a club re-invite last year's participants.

**Positioning:** do not fight Unstop on national corporate competitions. Become the campus-and-city layer — and link out to Unstop/Devfolio registration where a big event already lives there, while still letting students form teams for it on your platform.

# Phase 2 — Product blueprint & architecture

## 1. Value proposition & core features

**For hosts:** "Post once, reach every tech student on your campus and nearby — and see exactly who registered, who formed teams and who showed up."

**For students:** "Every tech event around you in one feed, and the right teammates one application away."

### A. Centralized event portal

**Host side — post, manage, track**

- **5-minute event wizard:** title, type (hackathon, quiz, coding contest, workshop, ideathon, CTF), mode (offline/online/hybrid), venue, dates, registration deadline, team size min–max, eligibility (own college only / city / India), fee, prizes, rules, problem statements.
- **Verified host pages:** clubs and departments verified via college email domain or a faculty-coordinator approval; verified badge on every event.
- **Share kit, generated automatically:** a WhatsApp-ready poster image, short link with UTM tags per channel, QR code for physical posters and classroom slides, and a pre-written WhatsApp/Instagram caption. This keeps WhatsApp as a channel but makes it measurable.
- **Custom registration form:** default fields from the student profile (no retyping), plus custom questions; individual or team registration; waitlist and approval mode.
- **Live dashboard:** funnel of views → registrations → teams formed → checked in, split by channel and by college; export to CSV/Sheets.
- **Communications:** announcements to all registrants via in-app, email and WhatsApp-link digest; automatic reminders at 72 h, 24 h and 2 h.
- **Event-day tools:** QR check-in from a phone, attendance list, certificate generation for participants and winners.
- **Re-engagement:** "notify followers" — students who follow a club get every new event; past participants can be re-invited.

**Student side — discover and filter**

- **Feed with three scopes:** *My campus* · *Nearby* (city / radius) · *All India*. Campus scope is the default and the differentiator.
- **Filters:** event type, domain (AI/ML, web, app, cybersecurity, DSA, Web3, IoT, design), mode, date range, deadline within N days, team size, fee (free/paid), level (beginner-friendly), eligibility (open to my year/branch).
- **Deadline engine:** one-tap save → adds to Google Calendar and triggers reminders; "closing in 48 h" strip at the top of the feed.
- **Follow** clubs, colleges and domains; weekly digest by email.
- **External events too:** big events hosted on Unstop/Devfolio can be listed as "external" (registration link out) so students still find teammates for them here.

### B. Team formation & networking engine

The engine is a two-sided marketplace attached to each event: **teams post vacancies, individuals post availability**, and either side can apply or invite.

**Vacancy posts (team side)**

- Linked to a specific event; role title (e.g. "React Native developer"), required skills (tags), nice-to-have skills, commitment (hours, in-person or remote), number of open slots, short pitch of the idea, current members' skills shown automatically.
- Applicants answer 1–2 short questions set by the leader; leader sees a shortlist with each applicant's skill tags, GitHub stats and event history.
- Accept / reject / message; accepted member is added to the team and to the event registration automatically. Vacancy closes when slots fill.

**Availability cards (individual side)**

- "Looking for a team for Hackathon X — ML + Python, available weekends, open to cross-college." Team leaders can browse these and send invites.

**Matching filters**

| Filter | Intra-college (same campus) | Cross-college |
| --- | --- | --- |
| Scope | Same verified college | Same city, radius in km, state, or all India |
| Eligibility check | Auto-pass | Checks the event allows inter-college teams before showing |
| Logistics | Same year / branch / section optional | Online-only or willing-to-travel toggle |
| Skills | Required and nice-to-have tags, proficiency level | Same |
| Trust signals | Mutual connections, same club | Verified college email, GitHub linked, past events, peer endorsements |
| Availability | Hours per week, dates | Same, plus overlapping online hours |

**Trust & quality**

- **Proof-of-work profile:** skills with evidence links (GitHub repos, deployed projects, past event results); skill tags auto-suggested from GitHub languages.
- **Peer endorsements after each event:** teammates confirm "worked with X — skills: backend, reliable". Only teammates can endorse, which limits fake reviews.
- **Reliability score:** based on show-up rate after accepting a team spot; protects teams from ghosting.

**Team workspace (real-time)**

- Team chat, file and link board, task checklist, and the event's deadlines pinned. Chat stays open after the event so good teams can stay together for the next one.

## 2. User personas & user journeys

|  | Persona A — The Organizer | Persona B — The Solo Participant | Persona C — The Team Leader |
| --- | --- | --- | --- |
| Example | Riya, 3rd-year, tech lead of the college AI club, running a 6-hour hackathon for 150 students | Aarav, 2nd-year CS, knows Python and ML basics, none of his friends do hackathons | Neha, 3rd-year, has an EV-charging idea for a national hackathon, 2 members, needs a mobile dev and a designer |
| Goal | Fill seats with the right people, inside and outside campus; run a smooth event day | Find a beginner-friendly event and a team that will take him | Fill specific skill gaps before the registration deadline |
| Today's workaround | Poster on 15 WhatsApp groups, classroom visits, Google Form, Excel | Waits for a friend to invite him; mostly skips team events | Posts "need a Flutter dev" in group chats; asks seniors |
| Biggest frustration | Can't tell what worked; no-shows; team list chaos | Doesn't know who is looking, fears rejection | Can't verify claimed skills; people ghost after agreeing |
| Success metric | Registrations from 3+ colleges, >70% show-up | Joined a team within 3 days of looking | Team complete with verified skills 7+ days before deadline |

### Journey A — The Organizer (Riya)

1. **Sets up** a verified club page (college email + faculty coordinator approval), once.
2. **Creates the event** in the wizard: hackathon, offline, team size 2–4, open to Pune colleges, deadline in 14 days.
3. **Gets the share kit:** poster, QR, short links per WhatsApp group and Instagram; prints the QR for the notice board.
4. **Event goes live** in the "My campus" feed and the "Nearby" feed of other Pune colleges; club followers are notified.
5. **Watches the dashboard:** sees 60% of registrations came from one WhatsApp link, 25% from the platform feed; 40 solo registrants.
6. **Nudges solo registrants** to the event's team board with one click; 30 of them join teams.
7. **Sends announcements** (venue, problem statements); automatic reminders go out at 24 h and 2 h.
8. **Event day:** scans QR at entry; live attendance count.
9. **After:** uploads results, issues certificates, prompts endorsements; the participant list becomes her audience for the next event.

### Journey B — The Solo Participant (Aarav)

1. **Signs up** with college email; imports skills from GitHub; marks himself as a beginner in ML.
2. **Browses "My campus" + "Nearby"**, filters to beginner-friendly AI events closing in the next 2 weeks; saves two to his calendar.
3. **Opens the event's team board**, filters vacancies for "Python / ML", intra-college first, then cross-college.
4. **Applies to 3 vacancies** with a one-line pitch; also posts an availability card so leaders can invite him.
5. **Gets an invite** from a team at a nearby college; checks the leader's profile and past events; accepts.
6. **Is added to the team** and the event registration automatically; joins team chat; gets reminders.
7. **After the event**, endorses teammates and is endorsed for "Python, data cleaning" — his profile now carries proof for the next application.

### Journey C — The Team Leader (Neha)

1. **Registers the team** for the event (or marks an external Unstop event and adds her team here).
2. **Posts two vacancies:** "React Native / Flutter developer" and "UI/UX designer", each with required skills, hours per week and a short idea pitch; scope set to cross-college, Maharashtra.
3. **Receives applications** ranked by skill match; sees GitHub activity, past events and reliability score for each.
4. **Shortlists and chats** with 3 applicants in-app; sets a small screening question.
5. **Accepts two**; vacancies close automatically and other applicants are notified politely.
6. **Runs the team workspace:** tasks, links, deadlines pinned, submission checklist.
7. **After the event**, rates teammates; keeps the team together and follows the next event as a team.

## 3. Technical architecture & stack

Recommended: a TypeScript monorepo with Next.js on the front, PostgreSQL as the single source of truth, and a WebSocket layer for chat and live application updates. It runs on free tiers for the MVP and scales by adding workers and caches, not by rewriting.

&#91;embedded content: system architecture · 4 tiers\]

Every write lands in PostgreSQL; the realtime gateway pushes changes to open browsers, and workers handle anything scheduled or slow.

### Recommended stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js (App Router) + TypeScript, Tailwind, shadcn/ui; installable PWA | Server-rendered event pages load fast on mobile data and give rich link previews when shared on WhatsApp; one codebase for web and "app" |
| API | Next.js route handlers for the MVP → NestJS (Node) service once logic grows | Same language end-to-end; NestJS adds modules, guards and queues cleanly |
| Real-time | Socket.IO with Redis adapter (or Supabase Realtime for the MVP) | Team chat, "new applicant" and "application accepted" events, live registration counter |
| Database | PostgreSQL (Supabase or Neon) + PostGIS + pg\_trgm | Teams, members and applications are strongly relational; PostGIS for "within 20 km"; trigram for fuzzy search |
| Search | Postgres full-text at first → Meilisearch/Typesense at scale | Fast faceted filters on events and vacancies |
| Cache & jobs | Redis + BullMQ workers | Feed caching, rate limits, reminder schedules, digest emails, certificate generation |
| Auth | Google OAuth + college-email OTP verification | Verified college membership is the backbone of intra-college trust |
| Files & images | Cloudinary or S3 + CDN; generated posters and OG images | Posters, certificates, share cards |
| Notifications | In-app + web push + email (Resend/SES); WhatsApp Business API later | Reminders are the cure for missed deadlines |
| Analytics | PostHog (product) + own UTM/referral table (host dashboard) | Hosts see channel-level funnels |
| Hosting | Vercel (web), Railway/Render/Fly (API, sockets, workers), managed Postgres | Free/cheap at start, horizontally scalable |
| AI (Phase 3) | pgvector embeddings + an LLM API | Teammate recommendations, poster-to-event extraction |

If the founding team is faster in Python, Flask or FastAPI with Flask-SocketIO/websockets is a valid MVP backend — the schema and architecture below do not change.

### High-level database schema

| Table | Key columns | Relations |
| --- | --- | --- |
| colleges | id, name, city, state, email\_domain, location (geo point), verified | has many users, organizations |
| users | id, name, email, college\_id, year, branch, bio, github\_url, linkedin\_url, open\_to\_cross\_college, reliability\_score, created\_at | belongs to college; has many skills, memberships, applications |
| skills | id, name, category (frontend, backend, ML, design…) | many-to-many with users, vacancies |
| user\_skills | user\_id, skill\_id, level (1–5), evidence\_url, endorsed\_count | join table |
| organizations | id, name, type (club, department, community, company), college\_id (nullable), verified, logo\_url | has many events, org\_members |
| org\_members | org\_id, user\_id, role (owner, admin, volunteer) | join table |
| events | id, org\_id, title, type, domain\_tags, mode, venue, location, starts\_at, ends\_at, reg\_deadline, team\_min, team\_max, eligibility\_scope (college/city/state/india), allow\_cross\_college, fee, prize\_text, external\_url, status, is\_featured | belongs to organization; has many registrations, teams |
| registrations | id, event\_id, user\_id, team\_id (nullable), form\_answers (JSONB), source\_channel, status (registered, waitlisted, checked\_in, no\_show), created\_at | links users to events |
| teams | id, event\_id, name, leader\_id, idea\_pitch, is\_open, created\_at | belongs to event; has many team\_members, vacancies |
| team\_members | team\_id, user\_id, role\_title, joined\_at | join table |
| vacancies | id, team\_id, role\_title, description, commitment\_hours, slots, scope (intra/cross), status (open, filled, closed), created\_at | belongs to team; has many vacancy\_skills, applications |
| vacancy\_skills | vacancy\_id, skill\_id, required (bool) | join table |
| applications | id, vacancy\_id, applicant\_id, message, answers (JSONB), match\_score, status (pending, shortlisted, accepted, rejected, withdrawn), created\_at, decided\_at | links users to vacancies |
| availability\_posts | id, event\_id, user\_id, roles\_wanted, note, scope, status | individual "looking for team" cards |
| invites | id, team\_id, user\_id, status | leader → individual invitations |
| messages | id, channel\_type (team, direct), channel\_id, sender\_id, body, created\_at | team and DM chat |
| endorsements | id, event\_id, from\_user, to\_user, skill\_id, note | only teammates of the same event |
| notifications | id, user\_id, type, payload (JSONB), read\_at | fan-out target |
| share\_links | id, event\_id, channel\_label, short\_code, clicks | powers the host's channel funnel |

Integrity rules to enforce in the database: one team per user per event; team size between `team_min` and `team_max`; a cross-college application is allowed only if `events.allow_cross_college` is true; endorsements only between members of the same team.

## 4. Monetization & future scalability

Students and student clubs must never pay for the basics — Unstop and Devfolio already host student events for free — so revenue comes from those who want reach, polish or talent: promoters, institutions and companies. Price points below are starting hypotheses to test, not researched figures.

| Stream | Who pays | What they get | Starting hypothesis |
| --- | --- | --- | --- |
| Featured / boosted listings | Clubs, fests, startups, ed-tech | Top of "Nearby" and "All India" feeds, push to followers of a domain | ₹299–₹1,499 per event boost |
| Club / Fest Pro | Large clubs, college fests | Custom branding, multi-event fest pages, WhatsApp reminders, bulk certificates, advanced analytics | ₹999–₹2,999 per semester |
| College institutional plan | Departments, TPO, IQAC | Campus-wide event calendar, participation reports for accreditation (e.g. NAAC event documentation), student activity transcripts | Annual licence per college |
| Recruiter access | Startups, companies | Search verified builder profiles by skills, endorsements and event wins; message shortlisted students | Per-seat monthly subscription |
| Sponsored challenges | Dev-tool companies, brands | Run a challenge across many campuses, branded vacancy tags ("built with X") | Per-campaign fee |
| Ticketing commission | Paid events | Payment collection, refunds, invoices (Razorpay) | 2–3% of paid registrations |
| Sponsorship marketplace | Sponsors ↔ clubs | Matches small sponsors with campus events; reach data as proof | Commission on closed deals |

**Order of rollout:** free core until one city is dense → featured listings and ticketing (easy, self-serve) → Pro and institutional plans → recruiter access once there are enough verified, endorsed profiles to be worth searching.

### Roadmap

Expansion goes campus → city → state → national, and each phase only opens after the previous one proves density.

&#91;embedded content: roadmap · 4 phases, 3 gates\]

Gate targets are proposed success criteria to validate each phase, not benchmarks from research.

**AI features in Phase 3 (detail)**

- **Teammate recommendations:** embed skills, project history and stated interests; recommend applicants whose skills complement the team's gaps ("your team has 3 frontend, 0 ML"), weighted by reliability score and past collaboration ratings.
- **Event recommendations:** personalized feed from saved, attended and applied events.
- **Poster-to-event import:** host uploads an existing WhatsApp poster; vision model extracts title, dates, deadline, venue and contact into the wizard.
- **Team-gap analysis:** for a chosen problem statement, suggest which roles a team is missing.
- **Spam and fake-profile detection:** flag duplicate accounts and inflated skill claims.

**Metrics to track from day one:** share of a campus's tech events posted on the platform; registrations per event by channel; % of solo registrants who end up in a team; time from vacancy posted to filled; show-up rate; 30-day student retention.

## Sources

Scale figures are as reported by each company or its listings; Reskilll's figures come from its own blog.

- [Unstop — App Store listing](https://apps.apple.com/app/id1601170365)
- [Unstop event example: The Anvil Hackathon](https://www.startupgrantsindia.com/the-anvil-hackathon)
- [Devfolio — Organize](https://devfolio.co/organize)
- [Devfolio profile — Agent Community](https://agentcommunity.org/m/devfolio)
- [Devpost company profile — Yespress](https://yespress.io/devpost)
- [Devpost for Teams product page](https://proxy-ga.blitzz.co/proxy/123456/info.devpost.com/product/devpost-for-teams)
- [Meetup organizer subscription prices](https://help.meetup.com/hc/en-us/articles/28677808413197)
- [Reskilll — Top hackathon platforms in India 2026](https://blogs.reskilll.com/top-10-hackathon-platforms-in-india-2026-why-reskilll-leads-the-pack/)
- [Eventsliner — Startup in UP listing](https://www.startinup.up.gov.in/crm/Welcome/startup_user_details/NDk1NA==)
- [WhereUElevate — Hackathons in India 2026](https://whereuelevate.com/blogs/hackathons-in-india-live-list-of-free-paid-events)
- [Build With Bharat 2026](https://www.startupgrantsindia.com/build-with-bharat)
- [Builder's Guide Ch.07: Finding Teammates](https://intercom.help/builderbase/en/articles/14836118-builder-s-guide-ch-07-finding-teammates)
- [Infor Community Hackathon — team formation](https://community.developer.infor.com/discussion/66/start-forming-teams)
- [African Blockchain Championship — team formation](https://directed.notion.site/Team-formation-1c452c038379806995fde8b5394b6f93)
- [PyCon India 2018 — call for promotions](https://www.python.org/pipermail/inpycon/2018-June/012134.html)
- Student teammate-finder projects: [Squadops](https://devfolio.co/projects/squadops-4219), [TeamUp](https://hackquest.io/zh-cn/projects/TeamUp-ViTEuc), [Find Your HackathonMates](https://find-your-hackathonmates.onrender.com/)
