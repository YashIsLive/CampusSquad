"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { authedAction, fail } from "@/lib/actions";
import { assertWithinLimit } from "@/lib/rate-limit";

async function assertMember(teamId: string, userId: string) {
  const m = await db.query.teamMembers.findFirst({
    where: and(eq(schema.teamMembers.teamId, teamId), eq(schema.teamMembers.userId, userId)),
  });
  if (!m) fail("Only team members can do that.");
  return m;
}

export const sendMessage = authedAction(
  z.object({ teamId: z.uuid(), body: z.string().trim().min(1).max(2000) }),
  async ({ teamId, body }, user) => {
    await assertMember(teamId, user.id);
    await assertWithinLimit("message", user.id);
    const [m] = await db
      .insert(schema.messages)
      .values({ teamId, senderId: user.id, body })
      .returning({ id: schema.messages.id, createdAt: schema.messages.createdAt });
    return { id: m.id, createdAt: m.createdAt.toISOString() };
  },
);

export const addTask = authedAction(
  z.object({ teamId: z.uuid(), title: z.string().trim().min(1).max(200) }),
  async ({ teamId, title }, user) => {
    await assertMember(teamId, user.id);
    const [t] = await db.insert(schema.teamTasks).values({ teamId, title, createdBy: user.id }).returning();
    return { id: t.id };
  },
);

export const toggleTask = authedAction(
  z.object({ taskId: z.uuid(), done: z.boolean() }),
  async ({ taskId, done }, user) => {
    const task = await db.query.teamTasks.findFirst({ where: eq(schema.teamTasks.id, taskId) });
    if (!task) fail("Task not found.");
    await assertMember(task.teamId, user.id);
    await db.update(schema.teamTasks).set({ done }).where(eq(schema.teamTasks.id, taskId));
    return null;
  },
);

export const deleteTask = authedAction(z.object({ taskId: z.uuid() }), async ({ taskId }, user) => {
  const task = await db.query.teamTasks.findFirst({ where: eq(schema.teamTasks.id, taskId) });
  if (!task) fail("Task not found.");
  await assertMember(task.teamId, user.id);
  await db.delete(schema.teamTasks).where(eq(schema.teamTasks.id, taskId));
  return null;
});

export const endorseTeammate = authedAction(
  z.object({
    eventId: z.uuid(),
    teamId: z.uuid(),
    toUser: z.uuid(),
    skillId: z.uuid(),
    note: z.string().trim().max(200).optional(),
  }),
  async (input, user) => {
    if (input.toUser === user.id) fail("You can't endorse yourself.");
    // The DB trigger re-checks: same team, team belongs to event, event has ended.
    await db.insert(schema.endorsements).values({ ...input, fromUser: user.id, note: input.note || null });
    revalidatePath(`/teams/${input.teamId}`);
    revalidatePath("/u", "layout");
    return null;
  },
);
