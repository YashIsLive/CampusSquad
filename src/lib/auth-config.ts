/**
 * Email-based auth (magic links, codes, confirmation and reset emails) needs an SMTP sender in
 * Supabase. Until one is set up it stays off; set AUTH_EMAIL_ENABLED=1 to turn it back on
 * (see docs/AUTH_SETUP.md). Google and instant password sign-up work either way.
 */
export function emailAuthEnabled() {
  return process.env.AUTH_EMAIL_ENABLED === "1";
}

/**
 * Seed and test accounts use *.seed.test addresses, which can't receive mail. Never send to them:
 * a bounce counts against the email sender's reputation.
 */
export function isUndeliverable(email: string) {
  return email.trim().toLowerCase().endsWith(".seed.test");
}
