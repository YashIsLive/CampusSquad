import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { reliabilityScore } from "@/lib/reliability";

/** Recompute reliability_score for the given users from their checked-in vs no-show history. */
export async function recomputeReliability(userIds: string[]) {
  if (userIds.length === 0) return;
  const rows = await db
    .select({
      userId: schema.registrations.userId,
      attended: sql<number>`count(*) filter (where ${schema.registrations.status} = 'checked_in')::int`,
      noShows: sql<number>`count(*) filter (where ${schema.registrations.status} = 'no_show')::int`,
    })
    .from(schema.registrations)
    .where(inArray(schema.registrations.userId, userIds))
    .groupBy(schema.registrations.userId);
  const byUser = new Map(rows.map((r) => [r.userId, r]));
  for (const id of userIds) {
    const r = byUser.get(id);
    await db
      .update(schema.profiles)
      .set({ reliabilityScore: String(reliabilityScore(r?.attended ?? 0, r?.noShows ?? 0)) })
      .where(eq(schema.profiles.id, id));
  }
}

/**
 * Marks every still-"registered" attendee of a finished event as a no-show and updates
 * reliability scores. Returns how many were marked.
 */
export async function finalizeAttendance(eventId: string) {
  const marked = await db.transaction(async (tx) => {
    const rows = await tx
      .update(schema.registrations)
      .set({ status: "no_show" })
      .where(and(eq(schema.registrations.eventId, eventId), eq(schema.registrations.status, "registered")))
      .returning({ userId: schema.registrations.userId });
    await tx.update(schema.events).set({ attendanceFinalizedAt: new Date() }).where(eq(schema.events.id, eventId));
    return rows;
  });
  const attendees = await db
    .select({ userId: schema.registrations.userId })
    .from(schema.registrations)
    .where(eq(schema.registrations.eventId, eventId));
  await recomputeReliability(attendees.map((a) => a.userId));
  return marked.length;
}
