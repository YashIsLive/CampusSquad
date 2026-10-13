import "server-only";
import { and, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatDateTime } from "@/lib/format";
import { sendEmail } from "@/lib/email";

/**
 * "Saved event closing in 24 h" notifications. Idempotent via saved_events.closing_notified_at.
 * Runs from the cron route (all users) and lazily on page load for the current user, so the
 * reminder appears even on hosting plans with coarse cron schedules.
 */
export async function sendClosingReminders(opts: { userId?: string } = {}) {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3600 * 1000);

  const due = await db
    .select({
      userId: schema.savedEvents.userId,
      eventId: schema.savedEvents.eventId,
      title: schema.events.title,
      regDeadline: schema.events.regDeadline,
      email: schema.profiles.email,
    })
    .from(schema.savedEvents)
    .innerJoin(schema.events, eq(schema.events.id, schema.savedEvents.eventId))
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.savedEvents.userId))
    .where(
      and(
        isNull(schema.savedEvents.closingNotifiedAt),
        eq(schema.events.status, "published"),
        eq(schema.events.registrationsOpen, true),
        gt(schema.events.regDeadline, now),
        lte(schema.events.regDeadline, in24h),
        // Skip people who already registered.
        sql`not exists (select 1 from registrations r where r.event_id = ${schema.events.id} and r.user_id = ${schema.savedEvents.userId})`,
        opts.userId ? eq(schema.savedEvents.userId, opts.userId) : undefined,
      ),
    )
    .limit(500);

  if (due.length === 0) return 0;

  await db.transaction(async (tx) => {
    await tx.insert(schema.notifications).values(
      due.map((d) => ({
        userId: d.userId,
        type: "event_closing" as const,
        payload: {
          title: `Registration for ${d.title} closes soon`,
          body: `Deadline: ${formatDateTime(d.regDeadline)}`,
          href: `/events/${d.eventId}`,
        },
      })),
    );
    for (const d of due) {
      await tx
        .update(schema.savedEvents)
        .set({ closingNotifiedAt: now })
        .where(and(eq(schema.savedEvents.userId, d.userId), eq(schema.savedEvents.eventId, d.eventId)));
    }
  });

  await Promise.allSettled(
    due.map((d) =>
      sendEmail({
        to: d.email,
        subject: `Closing soon: ${d.title}`,
        text: `Registration for ${d.title} closes ${formatDateTime(d.regDeadline)} IST.\n\n${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/events/${d.eventId}`,
      }),
    ),
  );
  return due.length;
}
