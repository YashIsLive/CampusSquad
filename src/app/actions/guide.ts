"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { GuideState } from "@/db/schema";
import { authedAction } from "@/lib/actions";

const TOURS = ["feed", "event", "team", "manage"] as const;

async function patchGuide(userId: string, current: GuideState, patch: (g: GuideState) => GuideState) {
  await db.update(schema.profiles).set({ guide: patch(current) }).where(eq(schema.profiles.id, userId));
}

export const markTourSeen = authedAction(
  z.object({ tour: z.enum(TOURS) }),
  async ({ tour }, user) => {
    if (user.guide.tours?.[tour]) return null;
    await patchGuide(user.id, user.guide, (g) => ({ ...g, tours: { ...g.tours, [tour]: new Date().toISOString() } }));
    return null;
  },
  { allowUnonboarded: true },
);

export const setChecklistHidden = authedAction(
  z.object({ hidden: z.boolean() }),
  async ({ hidden }, user) => {
    await patchGuide(user.id, user.guide, (g) => ({ ...g, checklistHiddenAt: hidden ? new Date().toISOString() : undefined }));
    revalidatePath("/");
    return null;
  },
  { allowUnonboarded: true },
);

export const setGuideTrack = authedAction(
  z.object({ track: z.enum(["student", "organizer"]) }),
  async ({ track }, user) => {
    await patchGuide(user.id, user.guide, (g) => ({ ...g, track, checklistHiddenAt: undefined }));
    revalidatePath("/");
    return null;
  },
  { allowUnonboarded: true },
);

/** "Show me around again": forget seen tours and bring the checklist back. */
export const resetGuide = authedAction(
  z.object({}),
  async (_input, user) => {
    await patchGuide(user.id, user.guide, (g) => ({ track: g.track }));
    revalidatePath("/", "layout");
    return null;
  },
  { allowUnonboarded: true },
);
