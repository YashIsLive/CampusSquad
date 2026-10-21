# Going live — step by step

Everything needed to put Got Next on the internet for real students, in order. Most steps are clicks in
someone's dashboard; the commands do the rest. Plan for **one focused day**, plus waiting time for DNS
and email verification.

You'll fill in one file as you go: **`.env.production.local`** (copy it from `.env.production.example`).
It's git-ignored. **Never paste its contents into chat, screenshots or tickets.**

```bash
cp .env.production.example .env.production.local
```

At any point, see what's still missing:

```bash
npm run check:launch -- --skip-site
```

---

## 0. Decide first (30 minutes)

| Decision | Why it matters | Suggestion |
| --- | --- | --- |
| **Domain name** | It's on every link, email and poster. | `gotnext.in` or `gotnext.app` style. Check availability. |
| **Who runs Got Next** (legal entity) | Named in the privacy policy as the "data fiduciary". | You personally for a pilot, or a registered company/LLP if you plan to grow. Need a postal address. |
| **Grievance officer** | Required by the IT Rules 2021; named on the site. | You, for the pilot. |
| **Contact inbox** | Complaints and data requests go here; must be read daily. | `hello@<domain>` forwarding to your phone. |
| **Pilot college** | The first students; their email domain enables automatic verification. | One college, one club, one event in the next 4–6 weeks. |
| **17-year-old first-years** | The law requires parental consent under 18. | Keep them out for the pilot (current behaviour). |
| **Budget** | Some services need a paid plan for production. | See below. |

**Monthly cost for a pilot**

| Service | Plan | Cost | Why |
| --- | --- | --- | --- |
| Supabase | **Pro** | ~$25/month | Daily backups, no pausing after inactivity, leaked-password checks. **Don't launch on Free.** |
| Vercel | Hobby (free) for a non-commercial student pilot; **Pro** ($20/month) if you charge money or run it as a business | $0–20 | Hobby is for non-commercial use only. |
| Domain | — | ~₹800–1,500/year | |
| Brevo (email) | Free | $0 | 300 emails/day; upgrade if you grow. |
| Cloudflare (DNS, Turnstile) | Free | $0 | |
| Sentry | Developer (free) | $0 | 5k errors/month. |
| Uptime monitor | Free tier | $0 | Better Stack or UptimeRobot. |

---

## 1. Domain and DNS (15 minutes + waiting)

1. Buy the domain. **Cloudflare Registrar** is cheapest and keeps DNS, Turnstile and the domain in one
   place; any registrar works.
2. Put the domain's DNS on Cloudflare (Cloudflare → Add a site → Free plan → change nameservers at your
   registrar if you bought it elsewhere). DNS changes can take a few hours.
3. Set `NEXT_PUBLIC_SITE_URL=https://<your-domain>` in `.env.production.local`.

## 2. Supabase production project (20 minutes)

1. supabase.com → **New project**. Name: `got-next-prod`. **Region: South Asia (Mumbai)**. Generate a
   strong database password and save it in your password manager.
2. **Upgrade to Pro** (Organization → Billing).
3. Copy into `.env.production.local`:
   - Project Settings → API: **URL** → `NEXT_PUBLIC_SUPABASE_URL`, **anon/publishable key** →
     `NEXT_PUBLIC_SUPABASE_ANON_KEY`, **service_role/secret key** → `SUPABASE_SERVICE_ROLE_KEY`.
   - Connect (top bar) → **Transaction pooler** string → `DATABASE_URL`; **Session pooler** string →
     `DIRECT_URL`. Put your database password into both.
4. Project Settings → Database → **SSL enforcement: on** (only encrypted connections).
5. Create the tables, security rules and storage buckets:
   ```bash
   npm run db:migrate:prod
   ```
