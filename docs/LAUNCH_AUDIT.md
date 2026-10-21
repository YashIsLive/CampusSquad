# Pre-launch audit — Got Next

A security and compliance checklist for putting Got Next in front of real students. Each item says
**what** to check, **why** it matters before launch, and **where Got Next stands** today, verified
against the code on 21 October 2026.

**Status:** ✅ done and verified · ⚠️ partly done or depends on a dashboard setting · ❌ still to do

> This is an engineering and compliance checklist, not legal advice. Have a lawyer review the legal
> section, and especially the privacy policy and terms, before a public launch.

---

## Launch blockers

Fix these before real students sign up. Everything else can follow in the first weeks.

| # | Item | Section | Status |
| --- | --- | --- | --- |
| 1 | Separate production Supabase project, on a plan with **daily backups**, in the **Mumbai** region | 1.3, 1.5 | ❌ you: dashboard |
| 2 | **MFA for admin accounts** (admins can see emails and verify students) | 1.2 | ✅ built; required for admins and ID reviewers in production |
| 3 | **CAPTCHA** (Cloudflare Turnstile) on sign-up and sign-in | 1.2, 1.4 | ✅ built; ❌ you: create the Turnstile keys |
| 4 | **Error tracking** (Sentry) and an **uptime monitor** on `/api/health` | 1.5 | ✅ Sentry built; ❌ you: create the project (DSN) and the uptime monitor |
| 5 | **Grievance officer** named and published (IT Rules 2021), plus a **report button** for content and profiles | 2.1 | ✅ built; ❌ you: name the officer (env) |
| 6 | **Age confirmation** at sign-up (18+), as a tick box rather than text | 2.2 | ✅ built |
| 7 | A written **incident and breach response** plan, including DPDP breach notification | 1.5, 2.3 | ✅ [docs/INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md); ❌ you: fill in the contacts and practise once |
| 8 | **Legal review** of the privacy policy and terms; name the legal entity that runs Got Next | 2.1 | ❌ you: lawyer; set `NEXT_PUBLIC_LEGAL_ENTITY` |
| 9 | Production environment: `E2E_TEST_LOGIN` **unset**, `NEXT_PUBLIC_SITE_URL` https, all secrets fresh | 1.1, 1.3 | ❌ you: on deploy (the app refuses to start if these are wrong) |

**How to do the rest:** [docs/GO_LIVE.md](GO_LIVE.md) walks through every remaining step, and `npm run check:launch` tells you what's still missing.

The app now **refuses to start** on a real (https) deployment until the contact email, grievance officer,
legal entity and Turnstile keys are set, so none of these can be forgotten.

---

## 1. Security and vulnerability mitigation

### 1.1 Common vulnerabilities (OWASP Top 10)

