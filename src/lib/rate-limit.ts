import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { fail } from "@/lib/actions";

/**
 * Per-user limits on actions that notify other people or create public content. Counted from
 * the rows those actions already write, so there's no extra infrastructure (no Redis) to run.
 * Generous for real use; meant to stop scripts and accidental loops.
 */
const LIMITS = {
  apply: { table: "applications", column: "applicant_id", max: 20, window: "1 hour", message: "You've sent a lot of applications in the last hour. Take a breather and try again later." },
  invite: { table: "invites", column: "invited_by", max: 30, window: "1 hour", message: "Too many invites in the last hour. Try again later." },
  message: { table: "messages", column: "sender_id", max: 30, window: "1 minute", message: "You're sending messages very fast. Wait a moment." },
  applicationMessage: { table: "application_messages", column: "sender_id", max: 20, window: "1 minute", message: "You're sending messages very fast. Wait a moment." },
  report: { table: "reports", column: "reporter_id", max: 10, window: "1 day", message: "You've sent 10 reports today. If something urgent is happening, email us." },
  vouch: { table: "vouches", column: "voucher_id", max: 10, window: "30 days", message: "You've vouched for 10 people this month — that's the limit. Ask an admin if more classmates need help." },
  verificationRequest: { table: "verification_requests", column: "user_id", max: 3, window: "1 day", message: "You've sent 3 ID cards today. Wait for a reviewer before trying again." },
  announcement: { table: "announcements", column: "author_id", max: 10, window: "1 hour", message: "That's a lot of announcements in an hour. Try again later." },
  org: { table: "organizations", column: "created_by", max: 3, window: "1 day", message: "You can create up to 3 organizations a day." },
  event: { table: "events", column: "created_by", max: 15, window: "1 day", message: "You've posted the daily maximum of events. Try again tomorrow." },
} as const;

export type LimitKind = keyof typeof LIMITS;

export async function assertWithinLimit(kind: LimitKind, userId: string) {
  const l = LIMITS[kind];
  // Table/column names come from the constant above, never from input.
  const rows = await db.execute<{ n: number }>(
    sql`select count(*)::int as n from ${sql.identifier(l.table)} where ${sql.identifier(l.column)} = ${userId} and created_at > now() - ${l.window}::interval`,
  );
  if ((rows[0]?.n ?? 0) >= l.max) fail(l.message);
}
