# Making sign-up work for real students

The app's code handles every auth path (email link, 6-digit code, password, Google, reset).
Three settings live in the **Supabase dashboard** and can't be set from code. Do all three before
inviting real users.

## 0. The switch

Email features are off until `AUTH_EMAIL_ENABLED=1` is set (in `.env.local` locally, and in Vercel's
environment variables in production). While off, students sign up with Google or an instant password
account and no email is ever sent. Turn it on **after** steps 1–3 below, then restart the server.

## 1. A real email sender (required)

Supabase's built-in email only delivers to **your project's team members**, a few times an hour.
Anyone else who signs up gets nothing. Plug in any SMTP provider:

**Project Settings → Authentication → SMTP Settings → Enable custom SMTP**

| Provider | Free tier | Notes |
| --- | --- | --- |
| [Brevo](https://www.brevo.com) | 300 emails/day | Verify one sender address; no domain needed to start. Host `smtp-relay.brevo.com`, port `587`, username = your Brevo SMTP login, password = an SMTP key (Brevo → SMTP & API → SMTP). |
| [Resend](https://resend.com) | 3,000/month | Needs a verified domain to email anyone other than yourself. |
| Gmail (App Password) | ~500/day | Quick for a pilot: Google Account → Security → App passwords. Host `smtp.gmail.com`, port 465. |

Set **Sender email** to the verified address and **Sender name** to `CampusSquad`.

Then raise the limit: **Authentication → Rate Limits → Rate limit for sending emails** (the default
is tiny). 30/hour is a sensible start for one campus.

## 2. Email templates that work on any device (strongly recommended)

The default templates link through Supabase with a one-time code tied to the browser that asked
for the email. Students often open mail on their phone, or in Gmail's in-app browser, and get
"link opened in a different browser". These templates send a token the app verifies itself
(`/auth/confirm`), so the link works anywhere — and they include a 6-digit code the sign-in page
accepts as a fallback.

**Authentication → Emails → Templates**

**Magic Link** — subject `Your CampusSquad sign-in`

```html
<h2>Sign in to CampusSquad</h2>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Sign in</a></p>
<p>Or type this code on the sign-in page: <strong style="font-size:20px;letter-spacing:4px">{{ .Token }}</strong></p>
<p style="color:#666">The link and code expire in an hour. If you didn't ask for this, ignore it.</p>
```

**Confirm signup** — subject `Confirm your CampusSquad account`

```html
<h2>Welcome to CampusSquad</h2>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Confirm my email</a></p>
<p>Or type this code on the sign-in page: <strong style="font-size:20px;letter-spacing:4px">{{ .Token }}</strong></p>
```

**Reset Password** — subject `Reset your CampusSquad password`

```html
<h2>Reset your password</h2>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Choose a new password</a></p>
<p style="color:#666">If you didn't ask for this, you can ignore it — your password won't change.</p>
```

`{{ .RedirectTo }}` is always `https://<your site>/auth/confirm?next=…`, set by the app, so
appending `&token_hash=…` keeps the destination the student was heading to.

## 3. URLs

**Authentication → URL Configuration**

- **Site URL:** your production URL, e.g. `https://campussquad.vercel.app`
- **Redirect URLs:** add `https://<your site>/auth/confirm` and `http://localhost:3000/auth/confirm`
  (keep `/auth/callback` too if you added it earlier — the app still accepts it).

## Optional: Google sign-in

See the README → *Google sign-in*. The Google button appears automatically once the provider is
enabled.

## Check it

1. Open the site in a private window → **Sign in** → enter a non-team email → **Email me a sign-in link**.
2. Open the email **on your phone** and tap the link → you should land on profile setup.
3. Try the 6-digit code instead on another attempt.
4. **Password** tab → **Forgot password?** → the reset link should open "Set a new password".

If a step fails, the sign-in page shows the reason (rate limit, sender not set up, expired link).
