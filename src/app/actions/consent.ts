"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { authedAction, fail } from "@/lib/actions";
import { safeNext } from "@/lib/auth-errors";
import { TERMS_VERSION } from "@/lib/legal-version";

/** Records "I'm 18+ and agree to the terms and privacy policy" for an existing account. */
export const acceptTerms = authedAction(
  z.object({ adult: z.boolean(), agree: z.boolean(), next: z.string().optional() }),
  async ({ adult, agree, next }, user) => {
    if (!adult) fail("Got Next is for students aged 18 or over.");
    if (!agree) fail("Please agree to the terms and privacy policy to continue.");
    await db
      .update(schema.profiles)
      .set({ termsVersion: TERMS_VERSION, termsAcceptedAt: new Date(), adultConfirmedAt: new Date() })
      .where(eq(schema.profiles.id, user.id));
    redirect(safeNext(next));
  },
  { allowUnonboarded: true },
);
