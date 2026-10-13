import "server-only";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { schema, type Tx } from "@/db";
import type { CurrentUser } from "@/lib/auth";
import { fail } from "@/lib/actions";
import { canRegister } from "@/lib/eligibility";

export const newCheckinCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 10);

export const refCookieName = (eventId: string) => `cs_ref_${eventId}`;

export type EventRow = typeof schema.events.$inferSelect;

/** Registration rules as seen by this user. */
export function registrationCheck(event: EventRow, user: CurrentUser, now = new Date()) {
  return canRegister(event, {
    collegeId: user.collegeId,
    collegeVerified: user.collegeVerified,
    collegeCity: user.college?.city ?? null,
  }, now);
}

/**
 * Returns the user's registration for the event, creating it if needed (enforcing deadline,
 * status and eligibility). Attributes new registrations to the share link the user arrived from.
 */
export async function ensureRegistration(tx: Tx, event: EventRow, user: CurrentUser) {
  const existing = await tx.query.registrations.findFirst({
    where: and(eq(schema.registrations.eventId, event.id), eq(schema.registrations.userId, user.id)),
  });
  if (existing) return existing;

  const check = registrationCheck(event, user);
  if (!check.ok) fail(check.reason);

  const ref = (await cookies()).get(refCookieName(event.id))?.value;
  let shareLinkId: string | null = null;
  if (ref) {
    const link = await tx.query.shareLinks.findFirst({
      where: and(eq(schema.shareLinks.id, ref), eq(schema.shareLinks.eventId, event.id)),
      columns: { id: true },
    });
    shareLinkId = link?.id ?? null;
  }

  const [reg] = await tx
    .insert(schema.registrations)
    .values({ eventId: event.id, userId: user.id, checkinCode: newCheckinCode(), shareLinkId })
    .returning();
  return reg;
}

/** Creates a team with `user` as leader and links their registration to it. */
export async function createTeamTx(
  tx: Tx,
  event: EventRow,
  user: CurrentUser,
  input: { name: string; ideaPitch?: string | null },
) {
  if (event.teamMax < 2) fail("This is a solo event — no teams needed.");
  const reg = await ensureRegistration(tx, event, user);
  const [team] = await tx
    .insert(schema.teams)
    .values({ eventId: event.id, name: input.name, leaderId: user.id, ideaPitch: input.ideaPitch ?? null })
    .returning();
  // Trigger enforces one-team-per-event and fills event_id.
  await tx.insert(schema.teamMembers).values({ teamId: team.id, userId: user.id, eventId: event.id, roleTitle: "Leader" });
  await tx.update(schema.registrations).set({ teamId: team.id }).where(eq(schema.registrations.id, reg.id));
  // A team leader is no longer "looking for a team".
  await tx
    .update(schema.availabilityPosts)
    .set({ status: "closed" })
    .where(and(eq(schema.availabilityPosts.eventId, event.id), eq(schema.availabilityPosts.userId, user.id)));
  return team;
}
