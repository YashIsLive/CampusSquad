/**
 * Pre-launch checker. Reads your production env file and checks everything that can be checked
 * from outside your accounts, then prints what's left to fix.
 *
 *   npm run check:launch                          # reads .env.production.local
 *   npm run check:launch -- --env .env.other
 *   npm run check:launch -- --skip-site           # before the first deploy
 */
import { existsSync, readFileSync } from "node:fs";
import { config, parse } from "dotenv";
import postgres from "postgres";

const args = process.argv.slice(2);
const envFile = args.includes("--env") ? args[args.indexOf("--env") + 1] : ".env.production.local";
if (!existsSync(envFile)) {
  console.error(`✗ ${envFile} not found. Copy .env.production.example to ${envFile} and fill it in (see docs/GO_LIVE.md).`);
  process.exit(1);
}
const env = parse(readFileSync(envFile));
config({ path: envFile, quiet: true, override: true });

type Result = { ok: boolean | "warn"; label: string; fix?: string };
const results: Result[] = [];
const check = (ok: boolean | "warn", label: string, fix?: string) => results.push({ ok, label, fix });

async function main() {
  // ---- Environment ----
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL", "DIRECT_URL",
    "NEXT_PUBLIC_SITE_URL", "AUTH_EMAIL_ENABLED", "AUTH_DEVICE_SECRET", "CRON_SECRET",
    "NEXT_PUBLIC_CONTACT_EMAIL", "NEXT_PUBLIC_GRIEVANCE_OFFICER", "NEXT_PUBLIC_LEGAL_ENTITY",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_SENTRY_DSN",
  ];
  for (const key of required) check(Boolean(env[key]), `${key} is set`, `Add ${key} to ${envFile}. Where to find it: docs/GO_LIVE.md.`);
  const site = (env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  check(site.startsWith("https://"), "Site URL is https", "NEXT_PUBLIC_SITE_URL must be your https domain.");
  check(!env.E2E_TEST_LOGIN, "Demo login is off (E2E_TEST_LOGIN unset)", "Remove E2E_TEST_LOGIN: it lets anyone sign in as demo users.");
  check(env.AUTH_EMAIL_ENABLED === "1", "Email sign-in is on (AUTH_EMAIL_ENABLED=1)", "Set AUTH_EMAIL_ENABLED=1 once SMTP works.");
  check(/:6543\//.test(env.DATABASE_URL ?? ""), "DATABASE_URL uses the transaction pooler (port 6543)", "Use the Transaction pooler connection string (port 6543).");
  check((env.AUTH_DEVICE_SECRET ?? "").length >= 32, "AUTH_DEVICE_SECRET is long enough", "Use a random string of 32+ characters (npm run secret).");
  check((env.CRON_SECRET ?? "").length >= 24, "CRON_SECRET is long enough", "Use a random string of 24+ characters (npm run secret).");
  check(!/example|\[/.test(env.NEXT_PUBLIC_CONTACT_EMAIL ?? "example"), "Contact email is real", "Use an inbox you read every day.");
  check(/^https:\/\/[^@]+@[^/]+\/\d+$/.test(env.NEXT_PUBLIC_SENTRY_DSN ?? ""), "Sentry DSN looks right", "Copy the DSN from Sentry → Project settings → Client keys.");
  if (existsSync(".env.local")) {
    const dev = parse(readFileSync(".env.local"));
    check(dev.NEXT_PUBLIC_SUPABASE_URL !== env.NEXT_PUBLIC_SUPABASE_URL, "Production uses its own Supabase project (not your dev one)", "Create a separate Supabase project for production.");
  }

  // ---- Database ----
  if (env.DIRECT_URL) {
    const sql = postgres(env.DIRECT_URL, { max: 1, connect_timeout: 15 });
    try {
      const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: unknown[] };
      const [{ n: applied }] = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`.catch(() => [{ n: 0 }]);
      check(applied === journal.entries.length, `All ${journal.entries.length} migrations applied (found ${applied})`, "Run: npm run db:migrate:prod");
      const buckets = await sql`select id, public, file_size_limit, allowed_mime_types from storage.buckets`;
      for (const id of ["posters", "avatars", "logos", "id-cards"]) {
        const b = buckets.find((x) => x.id === id);
        check(Boolean(b && b.file_size_limit && b.allowed_mime_types), `Storage bucket "${id}" exists with type and size limits`, "Run the migrations.");
      }
      check(buckets.find((x) => x.id === "id-cards")?.public === false, `Student ID bucket is private`, "Run the migrations.");
      const [{ n: seed }] = await sql`select count(*)::int as n from profiles where email like '%.seed.test'`.catch(() => [{ n: -1 }]);
      check(seed === 0, "No demo (seed) accounts in production", "Never run the seed on production. Delete the *.seed.test users in Supabase → Authentication.");
      const [{ n: colleges }] = await sql`select count(*)::int as n from colleges where verified`.catch(() => [{ n: 0 }]);
      check(colleges > 0, `Colleges are listed (${colleges})`, "Run: npm run colleges:import -- data/colleges.json");
      const [{ n: admins }] = await sql`select count(*)::int as n from profiles where is_admin`.catch(() => [{ n: 0 }]);
      check(admins > 0 ? true : "warn", `At least one admin (${admins})`, "Sign up on the live site, then: npm run make-admin:prod -- you@example.com");
    } catch (e) {
      check(false, "Can connect to the production database", `DIRECT_URL didn't work: ${e instanceof Error ? e.message : e}`);
    } finally {
      await sql.end();
    }
  }

  // ---- Supabase Auth (public settings) ----
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY } });
      const s = (await res.json()) as { external?: Record<string, boolean>; mailer_autoconfirm?: boolean; disable_signup?: boolean };
      check(s.mailer_autoconfirm === false, "New accounts must confirm their email", "Run: npm run supabase:configure");
      check(s.disable_signup === false, "Sign-ups are open", "If you paused them during an incident: npm run supabase:configure -- --resume-signups");
      check(s.external?.google ? true : "warn", "Google sign-in is on", "Optional but recommended: set GOOGLE_CLIENT_ID/SECRET, then npm run supabase:configure");
    } catch {
      check(false, "Supabase Auth reachable", "Check NEXT_PUBLIC_SUPABASE_URL and the anon key.");
    }
  }

  // ---- Turnstile secret ----
  if (env.TURNSTILE_SECRET_KEY) {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: "launch-check" });
    const r = (await (await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body })).json()) as { "error-codes"?: string[] };
    check(!r["error-codes"]?.includes("invalid-input-secret"), "Turnstile secret key is valid", "Copy the secret again from Cloudflare → Turnstile → your site.");
    check(!env.TURNSTILE_SECRET_KEY.startsWith("1x000") && !env.TURNSTILE_SECRET_KEY.startsWith("2x000"), "Turnstile isn't using test keys", "Use your real Turnstile keys in production.");
  }

  // ---- The live site ----
  if (!args.includes("--skip-site") && site.startsWith("https://")) {
    try {
      const health = await fetch(`${site}/api/health`, { cache: "no-store" });
      check(health.ok, `${site}/api/health answers 200`, "Deploy first, or check Vercel → Deployments for errors.");
      const home = await fetch(site, { redirect: "manual" });
      for (const h of ["content-security-policy", "strict-transport-security", "x-frame-options", "x-content-type-options", "referrer-policy"]) {
        check(Boolean(home.headers.get(h)), `Header ${h} is sent`, "Redeploy; headers come from next.config.ts.");
      }
      const privacy = await (await fetch(`${site}/privacy`)).text();
      check(!privacy.includes("[Grievance officer"), "Privacy policy names the grievance officer", "Set NEXT_PUBLIC_GRIEVANCE_OFFICER in Vercel and redeploy.");
      check(!privacy.includes("[Legal name"), "Privacy policy names who runs Got Next", "Set NEXT_PUBLIC_LEGAL_ENTITY in Vercel and redeploy.");
      check((await fetch(`${site}/.well-known/security.txt`)).ok, "security.txt is published", "Redeploy.");
      const demo = await fetch(`${site}/api/test-login?u=riya`, { redirect: "manual" });
      check(demo.status === 404, "Demo login is unreachable on the live site", "Remove E2E_TEST_LOGIN in Vercel and redeploy. URGENT.");
    } catch (e) {
      check(false, `Can reach ${site}`, `Deploy first (or pass --skip-site). ${e instanceof Error ? e.message : ""}`);
    }
  }

  // ---- Report ----
  const bad = results.filter((r) => r.ok === false);
  const warn = results.filter((r) => r.ok === "warn");
  for (const r of results) console.log(`${r.ok === true ? "✓" : r.ok === "warn" ? "!" : "✗"} ${r.label}${r.ok === true ? "" : `\n    → ${r.fix}`}`);
  console.log(`\n${results.length - bad.length - warn.length} passed, ${warn.length} to consider, ${bad.length} to fix.`);
  if (bad.length === 0) console.log("✓ Ready to launch from what can be checked here. Finish the manual steps in docs/GO_LIVE.md.");
  process.exit(bad.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