| Check | What to verify | Why before launch | Status |
| --- | --- | --- | --- |
| **SQL injection** | Every query is parameterised; no string-built SQL. | One injectable query exposes the whole database. | ✅ All queries go through Drizzle or `sql` template tags (parameters, not string concatenation). No `sql.raw`/`.unsafe` anywhere. The one dynamic identifier (rate limits) comes from a fixed constant, never from input. |
| **Cross-site scripting (XSS)** | User text is escaped on output; no raw HTML rendering; a Content Security Policy limits what scripts can run. | XSS lets an attacker act as the victim: post as them, read their messages. | ✅ React escapes all output; no `dangerouslySetInnerHTML`; event rules are Markdown rendered **without** raw HTML; links only allow `http(s)` (blocks `javascript:` URLs, tested). ⚠️ The CSP still allows inline scripts (`'unsafe-inline'`), which Next.js needs without a nonce. Moving to nonce-based CSP is a hardening step for later. |
| **Cross-site request forgery (CSRF)** | State changes only via POST with origin checks; cookies are `SameSite`. | CSRF makes a logged-in user's browser perform actions they didn't intend. | ✅ All writes are Next.js Server Actions (POST, Origin header checked against Host). Auth cookies are `SameSite=Lax`. The only GET with a side effect is share-link click counting, which is harmless. |
| **Broken access control** | Every action checks that *this* user may do *this* to *this* record; the database API can't be used to bypass the app. | The most common real-world breach: changing an ID in a request to read or edit someone else's data. | ✅ Server actions check ownership (team lead, club admin, applicant, platform admin). Supabase's public REST API is locked down (table grants revoked; RLS on every table). `tests/api-security.test.ts` attacks it with the public key and must fail. The admin area returns 404 to non-admins. |
| **Mass assignment** | Input is validated against an allow-list of fields. | Prevents someone adding `is_admin: true` to a form submission. | ✅ Every server action parses input with a Zod schema; unknown fields are dropped. Privileged columns aren't writable through the API (tested). |
| **Open redirects** | `?next=` style parameters can only point to this site. | Attackers use your domain to send people to phishing pages. | ✅ `safeNext()` only allows site-relative paths; all redirects are relative. |
| **Server-side request forgery (SSRF)** | The server never fetches a URL a user supplied. | SSRF reaches internal services and cloud metadata. | ✅ The only outbound fetch is GitHub's API, with a validated username. |
| **File uploads** | Type and size limits, enforced on the server; private files stay private. | Uploads can host malware or script (SVG/HTML) on your domain, or run up storage bills. | ✅ Fixed in this audit (migration `0010`): posters, avatars and logos accept only JPEG/PNG/WebP/GIF, up to 5 MB. Uploads are confined to the user's own folder. Student ID photos sit in a **private** bucket, are viewable only through 10-minute signed links, and are deleted after review. |
| **Vulnerable dependencies** | No known-vulnerable packages in production. | Most breaches of small sites come through outdated libraries. | ✅ `npm audit --omit=dev`: 0 vulnerabilities; CI runs the audit on every push. ❌ Turn on **Dependabot** alerts and security updates on GitHub. |
| **Security misconfiguration** | No debug tools, test logins or default secrets in production. | One forgotten dev switch undoes everything else. | ✅ The app refuses to start in production with unsafe settings (`src/env.ts`): missing secrets, non-https site URL, or `E2E_TEST_LOGIN` set. The demo login route also returns 404 in production builds. ❌ Double-check the Vercel environment before the first deploy. |

### 1.2 Authentication and authorization

