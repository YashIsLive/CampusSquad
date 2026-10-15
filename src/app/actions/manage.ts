"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, ilike, isNull, or } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { db, schema } from "@/db";
import { authedAction, fail } from "@/lib/actions";
import { isOrgAdmin } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { finalizeAttendance as finalizeAttendanceTx, recomputeReliability } from "@/lib/attendance";

const shortCode = customAlphabet("abcdefghijkmnpqrstuvwxyz23456789", 7);

async function assertEventAdmin(eventId: string, userId: string) {
  const event = await db.query.events.findFirst({ where: eq(schema.events.id, eventId) });
  if (!event) fail("Event not found.");
  if (!(await isOrgAdmin(userId, event.orgId))) fail("Only organizers of this event can do that.");
  return event;
}

export const createShareLink = authedAction(
  z.object({ eventId: z.uuid(), channelLabel: z.string().trim().min(2, "Name the channel.").max(60) }),
  async ({ eventId, channelLabel }, user) => {
    await assertEventAdmin(eventId, user.id);
    const [link] = await db
      .insert(schema.shareLinks)
      .values({ eventId, channelLabel, shortCode: shortCode() })
      .returning({ shortCode: schema.shareLinks.shortCode });
    revalidatePath(`/events/${eventId}/manage`);
    return link;
  },
);

export const deleteShareLink = authedAction(z.object({ shareLinkId: z.uuid() }), async ({ shareLinkId }, user) => {
  const link = await db.query.shareLinks.findFirst({ where: eq(schema.shareLinks.id, shareLinkId) });
  if (!link) fail("Link not found.");
  await assertEventAdmin(link.eventId, user.id);
  await db.delete(schema.shareLinks).where(eq(schema.shareLinks.id, shareLinkId));
  revalidatePath(`/events/${link.eventId}/manage`);
  return null;
});

export const postAnnouncement = authedAction(
  z.object({ eventId: z.uuid(), body: z.string().trim().min(3, "Write something.").max(2000), email: z.boolean() }),
  async ({ eventId, body, email }, user) => {
    const event = await assertEventAdmin(eventId, user.id);
    const registrants = await db
      .select({ userId: schema.registrations.userId, email: schema.profiles.email })
      .from(schema.registrations)
      .innerJoin(schema.profiles, eq(schema.profiles.id, schema.registrations.userId))
      .where(eq(schema.registrations.eventId, eventId));

    await db.transaction(async (tx) => {
      await tx.insert(schema.announcements).values({ eventId, authorId: user.id, body });
      if (registrants.length) {
        await tx.insert(schema.notifications).values(
          registrants.map((r) => ({
            userId: r.userId,
            type: "announcement" as const,
            payload: { title: `Update: ${event.title}`, body: body.slice(0, 280), href: `/events/${eventId}?tab=updates` },
          })),
        );
      }
    });
    if (email) {
      await Promise.allSettled(
        registrants.map((r) => sendEmail({ to: r.email, subject: `Update: ${event.title}`, text: body })),
      );
    }
    revalidatePath(`/events/${eventId}`, "layout");
    return { recipients: registrants.length };
  },
);

/** Check in by scanned/typed code or by registration id. Idempotent. */
export const checkIn = authedAction(
  z
    .object({ eventId: z.uuid(), code: z.string().trim().toUpperCase().optional(), registrationId: z.uuid().optional(), undo: z.boolean().optional() })
    .refine((v) => v.code || v.registrationId, { message: "Scan or enter a code." }),
  async ({ eventId, code, registrationId, undo }, user) => {
    const event = await assertEventAdmin(eventId, user.id);
    const reg = await db.query.registrations.findFirst({
      where: and(
        eq(schema.registrations.eventId, eventId),
        registrationId ? eq(schema.registrations.id, registrationId) : eq(schema.registrations.checkinCode, code!),
      ),
      with: { user: { columns: { name: true } }, team: { columns: { name: true } } },
    });
    if (!reg) fail("No registration with that code for this event.");
    const already = reg.status === "checked_in";
    if (undo) {
      await db
        .update(schema.registrations)
        .set({ status: event.attendanceFinalizedAt ? "no_show" : "registered", checkedInAt: null })
        .where(eq(schema.registrations.id, reg.id));
    } else if (!already) {
      await db
        .update(schema.registrations)
        .set({ status: "checked_in", checkedInAt: new Date() })
        .where(eq(schema.registrations.id, reg.id));
    }
    // After attendance is finalized, a late check-in (or undo) changes the person's reliability.
    if (event.attendanceFinalizedAt) await recomputeReliability([reg.userId]);
    revalidatePath(`/events/${eventId}/manage`, "layout");
    return { name: reg.user.name, team: reg.team?.name ?? null, alreadyCheckedIn: already && !undo };
  },
);

