# Incident response plan — Got Next

What to do when something goes wrong: a data leak, a hacked account, a leaked key, harmful content,
an outage. Written for a small team. **Print it, fill in the contacts, and practise it once before launch.**

> If you're reading this during an incident: go to [First 15 minutes](#first-15-minutes).

---

## 1. People and contacts

Fill this in before launch. Keep a copy outside Got Next (on your phone), because the site or your email
might be what's broken.

| Role | Who | Phone | Email | Backup |
| --- | --- | --- | --- | --- |
| **Incident lead**: makes decisions, owns the timeline | | | | |
| **Technical responder**: Vercel, Supabase, keys | | | | |
| **Grievance officer**: user complaints, the 24 h / 15 day clock | | | | |
| **Legal advisor**: breach notifications, police, takedown orders | | | | |
| **College / pilot club contact** | | | | |

**Outside contacts**

| Who | How | When |
| --- | --- | --- |
| **CERT-In** (India's computer emergency team) | incident@cert-in.org.in · +91-1800-11-4949 · cert-in.org.in | Reportable cyber incidents, **within 6 hours** of noticing (see §5) |
| **Data Protection Board of India** | via the Board's online portal | Personal data breaches, **without delay**, then a full report **within 72 hours** (see §5) |
| **Supabase support** | supabase.com/dashboard/support (Pro plan: priority) | Database or auth problems on their side |
| **Vercel support** | vercel.com/help | Hosting problems |
| **Cyber crime police** | cybercrime.gov.in · helpline 1930 | Fraud, extortion, threats to students |

**Logins you'll need** (in a password manager with two-step sign-in on every one): Supabase, Vercel,
GitHub, Cloudflare, Brevo, Sentry, Google Cloud, the domain registrar, and the shared inbox.

---

## 2. How bad is it?

Decide the severity in the first 15 minutes. You can raise it later; don't argue about it.

| Severity | Examples | Respond | Who to tell |
| --- | --- | --- | --- |
| **SEV 1: critical** | Personal data leaked or likely leaked (database, emails, ID photos); the service-role key or database password exposed; an admin account taken over; a student in danger | **Now, round the clock** | Whole team, legal, CERT-In (6 h), Data Protection Board and affected users (without delay) |
| **SEV 2: serious** | One user account taken over; a bot wave creating fake accounts; site down during a live event; harmful content spreading; a leaked key that can't reach personal data | **Within 1 hour** | Incident lead, technical responder, grievance officer |
| **SEV 3: minor** | A bug, a broken page, slow pages, a single spam report, email delays | **Same or next working day** | Whoever's on duty |

**When in doubt, treat it as one level higher.** Downgrading later is cheap; under-reacting to a breach isn't.

---

## 3. First 15 minutes

1. **Start a log.** One shared document: time (IST), what you saw, what you did, who did it. Write as you
   go. You will need it for the regulators and for yourself.
2. **Name an incident lead.** One person decides. Others do.
3. **Set the severity** (§2).
4. **Contain** before investigating. Use the emergency switches if they help:

   | Switch | How | Effect |
   | --- | --- | --- |
   | **Maintenance mode** | Vercel → Settings → Environment Variables: `MAINTENANCE_MODE=1` → Deployments → Redeploy | Whole site shows "Back in a few minutes" (503). Health checks keep working. ~1 minute. |
   | **Pause sign-ups** | `SIGNUPS_PAUSED=1` in Vercel + redeploy, **and** `npm run supabase:configure -- --pause-signups` | Nobody new can sign up (including via Google and Supabase's API). Existing users carry on. |
   | **Roll back** | Vercel → Deployments → a known-good deployment → "Promote to Production" (Instant Rollback) | Previous version of the code, in seconds. Doesn't undo database changes. |
   | **Sign everyone out** | See §6 | Every session ends; people sign in again. |
   | **Rotate a key** | See §6 | Old key stops working. |

5. **Preserve evidence.** Don't delete logs, users or rows yet. Take screenshots, export the Vercel
   function logs for the time window, note IP addresses and timestamps.
6. **Start the clocks** if personal data might be involved: CERT-In 6 hours, Data Protection Board
   "without delay" + 72 hours (§5).

---

## 4. Playbooks

Each playbook: **signs → contain → fix → recover → tell**. Use the ones that apply.

### 4.1 Personal data breach (SEV 1)
*Someone saw, copied or changed personal data they shouldn't have: profiles, emails, messages, ID photos.*

- **Signs:** data posted somewhere; unusual queries or traffic in Supabase logs; a researcher's email;
  the API-lockdown tests failing; a user reporting they can see someone else's data.
- **Contain:** maintenance mode if the leak is ongoing. Rotate whatever let them in: service-role key,
  database password, a specific admin's access (§6). If a code path is at fault, roll back.
- **Find the scope:** which tables, which people, what time window. Supabase → Logs (API, Postgres, Auth),
  Vercel → Logs, Sentry. Write down **how many people** and **which data**.
- **Fix:** patch the cause, add a test that would have caught it (`tests/api-security.test.ts` is the
  place for access-control holes), deploy, then turn maintenance mode off.
- **Tell:** CERT-In within 6 hours; Data Protection Board and **every affected person** without delay;
  the detailed Board report within 72 hours (§5). Templates in §7.

### 4.2 Leaked secret or key (SEV 1 if it can reach personal data, else SEV 2)
*A key in a public repo, a screenshot, a chat, a laptop that was stolen.*

| Leaked | Severity | Do this |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` / secret key | **SEV 1** (bypasses all access rules) | Rotate it now (§6), redeploy, then follow 4.1 to check whether it was used. |
| Database password (`DATABASE_URL`, `DIRECT_URL`) | **SEV 1** | Reset it (§6), update Vercel, redeploy, then 4.1. |
| `SUPABASE_ACCESS_TOKEN` (your account token) | **SEV 1** | Revoke at supabase.com/dashboard/account/tokens; check the project's settings weren't changed. |
| Brevo SMTP key | SEV 2 | Delete the key in Brevo, create a new one, `npm run supabase:configure`. Check Brevo logs for spam sent from your domain. |
| `AUTH_DEVICE_SECRET` | SEV 2 | New value (`npm run secret`) in Vercel, redeploy. Every remembered device has to confirm by email again. |
| `TURNSTILE_SECRET_KEY` | SEV 2 | Rotate in Cloudflare → Turnstile, update Vercel, redeploy. |
| `CRON_SECRET` | SEV 3 | New value, redeploy. Worst case: someone triggered reminder emails. |
| Google client secret | SEV 2 | Reset in Google Cloud → Credentials, then `npm run supabase:configure`. |
| `SENTRY_AUTH_TOKEN`, `GITHUB_TOKEN` | SEV 3 | Revoke and create new ones. |
| Anon key / Turnstile site key | Not secret | These are public by design. |

**Always:** remove the secret from wherever it leaked (and from git history if committed: rotate first,
then clean history). A rotated key is safe even if the old copy stays public.

### 4.3 Admin account taken over (SEV 1)
*Admins can see emails, approve colleges, verify students, take events down, review ID photos.*

- **Contain:** remove admin access from that account (another admin: Admin → People → "Remove admin"; or
  `npm run make-admin:prod -- their@email --revoke`). Sign that person out everywhere (§6). Reset their
  password and two-step sign-in.
- **Check what they did:** Admin → Reports (recently closed), Events (taken down), People (who was made
  admin or verified), verification requests reviewed. Undo anything wrong.
- **Ask how:** phishing? reused password? shared device? Admins must use two-step sign-in (the app
  enforces it in production) and a password manager.
- **Tell:** if they viewed personal data or ID photos, this is a data breach (4.1).

### 4.4 A student's account taken over (SEV 2)
- **Contain:** sign them out everywhere (§6, one user), reset their password through the dashboard,
  remove their two-step factor if the attacker added one (Supabase → Authentication → Users → the user).
- **Undo:** applications, messages, team changes made by the attacker.
- **Prevent:** suggest two-step sign-in. If many accounts fall the same way, it's a pattern: SEV 1.

### 4.5 Student ID photos exposed (SEV 1)
*The most sensitive data Got Next holds, even though photos are deleted after review.*
- **Check:** the `id-cards` bucket must be private (`npm run check:launch` verifies). Look at
  Supabase → Storage logs for unexpected reads. Signed links last 10 minutes; a leaked link dies quickly.
- **Contain:** if a reviewer misused access, remove them as a reviewer (unverify their club or remove their
  club admin role) and follow 4.3.
- **Tell:** follow 4.1; ID documents make it serious for the people affected.

### 4.6 Bot wave, fake accounts or spam (SEV 2)
- **Signs:** sudden spike in sign-ups (Admin → Overview "+N this week"), reports of spam events or
  messages, Brevo daily limit hit.
- **Contain:** pause sign-ups (§3). Check Turnstile is configured (`npm run check:launch`). Take spam
  events down (Admin → Events).
- **Clean up:** delete the fake accounts in Supabase → Authentication (filter by creation time).
- **Prevent:** tighten Supabase rate limits; add a Vercel Firewall rate-limit rule on `/login`.

### 4.7 Harmful content or harassment (SEV 2; SEV 1 if someone may be in danger)
- **Deadlines (IT Rules 2021):** acknowledge complaints within **24 hours**, resolve within **15 days**.
  Content that shows nudity or sexual acts, or **impersonates someone**, must come down within **24
  hours** of a complaint.
- **Act:** Admin → Reports. Take events down; contact or remove the account; keep a record of what was
  removed and why (screenshots, IDs) for at least 180 days.
- **If someone is at risk** (threats, self-harm, stalking): contact the student's college and, where
  needed, police (112 / 1930 for cyber crime). Don't wait for the 15-day clock.
- **Court or government orders** to remove content: act within the deadline on the order (often 36
  hours or less) and involve your legal advisor.

### 4.8 Site down or broken (SEV 2 during a live event, else SEV 3)
- **Check:** your uptime monitor, `/api/health` (503 means the database is unreachable), Vercel status
  (vercel-status.com), Supabase status (status.supabase.com), Sentry for new errors.
- **Bad deploy?** Instant Rollback (§3).
- **Database down?** Supabase status / support; there's nothing to do in the app.
- **Live event at risk?** Tell the organizers: entry codes are also in their CSV export, and check-in can
  be done from the People list.

### 4.9 Emails not arriving (SEV 2 if people can't sign in)
- **Check:** Brevo → Transactional → Logs (bounced? blocked? daily limit?), Supabase → Auth logs (SMTP
  errors), mail-tester.com for spam score, your domain's SPF/DKIM/DMARC records.
- **Workaround:** people with Google accounts can sign in with Google; people on a trusted device can sign
  in with a password.

### 4.10 A migration or script damaged data (SEV 1 if data is lost)
- **Stop** whatever is writing. Maintenance mode if users are affected.
- **Restore:** Supabase → Database → Backups (daily) or point-in-time recovery to just before the damage,
  **into a new project first** if you only need some tables back. Never restore over production without
  copying the current state first.
- **Prevent:** take a backup before every migration (`npm run db:migrate:prod` only after checking the
  migration SQL).

### 4.11 An admin lost their two-step device (SEV 3)
- Confirm it's really them (video call or in person). Then Supabase → Authentication → Users → the
  user → remove the MFA factor. They set it up again on next sign-in.

---

## 5. Who must be told, and when

Not legal advice: confirm with your legal advisor. But don't wait for them to start the clocks.

| Who | When | Applies to | What |
| --- | --- | --- | --- |
| **CERT-In** | **Within 6 hours** of noticing | Reportable cyber incidents under the CERT-In Directions (April 2022), including data breaches and leaks, unauthorised access to systems or accounts, and attacks on applications. | Email incident@cert-in.org.in with the incident reporting form from cert-in.org.in. Send what you know; update later. |
| **Data Protection Board of India** | **Without delay**, then a **detailed report within 72 hours** | Any personal data breach (DPDP Act 2023, DPDP Rules 2025). | First notice: what happened, when, likely impact. Detailed report: facts, cause, people and data affected, what you did, what you'll do to stop it recurring, how you've informed people. |
| **Affected students** | **Without delay** | Any personal data breach affecting them. | In plain language: what happened, what data, what it means for them, what you're doing, what they should do, and who to contact (template below). |
| **Pilot college / clubs** | Same day for SEV 1 | Anything affecting their students or events. | A short call or email, then the user notice. |
| **Everyone on the site** | When it helps | Outages, maintenance. | A banner or a post from the club's channels. |

Keep logs and records of incidents for at least **180 days** (CERT-In). Vercel's built-in logs don't keep
that long; add a log drain before launch (docs/GO_LIVE.md, step 12).

---

## 6. Technical procedures

**Rotate the Supabase secret (service-role) key.** Supabase → Project Settings → API Keys. With the
newer keys: create a new **secret** key, put it in Vercel as `SUPABASE_SERVICE_ROLE_KEY`, redeploy, then
delete the old key. With legacy JWT keys: "Generate new JWT secret" replaces both keys **and signs
everyone out**; update `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, then redeploy.

**Reset the database password.** Supabase → Project Settings → Database → Reset database password.
Update `DATABASE_URL` and `DIRECT_URL` in Vercel and in `.env.production.local`, then redeploy.

**Sign everyone out.** Supabase → SQL editor:
```sql
delete from auth.refresh_tokens;
delete from auth.sessions;
```
Access tokens stay valid until they expire (at most 1 hour). To also cut those off, rotate the JWT
secret (above). To make every browser confirm by email again, change `AUTH_DEVICE_SECRET` and redeploy.

**Sign out one person.** Supabase → SQL editor (replace the email):
```sql
delete from auth.sessions where user_id = (select id from auth.users where email = 'someone@example.com');
delete from auth.refresh_tokens where user_id = (select id::text from auth.users where email = 'someone@example.com');
```

**Find what an account did.** Supabase → SQL editor, for a user id: their applications, messages,
events, reports. Supabase → Logs → Auth for sign-in times and IPs.

**Export logs before they expire.** Vercel → Logs (filter by time, export), Supabase → Logs Explorer,
Sentry issue pages. Save them with the incident log.

---

## 7. Message templates

**To affected students** (email from the contact address; adapt the parts in brackets):

> Subject: Important: your Got Next account and [what happened]
>
> Hi [name],
>
> On [date], we found that [what happened, in one plain sentence]. This affected [what data: for example,
> your email address and profile]. [It did / did not] include passwords, which we never store in readable form.
>
> What we've done: [contained it how], and we've reported it to the Data Protection Board of India and
> CERT-In.
>
> What you can do: [for example, watch for emails pretending to be Got Next; change your password if you
> use it elsewhere; turn on two-step sign-in in Account and privacy].
>
> We're sorry. If you have questions, reply to this email or contact our grievance officer, [name], at
> [email]. You can also complain to the Data Protection Board of India.
>
> [Name], Got Next

**Status banner / social post:** "Got Next is down for maintenance while we fix a problem. Your account
and teams are safe. We'll be back shortly and will post an update here."

**CERT-In first report:** organisation and contact; date and time noticed; type of incident; systems
affected (Vercel-hosted web app, Supabase Postgres and storage, Mumbai region); what's known so far;
actions taken; whether personal data is involved.

---

## 8. After the incident

Within a week, write a short review (no blame):

1. **Timeline:** from the log.
2. **Impact:** who and what was affected, and for how long.
3. **Cause:** the real one, not just the trigger.
4. **What went well, what didn't** in the response.
5. **Actions:** each with an owner and a date. At least one should be a test or check that would have
   caught it (add it to `npm test`, the e2e suite or `npm run check:launch`).

Keep the review with the incident log for at least 180 days.

---

## 9. Practice

- **Before launch:** walk through 4.2 (leaked key) for real: rotate `CRON_SECRET` and
  `AUTH_DEVICE_SECRET` on production, redeploy, confirm the site works. Turn maintenance mode on and off
  once. Time both.
- **Every 3 months:** one tabletop exercise (pick a playbook, talk it through), and check the contacts
  table is still right.
- **Every 6 months:** a backup restore into a scratch project.
