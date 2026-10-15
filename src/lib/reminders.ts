import "server-only";
import { and, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatDateTime } from "@/lib/format";
import { sendEmail } from "@/lib/email";
import { REMINDER_LABEL, dueReminder, remindersCoveredBy, type ReminderKind } from "@/lib/reminder-schedule";

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

  // Claim each row with a conditional update so concurrent runs can't both send it.
  const claimed = await db.transaction(async (tx) => {
    const won: typeof due = [];
    for (const d of due) {
      const rows = await tx
        .update(schema.savedEvents)
        .set({ closingNotifiedAt: now })
        .where(
          and(
            eq(schema.savedEvents.userId, d.userId),
            eq(schema.savedEvents.eventId, d.eventId),
            isNull(schema.savedEvents.closingNotifiedAt),
          ),
        )
        .returning({ userId: schema.savedEvents.userId });
      if (rows.length) won.push(d);
    }
    if (won.length) {
      await tx.insert(schema.notifications).values(
        won.map((d) => ({
          userId: d.userId,
          type: "event_closing" as const,
          payload: {
            title: `Registration for ${d.title} closes soon`,
            body: `Deadline: ${formatDateTime(d.regDeadline)}`,
            href: `/events/${d.eventId}`,
          },
        })),
      );
    }
    return won;
  });

  await Promise.allSettled(
    claimed.map((d) =>
      sendEmail({
        to: d.email,
        subject: `Closing soon: ${d.title}`,
        text: `Registration for ${d.title} closes ${formatDateTime(d.regDeadline)} IST.\n\n${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/events/${d.eventId}`,
      }),
    ),
  );
  return claimed.length;
}

/**
 * Event-start reminders for registrants (72 h, 24 h, 2 h before). Idempotent via reminder_log;
 * sending a tighter reminder also logs the looser ones so nobody gets a burst of three.
 */
export async function sendEventReminders(opts: { userId?: string } = {}) {
  const now = new Date();
  const horizon = new Date(now.getTime() + 72 * 3600 * 1000);

  const candidates = await db
    .select({
      registrationId: schema.registrations.id,
      userId: schema.registrations.userId,
      email: schema.profiles.email,
      eventId: schema.events.id,
      title: schema.events.title,
      startsAt: schema.events.startsAt,
      venue: schema.events.venue,
      mode: schema.events.mode,
      sent: sql<string[]>`coalesce((select array_agg(l.kind::text) from reminder_log l where l.registration_id = ${schema.registrations.id}), '{}')`,
    })
    .from(schema.registrations)
    .innerJoin(schema.events, eq(schema.events.id, schema.registrations.eventId))
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.registrations.userId))
    .where(
      and(
        eq(schema.registrations.status, "registered"),
        eq(schema.events.status, "published"),
        gt(schema.events.startsAt, now),
        lte(schema.events.startsAt, horizon),
        opts.userId ? eq(schema.registrations.userId, opts.userId) : undefined,
      ),
    )
    .limit(1000);

  const due = candidates
    .map((c) => ({ ...c, kind: dueReminder(c.startsAt, now) }))
    .filter((c): c is typeof c & { kind: ReminderKind } => c.kind !== null && !c.sent.includes(c.kind));
  if (due.length === 0) return 0;

  const claimed = await db.transaction(async (tx) => {
    // Inserting the exact reminder's log row is the claim; a concurrent run gets no row back.
    const won = await tx
      .insert(schema.reminderLog)
      .values(due.map((d) => ({ registrationId: d.registrationId, kind: d.kind })))
      .onConflictDoNothing()
      .returning({ registrationId: schema.reminderLog.registrationId, kind: schema.reminderLog.kind });
    const wonKeys = new Set(won.map((w) => `${w.registrationId}:${w.kind}`));
    const mine = due.filter((d) => wonKeys.has(`${d.registrationId}:${d.kind}`));
    if (mine.length === 0) return mine;
    await tx
      .insert(schema.reminderLog)
      .values(mine.flatMap((d) => remindersCoveredBy(d.kind).map((kind) => ({ registrationId: d.registrationId, kind }))))
      .onConflictDoNothing();
    await tx.insert(schema.notifications).values(
      mine.map((d) => ({
        userId: d.userId,
        type: "event_reminder" as const,
        payload: {
          title: `${d.title} starts ${REMINDER_LABEL[d.kind]}`,
          body: `${formatDateTime(d.startsAt)} · ${d.mode === "online" ? "Online" : (d.venue ?? "")}`,
          href: `/events/${d.eventId}`,
        },
      })),
    );
    return mine;
  });

  await Promise.allSettled(
    claimed
      .filter((d) => d.kind !== "h72")
      .map((d) =>
        sendEmail({
          to: d.email,
          subject: `${d.title} starts ${REMINDER_LABEL[d.kind]}`,
          text: `${d.title} starts ${formatDateTime(d.startsAt)} IST.\n\n${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/events/${d.eventId}`,
        }),
      ),
  );
  return claimed.length;
}

/** Everything time-based, in one call (cron route + lazy per-user run). */
export async function runReminders(opts: { userId?: string } = {}) {
  const [closing, starting] = await Promise.all([sendClosingReminders(opts), sendEventReminders(opts)]);
  return { closing, starting };
}