export const searchRegistrants = authedAction(
  z.object({ eventId: z.uuid(), q: z.string().trim().min(1).max(60) }),
  async ({ eventId, q }, user) => {
    await assertEventAdmin(eventId, user.id);
    const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    const rows = await db
      .select({
        id: schema.registrations.id,
        status: schema.registrations.status,
        code: schema.registrations.checkinCode,
        name: schema.profiles.name,
        email: schema.profiles.email,
        team: schema.teams.name,
      })
      .from(schema.registrations)
      .innerJoin(schema.profiles, eq(schema.profiles.id, schema.registrations.userId))
      .leftJoin(schema.teams, eq(schema.teams.id, schema.registrations.teamId))
      .where(
        and(
          eq(schema.registrations.eventId, eventId),
          or(ilike(schema.profiles.name, like), ilike(schema.profiles.email, like), ilike(schema.registrations.checkinCode, like), ilike(schema.teams.name, like)),
        ),
      )
      .limit(20);
    return rows;
  },
);

const NUDGE_COOLDOWN_MS = 12 * 3600 * 1000;

/** One-click: remind every registrant without a team to use the team board. */
export const nudgeSoloRegistrants = authedAction(z.object({ eventId: z.uuid() }), async ({ eventId }, user) => {
  const event = await assertEventAdmin(eventId, user.id);
  if (event.teamMax < 2) fail("This is a solo event.");
  if (event.endsAt < new Date()) fail("This event has ended.");
  if (event.soloNudgedAt && Date.now() - event.soloNudgedAt.getTime() < NUDGE_COOLDOWN_MS) {
    fail("You nudged solo registrants recently. Try again in a few hours.");
  }
  const solo = await db
    .select({ userId: schema.registrations.userId })
    .from(schema.registrations)
    .where(and(eq(schema.registrations.eventId, eventId), isNull(schema.registrations.teamId)));
  if (solo.length === 0) fail("Everyone registered is already on a team.");

  const [{ openRoles }] = await db
    .select({ openRoles: count() })
    .from(schema.vacancies)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.vacancies.teamId))
    .where(and(eq(schema.teams.eventId, eventId), eq(schema.vacancies.status, "open")));

  await db.transaction(async (tx) => {
    await tx.insert(schema.notifications).values(
      solo.map((s) => ({
        userId: s.userId,
        type: "team_nudge" as const,
        payload: {
          title: `Find a team for ${event.title}`,
          body: openRoles
            ? `${openRoles} open role${openRoles === 1 ? " is" : "s are"} waiting on the team board. Apply in one tap, or post a "looking for a team" card.`
            : `Post a "looking for a team" card so leaders can invite you, or start your own team.`,
          href: `/events/${eventId}?tab=teams`,
        },
      })),
    );
    await tx.update(schema.events).set({ soloNudgedAt: new Date() }).where(eq(schema.events.id, eventId));
  });
  revalidatePath(`/events/${eventId}/manage`);
  return { nudged: solo.length };
});

export const finalizeAttendance = authedAction(z.object({ eventId: z.uuid() }), async ({ eventId }, user) => {
  const event = await assertEventAdmin(eventId, user.id);
  if (event.startsAt > new Date()) fail("You can finalize attendance once the event has started.");
  if (event.attendanceFinalizedAt) fail("Attendance is already finalized.");
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.registrations)
    .where(and(eq(schema.registrations.eventId, eventId), eq(schema.registrations.status, "checked_in")));
  if (n === 0) fail("No one has been checked in, so everyone would be marked absent. Check people in first.");
  const marked = await finalizeAttendanceTx(eventId);
  revalidatePath(`/events/${eventId}/manage`, "layout");
  return { noShows: marked };
});
