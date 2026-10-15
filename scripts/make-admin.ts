/**
 * Grant (or revoke) the admin flag. Usage:
 *   npm run make-admin -- you@example.com
 *   npm run make-admin -- you@example.com --revoke
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import postgres from "postgres";

const email = process.argv.slice(2).find((a) => !a.startsWith("--"));
const revoke = process.argv.includes("--revoke");
if (!email) {
  console.error("Usage: npm run make-admin -- <email> [--revoke]");
  process.exit(1);
}

async function main(target: string) {
  const sql = postgres(process.env.DIRECT_URL ?? process.env.DATABASE_URL!, { prepare: false, max: 1 });
  const rows = await sql`update public.profiles set is_admin = ${!revoke} where lower(email) = lower(${target}) returning username`;
  await sql.end();
  if (rows.length === 0) {
    console.error(`No profile with email ${target}. Sign in once first.`);
    process.exit(1);
  }
  console.log(`${revoke ? "Revoked admin from" : "Granted admin to"} @${rows[0].username}`);
}

void main(email);
