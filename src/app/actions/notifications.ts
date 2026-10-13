"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { authedAction } from "@/lib/actions";

export const markAllNotificationsRead = authedAction(
  z.object({}),
  async (_input, user) => {
    await db
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)));
    revalidatePath("/", "layout");
    return null;
  },
  { allowUnonboarded: true },
);
