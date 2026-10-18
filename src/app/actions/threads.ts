"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { authedAction, fail } from "@/lib/actions";
import { loadApplicationThread } from "@/lib/threads";
import { assertWithinLimit } from "@/lib/rate-limit";

/** Applicant or team leader posts in an application's conversation. The other side is notified. */
export const sendApplicationMessage = authedAction(
  z.object({ applicationId: z.uuid(), body: z.string().trim().min(1, "Write a message.").max(2000) }),
  async ({ applicationId, body }, user) => {
    const thread = await loadApplicationThread(applicationId, user.id);
    if (!thread) fail("Conversation not found.");
    if (thread.application.status === "withdrawn") fail("This application was withdrawn, so the conversation is closed.");
    await assertWithinLimit("applicationMessage", user.id);

    const [m] = await db
      .insert(schema.applicationMessages)
      .values({ applicationId, senderId: user.id, body })
      .returning({ id: schema.applicationMessages.id, createdAt: schema.applicationMessages.createdAt });

    const recipientId = thread.isLeader ? thread.application.applicantId : thread.leader.id;
    const href = `/applications/${applicationId}`;
    const title = thread.isLeader
      ? `${user.name} (${thread.team.name}) sent you a message`
      : `${user.name} replied about ${thread.vacancy.roleTitle}`;
    const preview = body.length > 140 ? `${body.slice(0, 139)}…` : body;

    // One unread notification per conversation: a burst of messages updates it instead of piling up.
    const updated = await db
      .update(schema.notifications)
      .set({ payload: { title, body: preview, href }, createdAt: new Date() })
      .where(
        and(
          eq(schema.notifications.userId, recipientId),
          eq(schema.notifications.type, "application_message"),
          isNull(schema.notifications.readAt),
          sql`${schema.notifications.payload}->>'href' = ${href}`,
        ),
      )
      .returning({ id: schema.notifications.id });
    if (updated.length === 0) {
      await db.insert(schema.notifications).values({
        userId: recipientId,
        type: "application_message",
        payload: { title, body: preview, href },
      });
    }

    revalidatePath(href);
    return { id: m.id, createdAt: m.createdAt.toISOString() };
  },
);
