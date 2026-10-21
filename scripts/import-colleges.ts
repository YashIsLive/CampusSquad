/**
 * Adds (or updates) the colleges students can pick, on any database, including production.
 * The seed script refuses to touch production; this is how real colleges get in.
 *
 *   npm run colleges:import -- data/colleges.json            # uses DIRECT_URL from .env.production.local
 *   npm run colleges:import -- data/colleges.json --env .env.local
 *
 * File format: [{ "name", "city", "state", "emailDomain" }]. Set emailDomain only to the domain
 * students actually get addresses on (check with the college); use null if they don't have one.
 * Students on a listed domain are verified automatically when they prove their email.
 */
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import postgres from "postgres";
import { isFreeEmailDomain } from "../src/lib/college";

const args = process.argv.slice(2);
const file = args.find((a) => a.endsWith(".json"));
const envFile = args.includes("--env") ? args[args.indexOf("--env") + 1] : ".env.production.local";
config({ path: envFile, quiet: true });

type College = { name: string; city: string; state: string; emailDomain: string | null };

(async () => {
  if (!file) throw new Error("Pass the JSON file, e.g. npm run colleges:import -- data/colleges.json");
  const url = process.env.DIRECT_URL;
  if (!url) throw new Error(`DIRECT_URL is missing (looked in ${envFile}).`);
  const colleges = JSON.parse(readFileSync(file, "utf8")) as College[];
  for (const c of colleges) {
    if (!c.name?.trim() || !c.city?.trim() || !c.state?.trim()) throw new Error(`Each college needs name, city and state: ${JSON.stringify(c)}`);
    if (c.emailDomain && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(c.emailDomain)) throw new Error(`"${c.emailDomain}" isn't a domain like college.ac.in`);
    if (c.emailDomain && isFreeEmailDomain(c.emailDomain)) throw new Error(`"${c.emailDomain}" is a personal email provider, not ${c.name}'s domain. Use null.`);
  }

  const sql = postgres(url, { max: 1 });
  try {
    for (const c of colleges) {
      const domain = c.emailDomain?.toLowerCase() ?? null;
      const [existing] = await sql`select id from colleges where lower(name) = lower(${c.name})`;
      if (existing) {
        await sql`update colleges set city = ${c.city}, state = ${c.state}, email_domain = ${domain}, verified = true where id = ${existing.id}`;
        console.log(`↻ ${c.name}`);
      } else {
        await sql`insert into colleges (name, city, state, email_domain, verified) values (${c.name}, ${c.city}, ${c.state}, ${domain}, true)`;
        console.log(`+ ${c.name}`);
      }
    }
    console.log(`\n✓ ${colleges.length} college(s) ready.`);
  } finally {
    await sql.end();
  }
})().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
