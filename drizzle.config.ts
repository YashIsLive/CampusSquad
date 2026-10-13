import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

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
