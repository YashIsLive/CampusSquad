"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { authedAction, fail } from "@/lib/actions";
import { createTeamTx, ensureRegistration } from "@/lib/registration";

async function loadEvent(eventId: string) {
  const event = await db.query.events.findFirst({ where: eq(schema.events.id, eventId) });
  if (!event) fail("Event not found.");
  return event;
}

export const registerForEvent = authedAction(
  z.object({
    eventId: z.uuid(),
    team: z
      .object({
        name: z.string().trim().min(2, "Team name is too short.").max(40),
        ideaPitch: z.string().trim().max(300).optional(),
      })
      .nullable(),
  }),
  async ({ eventId, team }, user) => {
    const event = await loadEvent(eventId);
    const result = await db.transaction(async (tx) => {
      if (team) {
        const t = await createTeamTx(tx, event, user, team);
        return { teamId: t.id as string | null };
      }
      await ensureRegistration(tx, event, user);
      return { teamId: null };
    });
    revalidatePath(`/events/${eventId}`, "layout");
    revalidatePath("/me/events");
    return result;
  },
);

export const cancelRegistration = authedAction(z.object({ eventId: z.uuid() }), async ({ eventId }, user) => {
  await db.transaction(async (tx) => {
    const membership = await tx.query.teamMembers.findFirst({
      where: and(eq(schema.teamMembers.eventId, eventId), eq(schema.teamMembers.userId, user.id)),
      with: { team: true },
    });
    if (membership) {
      if (membership.team.leaderId === user.id) {
        const [{ n }] = await tx
          .select({ n: count() })
          .from(schema.teamMembers)
          .where(eq(schema.teamMembers.teamId, membership.teamId));
        if (n > 1) fail("You lead a team with other members. Hand over or remove members before cancelling.");
        await tx.delete(schema.teams).where(eq(schema.teams.id, membership.teamId));
      } else {
        await tx
          .delete(schema.teamMembers)
          .where(and(eq(schema.teamMembers.teamId, membership.teamId), eq(schema.teamMembers.userId, user.id)));
      }
    }
    await tx
      .delete(schema.registrations)
      .where(and(eq(schema.registrations.eventId, eventId), eq(schema.registrations.userId, user.id)));
    await tx
      .update(schema.availabilityPosts)
      .set({ status: "closed" })
      .where(and(eq(schema.availabilityPosts.eventId, eventId), eq(schema.availabilityPosts.userId, user.id)));
  });
  revalidatePath(`/events/${eventId}`, "layout");
  revalidatePath("/me/events");
  return null;
});

export const toggleSaveEvent = authedAction(
  z.object({ eventId: z.uuid(), save: z.boolean() }),
  async ({ eventId, save }, user) => {
    if (save) {
      await db.insert(schema.savedEvents).values({ eventId, userId: user.id }).onConflictDoNothing();
    } else {
      await db
        .delete(schema.savedEvents)
        .where(and(eq(schema.savedEvents.eventId, eventId), eq(schema.savedEvents.userId, user.id)));
    }
    revalidatePath("/me/events");
    return { saved: save };
  },
);
