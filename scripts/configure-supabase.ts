/**
 * Applies Got Next's production auth settings to a Supabase project through the Management API,
 * then reads them back to confirm. Run from your own machine; nothing here is stored anywhere.
 *
 *   npm run supabase:configure                    # apply everything (reads .env.production.local)
 *   npm run supabase:configure -- --dry-run       # show what would change, change nothing
 *   npm run supabase:configure -- --pause-signups # incident switch: no new accounts (incl. Google)
 *   npm run supabase:configure -- --resume-signups
 *   npm run supabase:configure -- --env .env.other
 *
 * Needs, in the env file or your shell:
 *   SUPABASE_ACCESS_TOKEN   personal access token (supabase.com/dashboard/account/tokens)
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SITE_URL
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SENDER_EMAIL   (Brevo → SMTP & API)
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET                          (optional: Google sign-in)
 */
import { readFileSync } from "node:fs";
import { config } from "dotenv";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const envFile = args.includes("--env") ? args[args.indexOf("--env") + 1] : ".env.production.local";
config({ path: envFile, quiet: true });

const API = "https://api.supabase.com/v1";
const need = (key: string) => {
  const v = process.env[key];
  if (!v) {
    console.error(`✗ ${key} is missing (looked in ${envFile} and your shell).`);
    process.exit(1);
  }
  return v;
};

async function main() {
  const token = need("SUPABASE_ACCESS_TOKEN");
  const supabaseUrl = need("NEXT_PUBLIC_SUPABASE_URL");
  const ref = process.env.SUPABASE_PROJECT_REF ?? new URL(supabaseUrl).hostname.split(".")[0];
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // Incident switches only touch sign-ups.
  if (flag("pause-signups") || flag("resume-signups")) {
    const disable = flag("pause-signups");
    await patch(ref, headers, { disable_signup: disable });
    console.log(disable ? "✓ New sign-ups are paused in Supabase (Google included)." : "✓ New sign-ups are open again.");
    return;
  }

  const site = need("NEXT_PUBLIC_SITE_URL").replace(/\/$/, "");
  if (!site.startsWith("https://")) console.warn(`! NEXT_PUBLIC_SITE_URL is ${site}, not https. Fine for a test project only.`);
  const template = (name: string) => readFileSync(`supabase/templates/${name}.html`, "utf8");

  const body: Record<string, unknown> = {
    // Where sign-in links may send people.
    site_url: site,
    uri_allow_list: [`${site}/auth/confirm`, `${site}/auth/callback`, ...(flag("include-localhost") ? ["http://localhost:3000/auth/confirm"] : [])].join(","),
    // Sign-up confirms the address by email.
    external_email_enabled: true,
    mailer_autoconfirm: false,
    disable_signup: false,
    // Passwords: matches the app's rule (10+ characters, a letter and a number).
    password_min_length: 10,
    password_hibp_enabled: true,
    // Two-step sign-in (authenticator apps).
    mfa_totp_enroll_enabled: true,
    mfa_totp_verify_enabled: true,
    // Sessions: 1-hour access tokens, rotating refresh tokens with reuse detection.
    jwt_exp: 3600,
    refresh_token_rotation_enabled: true,
    security_refresh_token_reuse_interval: 10,
    // One-time codes: 6 digits, valid for an hour (the templates say so).
    mailer_otp_length: 6,
    mailer_otp_exp: 3600,
    // Rate limits (Supabase defines the time window for each; see Auth → Rate Limits): enough for a
    // campus launch, low enough to stop abuse.
    rate_limit_email_sent: 60,
    rate_limit_otp: 30,
    rate_limit_verify: 30,
    rate_limit_token_refresh: 150,
    // Our own email sender.
    smtp_host: need("SMTP_HOST"),
    smtp_port: need("SMTP_PORT"),
    smtp_user: need("SMTP_USER"),
    smtp_pass: need("SMTP_PASS"),
    smtp_admin_email: need("SMTP_SENDER_EMAIL"),
    smtp_sender_name: process.env.SMTP_SENDER_NAME ?? "Got Next",
    // Emails that work on any device and include a typed code.
    mailer_subjects_magic_link: "Your Got Next sign-in",
    mailer_templates_magic_link_content: template("magic-link"),
    mailer_subjects_confirmation: "Confirm your Got Next account",
    mailer_templates_confirmation_content: template("confirmation"),
    mailer_subjects_recovery: "Reset your Got Next password",
    mailer_templates_recovery_content: template("recovery"),
  };
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    Object.assign(body, {
      external_google_enabled: true,
      external_google_client_id: process.env.GOOGLE_CLIENT_ID,
      external_google_secret: process.env.GOOGLE_CLIENT_SECRET,
    });
  }

  if (flag("dry-run")) {
    const shown = Object.fromEntries(Object.entries(body).map(([k, v]) => [k, /pass|secret/.test(k) ? "••••" : typeof v === "string" && v.length > 80 ? `${v.slice(0, 60)}…` : v]));
    console.log(`Would apply to project ${ref}:\n`, shown);
    return;
  }

  try {
    await patch(ref, headers, body);
  } catch (e) {
    // Leaked-password checks need a paid plan; apply everything else and say so.
    if (String(e).toLowerCase().includes("hibp") || String(e).toLowerCase().includes("pro plan")) {
      console.warn("! Leaked-password protection needs the Pro plan; applying the rest without it.");
      delete body.password_hibp_enabled;
      await patch(ref, headers, body);
    } else throw e;
  }

  // Read back and compare (secrets excluded).
  const res = await fetch(`${API}/projects/${ref}/config/auth`, { headers });
  if (!res.ok) throw new Error(`Couldn't read the settings back: ${res.status} ${await res.text()}`);
  const now = (await res.json()) as Record<string, unknown>;
  let mismatches = 0;
  for (const [key, want] of Object.entries(body)) {
    if (/pass|secret|templates/.test(key)) continue;
    const ok = String(now[key]) === String(want);
    if (!ok) mismatches++;
    console.log(`${ok ? "✓" : "✗"} ${key}${ok ? "" : `  (wanted ${String(want)}, got ${String(now[key])})`}`);
  }
  console.log(mismatches ? `\n${mismatches} setting(s) didn't take. Check them in the dashboard.` : `\n✓ Project ${ref} is configured.`);
  if (mismatches) process.exit(1);
}

async function patch(ref: string, headers: Record<string, string>, body: Record<string, unknown>) {
  const res = await fetch(`${API}/projects/${ref}/config/auth`, { method: "PATCH", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Supabase rejected the update: ${res.status} ${await res.text()}`);
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
