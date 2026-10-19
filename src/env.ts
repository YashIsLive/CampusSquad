/**
 * Environment checks that run when the server starts (imported by next.config.ts).
 * In production a missing or unsafe setting stops the deploy with a clear message instead of
 * failing later on a user's request.
 */
const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "NEXT_PUBLIC_SITE_URL",
] as const;

export function assertProductionEnv(env: Record<string, string | undefined> = process.env) {
  // `next build` runs with NODE_ENV=production too; CI can skip with SKIP_ENV_VALIDATION=1.
  if (env.NODE_ENV !== "production" || env.SKIP_ENV_VALIDATION === "1") return;

  const problems: string[] = [];
  for (const key of REQUIRED) if (!env[key]) problems.push(`${key} is not set`);

  const site = env.NEXT_PUBLIC_SITE_URL ?? "";
  const local = /localhost|127\.0\.0\.1/.test(site);
  // A local production build (`npm run build` on your machine) may keep the dev flag; a real deploy may not.
  if (env.E2E_TEST_LOGIN && !local) problems.push("E2E_TEST_LOGIN must not be set in production (it enables password-less demo login)");
  if (site && !local && !/^https:\/\//.test(site)) {
    problems.push("NEXT_PUBLIC_SITE_URL must be an https:// URL in production");
  }
  if (env.DATABASE_URL && /:5432\//.test(env.DATABASE_URL) && /pooler\.supabase\.com/.test(env.DATABASE_URL)) {
    problems.push("DATABASE_URL should use Supabase's transaction pooler (port 6543) for serverless; keep port 5432 for DIRECT_URL");
  }

  if (problems.length) {
    throw new Error(`Got Next configuration problems:\n  - ${problems.join("\n  - ")}\nSee README → Deploy.`);
  }
}