| Check | What to verify | Why before launch | Status |
| --- | --- | --- | --- |
| **Password storage** | Passwords are hashed with a slow, salted algorithm; never stored or logged in plain text. | If the database ever leaks, hashed passwords protect users who reuse them elsewhere. | ✅ Supabase Auth stores bcrypt hashes; the app never sees or stores passwords. |
| **Password policy** | Minimum length; known-breached passwords rejected. | Weak and reused passwords are the easiest way into accounts. | ⚠️ At least 8 characters with a letter and a number. ❌ In Supabase, raise the minimum to 10+ and turn on **leaked-password protection** (Pro plan). |
| **Brute force and bots** | Repeated sign-in and sign-up attempts are throttled; bots are challenged. | Without it, attackers can guess passwords or mass-create fake accounts. | ✅ Supabase rate-limits auth endpoints. ✅ **Cloudflare Turnstile** on sign-up, sign-in, email links and password reset, checked on the server (`src/lib/turnstile.ts`, tested against Cloudflare's test keys). Required on production deploys. ⚠️ Turnstile protects the app's forms; Supabase's own auth API is still reachable with the public key, limited by Supabase's rate limits. |
| **Email verification** | New accounts prove they own their address before it counts for anything. | Stops people impersonating a college with an address they don't own. | ✅ Sign-up confirms by email code or link; campus verification only trusts proven addresses (fixed twice this cycle: seed relink and admin approval). |
| **Sessions** | Session cookies are `HttpOnly` and `Secure`, expire, refresh safely, and end on sign-out. | Stolen session cookies are as good as a password. | ✅ `@supabase/ssr` cookies, rotating refresh tokens, server-side session checks on every request. ⚠️ In Supabase, check the JWT expiry (1 hour is fine) and that **refresh-token reuse detection** is on. ❌ A "sign out on all devices" button. |
| **New-device check** | A password alone isn't enough on an unknown browser. | Limits damage from leaked passwords. | ✅ With email on, a password on a new browser requires a one-time email code; the browser is then trusted for 30 days (signed, `HttpOnly` cookie; tested). |
| **Multi-factor authentication** | At least privileged accounts use MFA. | Admin accounts can see emails, verify students and take events down; one phished admin is a full breach. | ✅ Two-step sign-in with an authenticator app (Supabase TOTP MFA): anyone can turn it on (Account and privacy); once on, every sign-in asks for a code. **Required** for platform admins and student-ID reviewers in production: admin pages and actions check for a confirmed second step (`src/lib/mfa.ts`). Verified end to end: set up, challenged on next sign-in, turned off. |
| **Least privilege** | Admin rights are granted deliberately, limited and logged. | Limits how much one compromised account can do. | ✅ Admin is a database flag set by an admin or the `make-admin` script; admins can't remove their own access; club admins can only review IDs for their own college. ⚠️ Admin actions aren't written to an audit log yet (see 1.5). |
| **Account enumeration** | Error messages don't confirm which emails have accounts. | Attackers use it to target known accounts. | ✅ Password reset gives the same answer either way. ⚠️ Sign-up says "account already exists": an accepted trade-off for usability; CAPTCHA reduces the risk. |

### 1.3 Data in transit and at rest

| Check | What to verify | Why before launch | Status |
| --- | --- | --- | --- |
| **HTTPS / TLS** | Valid certificate, TLS 1.2+ only, HTTP redirects to HTTPS, HSTS. | Without it, anyone on campus Wi-Fi can read sign-in codes and session cookies. | ✅ Vercel issues certificates and serves TLS 1.2/1.3; the app sends HSTS and `upgrade-insecure-requests` when the site URL is https. ❌ After deploy, check with SSL Labs (aim for A/A+). Don't submit to the HSTS preload list until every subdomain is https. |
| **Encryption at rest** | Database and file storage are encrypted on disk. | Protects data if storage media are lost or mishandled. | ✅ Supabase encrypts databases and storage at rest (AES-256). |
| **Database connections** | The app connects to Postgres over TLS. | Credentials and data cross the network to the database. | ⚠️ Supabase pooler connections use TLS; confirm the production `DATABASE_URL` doesn't disable it (`sslmode=require` if in doubt). |
| **Secrets management** | Secrets live only in the hosting provider's environment settings, are never in git, and are rotated if exposed. | A leaked service-role key bypasses every protection in this list. | ✅ The service-role key is only used on the server (`server-only` imports). ❌ Use **fresh** production keys (a new Supabase project gives you these). Check git history for any committed `.env` file. Rotate anything that was ever pasted into chat or a screenshot. |
| **Data minimisation** | Collect only what's needed; delete what's no longer needed. | Less data held means less harm from any breach, and it's a legal requirement (2.3). | ✅ ID photos are deleted after review; accounts can be deleted. ⚠️ Organizers get registrants' emails; this is documented in the privacy policy and needed to run events. |
| **Backups** | Automated backups exist, are retained, and **a restore has been tested**. | Without them, one bad migration or deleted table is permanent. | ❌ Free Supabase projects have no automatic backups. Use Pro (daily backups) or point-in-time recovery, and do one test restore into a scratch project before launch. |

### 1.4 Infrastructure and API

| Check | What to verify | Why before launch | Status |
| --- | --- | --- | --- |
| **Rate limiting** | Every action that writes data or notifies people is limited per user, plus per IP at the edge. | Stops spam, scraping and runaway bills. | ✅ Per-user limits on applications, invites, messages, announcements, clubs, events, vouches and ID uploads (counted from the database, so they survive restarts). ❌ Add **Vercel Firewall** rate-limit rules (or Cloudflare in front) for login and API routes. |
| **Security headers** | CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. | They switch on browser protections against clickjacking, MIME sniffing and data leaks. | ✅ All set in `next.config.ts` (framing denied, camera allowed only for QR check-in). ❌ After deploy, scan with securityheaders.com. |
| **CORS and public APIs** | No endpoint answers other sites' scripts with private data. | Prevents other websites reading your users' data through their browser. | ✅ No public JSON API; Supabase REST is locked down; the data export route needs the user's own session. |
| **Scheduled jobs** | Cron endpoints can't be triggered by strangers. | Otherwise anyone could spam reminders. | ✅ `/api/cron/*` requires `CRON_SECRET`. |
| **Cost and abuse limits** | Spending caps on hosting, database and email. | A traffic spike or attack shouldn't produce a surprise bill or exhaust the email quota. | ❌ Set Vercel **Spend Management**, Supabase usage alerts, and watch Brevo's daily limit (300/day free) before announcing. |
| **Sender authentication** | SPF, DKIM and DMARC for the email domain. | Without them, sign-in codes land in spam and others can spoof your domain. | ❌ Send from your own domain in Brevo and publish SPF, DKIM and a DMARC record (start with `p=none`, then tighten). |

### 1.5 Monitoring and recovery

| Check | What to verify | Why before launch | Status |
| --- | --- | --- | --- |
| **Error tracking** | Server and browser errors are reported with context (no personal data). | Without it, you hear about bugs from angry students, or never. | ✅ Sentry on server, edge and browser; off until `NEXT_PUBLIC_SENTRY_DSN` is set. Emails, IPs, cookies, auth headers, request bodies, sign-in tokens and entry codes are scrubbed before sending (tested). Events go through the site's own `/monitoring` route. No session replay. ❌ You: create the Sentry project and set the DSN. |
| **Uptime monitoring** | Something checks the site every few minutes and alerts you. | Lets you fix an outage before the event's registration deadline passes. | ❌ Point an uptime monitor (Better Stack, UptimeRobot) at `/api/health`, which reports database reachability. |
| **Logging** | Enough logs to investigate an incident; no passwords, codes or ID photos in them. | You can't respond to what you can't see; CERT-In expects logs kept for 180 days. | ⚠️ Vercel function logs only (short retention). The app doesn't log personal data. ❌ Add a log drain with 180-day retention as you grow (GO_LIVE step 9.8). |
| **Admin audit trail** | Who verified, unverified, promoted or took down what, and when. | Needed to investigate misuse by an admin and to answer user complaints. | ⚠️ ID reviews record the reviewer. ❌ Other admin actions (make admin, take down event, verify student) aren't logged; add an `admin_actions` table. |
| **Incident response plan** | A plan: who decides, how to contain (rotate keys, disable sign-ups, take the site down), who to tell, and how fast. | In a breach there's no time to work this out, and the law sets deadlines (2.3). | ✅ [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md): severities, playbooks, key rotation, CERT-In (6 h) and DPDP (72 h) notification, templates. ✅ Emergency switches built and tested: `MAINTENANCE_MODE`, `SIGNUPS_PAUSED`. ❌ You: fill in contacts, practise once. |
| **Recovery drill** | Restore from backup and redeploy from scratch at least once. | Untested backups often turn out not to work. | ❌ Do it once on a scratch project before launch. |
| **Security review** | An independent look before scale. | Fresh eyes find what the builder can't. | ⚠️ Automated: RLS/API attack tests, axe, e2e. ✅ `/.well-known/security.txt` tells researchers where to report. ❌ Before any large rollout, a short external review. |

---

## 2. Legal and compliance

### Which laws apply

- **India: Digital Personal Data Protection Act 2023 and DPDP Rules 2025.** Got Next processes the
  personal data of people in India, so this is the primary law. It sets notice, consent, rights,
  security safeguards and breach notification duties.
- **India: IT Act 2000 and IT (Intermediary Guidelines and Digital Media Ethics Code) Rules 2021.**
  Got Next hosts content its users post (events, profiles, messages), which makes it an intermediary:
  it needs published terms, a grievance officer and a takedown process.
- **GDPR (EU/UK):** applies only if you target people in the EU/UK or monitor them. Not the case for an
  India campus pilot, but the controls below would mostly satisfy it if that changes.
- **CCPA/CPRA (California):** applies only above revenue or data-volume thresholds Got Next doesn't
  meet. Not applicable.

### 2.1 Required documents

| Check | What to verify | Why before launch | Status |
| --- | --- | --- | --- |
| **Privacy policy (DPDP notice)** | In plain language: what's collected, why, who sees it, how long it's kept, rights, how to withdraw consent, how to complain (including to the Data Protection Board). | DPDP requires this notice to accompany or precede any request for consent. | ✅ `/privacy` covers all of these and matches the actual behaviour, including a "Who we are" section and the right to nominate. ❌ You: set `NEXT_PUBLIC_LEGAL_ENTITY` (legal name and address). ❌ Lawyer review. |
| **Terms of service** | Who can use it, rules of conduct, what the platform isn't responsible for, how accounts can be removed, governing law. | Sets expectations, limits liability, and is required for intermediaries. | ✅ `/terms`. ❌ Lawyer review; add the legal entity. |
| **Cookie notice** | Lists the cookies used and why. A consent banner is only needed for non-essential cookies (analytics, ads). | Cookie banners where none are needed annoy users; missing consent where it *is* needed is a violation. | ✅ Got Next sets only strictly necessary cookies (sign-in and the remembered device), described in the privacy policy, so **no banner is needed**. ❌ If you ever add analytics or ads, add consent first. |
| **Grievance officer** | A named grievance officer with contact details on the site; complaints acknowledged within 24 hours and resolved within 15 days. | A requirement for intermediaries under the IT Rules 2021, and the route DPDP expects for complaints. | ✅ Shown on `/privacy` and `/terms` with the 24-hour / 15-day timelines. ❌ You: set `NEXT_PUBLIC_GRIEVANCE_OFFICER` (a named person; it can be you for a pilot) and `NEXT_PUBLIC_CONTACT_EMAIL` (an inbox you read daily). |
| **Content rules and takedown** | Users can report events, profiles and messages; you have a process and a deadline to act. | Intermediaries lose legal protection if they don't act on reports; harassment between students is a real risk. | ✅ **Report** on events, profiles, teams and conversations. The reporter gets an acknowledgement; admins get a Reports queue (oldest first, with the reported conversation shown inline) and close each report with a note the reporter sees. Admins can take events down. ⚠️ There's no account suspension yet; delete or contact the person for now. |

### 2.2 Consent

| Check | What to verify | Why before launch | Status |
| --- | --- | --- | --- |
| **Consent at sign-up** | Consent is informed (linked notice), specific, and given by a clear action. | DPDP consent must be "free, specific, informed, unconditional and unambiguous with a clear affirmative action". | ✅ A required tick box in profile setup ("I'm 18 or older, and I agree to the terms and privacy policy"), which every sign-up path goes through; the server refuses without it (tested). The accepted **version and time** are stored per person. Existing accounts are asked once on `/consent`, and everyone is asked again when `TERMS_VERSION` changes. |
| **Sensitive extras** | Separate, explicit consent for anything beyond the basics. | Bundled consent for unrelated purposes isn't valid. | ✅ ID photo upload is disabled until a specific consent box is ticked. |
| **Age** | Users confirm they're 18 or over; under-18s are kept out unless you obtain verifiable parental consent. | DPDP requires **verifiable parental consent** for anyone under 18 and bans tracking or targeting them. Some first-year students are 17. | ✅ 18+ confirmation is part of the required consent box and recorded with a timestamp. ❌ Decide how to handle 17-year-old first-years: keep them out (current behaviour), or build a parental consent flow. |
| **Withdrawing consent** | As easy to withdraw as to give. | A DPDP requirement. | ✅ Delete account from **Account and privacy**. ❌ Add an opt-out for non-essential emails (reminders, "new event from a club you follow"); sign-in codes stay. |
| **No marketing without opt-in** | No promotional email unless the person asked for it. | Unsolicited marketing breaks consent rules and hurts email deliverability. | ✅ Got Next sends only service email. |

### 2.3 Data privacy rights and duties

| Check | What to verify | Why before launch | Status |
| --- | --- | --- | --- |
| **Right of access** | People can get a summary or copy of their data. | DPDP right to information. | ✅ **Download my data** (JSON), tested. |
| **Right to correction** | People can fix their data. | DPDP right to correction. | ✅ Edit profile. |
| **Right to erasure** | People can delete their account and data. | DPDP right to erasure; it also builds trust with students. | ✅ Self-serve deletion, tested end to end (teams handed over, files and auth user removed). ⚠️ Backups still hold deleted data until they expire; the policy says 30 days, so keep backup retention within that. |
| **Right to nominate** | People can nominate someone to exercise their rights if they die or become incapacitated. | A DPDP right. | ❌ Mention it in the privacy policy and handle requests by email. |
| **Retention limits** | Data is deleted once its purpose is over (for example, long-inactive accounts). | DPDP requires erasure once the purpose is served. | ⚠️ ID photos are deleted after review. ❌ Define a rule for inactive accounts (e.g. warn after 2 years, delete after 3) and add it to the policy. |
| **Breach notification** | A process to notify the Data Protection Board and affected users. | DPDP Rules require notifying affected people and the Board without delay, with a detailed report within 72 hours. | ❌ Part of the incident response plan (1.5). |
| **Processors and data location** | Agreements with every company that handles user data, and where the data is stored. | You remain responsible for what your processors do with the data. | ❌ Accept the data processing agreements of Supabase, Vercel and Brevo. Host the production database in **Mumbai (ap-south-1)** to keep data in India. Transfers abroad are allowed unless the government restricts a country, but local is simpler. |
| **Reasonable security safeguards** | Encryption, access control, logging, backups. | DPDP makes inadequate safeguards a penalty in its own right (up to ₹250 crore). | ⚠️ Section 1 covers this; the open items there are the remaining gaps. |

### 2.4 Accessibility and intellectual property

| Check | What to verify | Why before launch | Status |
| --- | --- | --- | --- |
| **WCAG 2.1 AA** | Keyboard use, focus, contrast, labels, alt text, screen-reader support. | Students with disabilities must be able to use it; it's increasingly a legal expectation (Rights of Persons with Disabilities Act 2016). | ✅ Automated axe checks (WCAG 2.1 AA) on public and signed-in pages in the test suite; keyboard navigation, skip link, reduced motion, contrast designed in. ❌ One manual pass with a screen reader (TalkBack on Android, NVDA on Windows). |
| **Accessibility statement** | A page saying the standard you aim for and how to report problems. | Shows good faith and gives people a route to report barriers. | ❌ Add a short `/accessibility` page. |
| **Copyright and licences** | A copyright notice; every font, icon and library used within its licence. | Avoids takedown notices and licence breaches. | ✅ Archivo and Geist (SIL Open Font License), Lucide icons (ISC), npm packages under permissive licences. ❌ Add "© 2026 Got Next" to the footer. |
| **User content rights** | Terms say who owns what users upload, and grant you the right to display it. | Without this, showing someone's poster or profile is legally murky. | ✅ Covered in the terms ("What you post"). |
| **Trademark** | The name doesn't infringe an existing mark in your class. | Rebranding after launch is expensive. | ❌ Search the **IP India** trademark database for "Got Next" in classes 9, 41 and 42 before investing in the brand, and secure the domain. |

---

## How to use this

1. Clear the **launch blockers** at the top.
2. Re-run the automated checks before every deploy: `npm run lint`, `npm run typecheck`, `npm test`,
   `npm run test:e2e`, `npm audit --omit=dev`.
3. After the first deploy: SSL Labs, securityheaders.com, a sign-up on a real phone, an email-deliverability
   check (mail-tester.com), and a test restore from backup.
4. Revisit this list before every bigger rollout (a second college, a public launch).
