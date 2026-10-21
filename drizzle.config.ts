import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// `npm run db:migrate:prod` targets production (.env.production.local); everything else, your dev database.
const prod = (process.env.npm_lifecycle_event ?? "").endsWith(":prod");
config({ path: prod ? ".env.production.local" : ".env.local", quiet: true });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Migrations need a session connection (port 5432), not the transaction pooler.
  dbCredentials: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL! },
  schemaFilter: ["public"],
  strict: true,
  verbose: true,
});