6. Add the colleges students can choose. Copy `data/colleges.example.json` to `data/colleges.json`, list
   your pilot college(s), and **check each `emailDomain` with the college** (use `null` if students
   don't get college email addresses; they can verify with their student ID instead). Then:
   ```bash
   npm run colleges:import -- data/colleges.json
   ```
7. **Never run `npm run db:seed` against production.**

## 3. Email sending with Brevo (30 minutes + DNS wait)

1. In Brevo → **Senders, Domains & Dedicated IPs → Domains → Add a domain**: your domain. Brevo shows DNS
   records (DKIM, Brevo code, and usually SPF). Add them in Cloudflare DNS exactly as shown, then click
   **Verify** in Brevo.
2. Add a **DMARC** record in Cloudflare DNS: name `_dmarc`, type TXT, value
   `v=DMARC1; p=none; rua=mailto:<your contact email>`. After a few weeks of clean reports, change
   `p=none` to `p=quarantine`.
3. Brevo → Senders → add `hello@<your-domain>` (or similar) as a sender.
4. Brevo → **SMTP & API → SMTP → Generate a new SMTP key**. Put into `.env.production.local`:
   `SMTP_USER` (the SMTP login shown there), `SMTP_PASS` (the key), `SMTP_SENDER_EMAIL`
   (`hello@<your-domain>`). Host and port are already filled in.

## 4. Google sign-in (optional, 20 minutes; recommended)

1. console.cloud.google.com → new project `Got Next`.
2. **APIs & Services → OAuth consent screen**: External; app name **Got Next**; support email; app
   logo (`/pwa-icon/512` from your site); **App domain**: `https://<your-domain>`, privacy policy
   `https://<your-domain>/privacy`, terms `https://<your-domain>/terms`; authorised domain
   `<your-domain>`. Scopes: only the defaults (email, profile, openid). **Publish** the app.
3. **Credentials → Create credentials → OAuth client ID → Web application.** Authorised redirect URI:
   `https://<your-supabase-ref>.supabase.co/auth/v1/callback`.
4. Copy the client ID and secret into `.env.production.local` as `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`.

## 5. Apply all Supabase auth settings (5 minutes)

1. supabase.com/dashboard/account/tokens → **Generate new token** (name: `got-next-setup`) →
   `SUPABASE_ACCESS_TOKEN` in `.env.production.local`.
2. Preview, then apply:
   ```bash
   npm run supabase:configure -- --dry-run
   npm run supabase:configure
   ```
   This sets the site URL and allowed redirects, your SMTP sender, the three email templates (with
   6-digit codes), the 10-character password rule, leaked-password checks, two-step sign-in, session
   and rate-limit settings, and Google sign-in, then reads them back and confirms each one.
3. Revoke the access token afterwards if you like (you can make a new one when needed).

## 6. Cloudflare Turnstile (5 minutes)

Cloudflare dashboard → **Turnstile → Add widget**: name `Got Next`, hostname `<your-domain>`, widget
mode **Managed**. Copy the **site key** → `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and **secret key** →
`TURNSTILE_SECRET_KEY`.

## 7. Sentry (10 minutes)

1. sentry.io → create an organization (data region: EU or US) → **Create project → Next.js** → name
   `got-next`.
2. Project Settings → Client Keys (DSN) → `NEXT_PUBLIC_SENTRY_DSN`. Organization slug → `SENTRY_ORG`,
   project slug → `SENTRY_PROJECT`.
3. Settings → Auth Tokens → create an organization token → `SENTRY_AUTH_TOKEN` (lets builds upload
   source maps so errors show real line numbers).
4. Alerts → create an alert: "a new issue is created" → email (and the Sentry mobile app).

## 8. The rest of the settings (5 minutes)

In `.env.production.local`:
```bash
npm run secret   # → AUTH_DEVICE_SECRET
npm run secret   # → CRON_SECRET
```
Then fill `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_GRIEVANCE_OFFICER` (a person's name) and
`NEXT_PUBLIC_LEGAL_ENTITY` (legal name and postal address). Make sure `E2E_TEST_LOGIN` is **not** in the
file.

Check:
```bash
npm run check:launch -- --skip-site
```
Everything except the admin should be green now.

## 9. Vercel (20 minutes)

1. vercel.com → **Add New → Project → Import** `YashIsLive/CampusSquad` from GitHub. Framework: Next.js
   (detected). Don't deploy yet if it offers; set variables first.
2. **Settings → Environment Variables**: use **Import .env** and paste the **top part** of
   `.env.production.local` (everything above the "ONLY for running scripts" line). Environment:
   **Production**. Never add `SUPABASE_ACCESS_TOKEN`, `SMTP_*` or `GOOGLE_*` to Vercel; Supabase holds
   those.
3. **Deploy.** The build refuses to start if a required setting is missing or unsafe; the error says
   which.
4. **Settings → Domains → Add** `<your-domain>` (and `www.<your-domain>` redirecting to it). Add the DNS
   records Vercel shows in Cloudflare, with the **proxy off (grey cloud, "DNS only")**. Vercel issues the
   HTTPS certificate automatically.
5. **Settings → Functions**: region should show **Mumbai (bom1)** (set in `vercel.json`).
6. **Settings → Billing → Spend Management**: set a limit and an alert.
7. **Firewall** (Pro): add a rate-limit rule for `/login` (for example 30 requests/minute per IP).
8. **Log drain** (for the 180-day log retention CERT-In expects): Settings → Log Drains → connect Better
   Stack (Logtail) or Axiom on a plan that keeps 180 days. Optional for a tiny pilot; required as you grow.

## 10. Make yourself the admin (5 minutes)

1. Open `https://<your-domain>`, sign up with your real email, confirm with the code, complete your
   profile (including the 18+ box).
2. On your machine:
   ```bash
   npm run make-admin:prod -- you@example.com
   ```
3. Sign out and back in. Open **Admin**: it asks you to set up **two-step sign-in** first. Do it with an
   authenticator app, and **save the setup key in your password manager** in case you lose your phone.

## 11. Check everything (30 minutes)

```bash
npm run check:launch
```
Fix anything red. Then by hand, on a **phone** on mobile data:

- [ ] Sign up with a new email: code arrives within a minute, not in spam.
- [ ] Sign in with Google (if set up).
- [ ] Sign in with a password in a private window: asks for an email code (new device); second time on
      the same browser doesn't.
- [ ] Forgot password: reset link works.
- [ ] Post an event as a club (needs a verified student: approve yourself via Admin → People → Verify).
- [ ] Register, join a team, message a team lead, report something, then close the report as admin.
- [ ] Download my data; delete a **test** account.
- [ ] Turn on maintenance mode, check the "back soon" page, turn it off (practice for incidents).

External scanners:
- [ ] **ssllabs.com/ssltest**: grade A or A+.
- [ ] **securityheaders.com**: grade A.
- [ ] **mail-tester.com**: send a sign-in email to the address it gives you; aim for 9/10+.

## 12. Monitoring and backups (20 minutes)

1. **Uptime:** Better Stack or UptimeRobot → new HTTP monitor on `https://<your-domain>/api/health`,
   every 3–5 minutes, alerts to your phone. (It returns 503 if the database is unreachable.)
2. **Backups:** Supabase → Database → Backups: confirm daily backups are listed (Pro).
3. **Restore drill** (once before launch): create a scratch Supabase project, then copy production into it:
   ```bash
   npx supabase db dump --db-url "<production DIRECT_URL>" -f backup.sql
   psql "<scratch project DIRECT_URL>" -f backup.sql
   ```
   (needs PostgreSQL's `psql`). Open the scratch database and check your tables have rows. Delete the
   dump file afterwards; it contains personal data.

## 13. GitHub (10 minutes)

1. Repository → Settings → **Code security**: turn on Dependabot alerts and security updates, and secret
   scanning.
2. Settings → **Branches → Add rule** for `main`: require the CI check to pass before merging.
3. Optional: add `TEST_DATABASE_URL` and the Supabase keys of a **separate test project** as Actions
   secrets so CI runs the database tests too.

## 14. Paperwork (before inviting students)

- [ ] Lawyer reviews `/privacy` and `/terms` (and this incident plan).
- [ ] Fill in the contacts table in `docs/INCIDENT_RESPONSE.md` and keep a copy on your phone.
- [ ] Accept the data processing agreements: Supabase (Organization → Legal Documents), Vercel (Legal →
      DPA), Brevo (account settings).
- [ ] Search **IP India** (ipindiaonline.gov.in) for "Got Next" in classes 9, 41 and 42 before printing
      posters.
- [ ] Practise one incident (docs/INCIDENT_RESPONSE.md §9).

## 15. Launch day

1. **Soft launch:** the pilot club posts its event and shares the tracked link from the Share kit in its
   groups. Don't announce more widely yet.
2. **Watch:** Sentry, the uptime monitor, Admin → Overview and Reports, Brevo's daily count (300/day on
   the free plan; upgrade before a big announcement).
3. **Be reachable:** someone checks the contact inbox and Reports at least twice a day.
4. **After the event:** look at the dashboard funnel, talk to 5–10 students, write down the top three
   problems, fix them, then invite the next club.

## Rolling back

- **Code:** Vercel → Deployments → a good deployment → **Promote to Production**. Takes seconds.
- **Database:** migrations only move forward. Take a backup (Supabase → Backups, or the dump command
  above) **before** every `npm run db:migrate:prod`, and read the new migration's SQL first.

## Every week after launch

- Sentry: any new issues?
- `npm run check:launch`: still green?
- Dependabot pull requests: merge after CI passes.
- Reports and the contact inbox: anything older than 24 hours?
