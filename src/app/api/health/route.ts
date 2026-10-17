import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Uptime check: 200 when the app can reach the database, 503 otherwise. No secrets in the body. */
export async function GET() {
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, db: "up", ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
