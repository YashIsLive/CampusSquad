import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

// Reuse one client across hot reloads in dev.
const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };

// `prepare: false` is required for Supabase's transaction-mode pooler (port 6543).
// Serverless functions each hold their own pool, so keep it small in production.
const client =
  globalForDb.pgClient ??
  postgres(connectionString, {
    prepare: false,
    max: Number(process.env.DB_POOL_MAX ?? (process.env.NODE_ENV === "production" ? 3 : 10)),
    idle_timeout: 20,
    connect_timeout: 10,
  });
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;
/** Either the root db or a transaction handle. */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };
