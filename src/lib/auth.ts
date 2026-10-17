import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof loadProfile>>>;

async function loadProfile(userId: string) {
  return db.query.profiles.findFirst({
    where: eq(schema.profiles.id, userId),
    with: { college: true },
  });
}

/** The signed-in user's profile, or null. Memoized per request. */
export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  return (await loadProfile(userId)) ?? null;
});

/** For pages: redirect to login (and to onboarding unless `allowUnonboarded`). */
export async function requireUser(opts: { next?: string; allowUnonboarded?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${opts.next ? `?next=${encodeURIComponent(opts.next)}` : ""}`);
  if (!opts.allowUnonboarded && !user.onboardedAt) redirect("/onboarding");
  return user;
}

export async function isOrgAdmin(userId: string, orgId: string) {
  const row = await db.query.orgMembers.findFirst({
    where: (m, { and, eq, inArray }) =>
      and(eq(m.orgId, orgId), eq(m.userId, userId), inArray(m.role, ["owner", "admin"])),
  });
  return Boolean(row);
}

/**
 * Where to send someone right after they sign in: first-timers go through profile setup first,
 * then on to wherever they were heading.
 */
export async function destinationAfterSignIn(next: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return next;
  const profile = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, userId), columns: { onboardedAt: true } });
  if (profile && !profile.onboardedAt && !next.startsWith("/onboarding") && !next.startsWith("/auth/")) {
    return `/onboarding?next=${encodeURIComponent(next)}`;
  }
  return next;
}
