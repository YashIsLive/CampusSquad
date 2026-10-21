import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TERMS_VERSION } from "@/lib/legal-version";

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

/** True until the person has accepted the current terms and confirmed they're 18+. */
export function needsConsent(user: CurrentUser) {
  return !user.termsAcceptedAt || user.termsVersion !== TERMS_VERSION || !user.adultConfirmedAt;
}

/**
 * For pages: redirect to login, then to onboarding (unless `allowUnonboarded`), then to the
 * one-time consent page for accounts made before consent was recorded (or after the terms changed).
 */
export async function requireUser(opts: { next?: string; allowUnonboarded?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${opts.next ? `?next=${encodeURIComponent(opts.next)}` : ""}`);
  if (!opts.allowUnonboarded && !user.onboardedAt) redirect("/onboarding");
  // Two-step sign-in is on for this account but no code was entered this session.
  const supabase = await createSupabaseServerClient();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    redirect(`/auth/mfa${opts.next ? `?next=${encodeURIComponent(opts.next)}` : ""}`);
  }
  if (!opts.allowUnonboarded && user.onboardedAt && needsConsent(user)) {
    redirect(`/consent${opts.next ? `?next=${encodeURIComponent(opts.next)}` : ""}`);
  }
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
 * After an OAuth sign-in: if the account has a Google identity, its email is proven, so mark it
 * verified and (re)apply campus verification from the email domain. This is how an instant
 * password account earns its badge — sign in once with Google using the same college address.
 */
export async function syncProviderVerification() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.email || !user.identities?.some((i) => i.provider === "google")) return;
  await markEmailProven(user.id);
}

/**
 * The signed-in user just proved they control their address (Google, an email link or code):
 * mark it verified and grant campus verification if the domain belongs to a college.
 */
export async function markEmailProven(userId?: string) {
  let id = userId;
  if (!id) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    id = data?.claims?.sub;
  }
  if (!id) return;
  await db.execute(sql`
    update public.profiles p set
      email_verified = true,
      college_id = coalesce(public.college_for_email(p.email), p.college_id),
      college_verified = p.college_verified or public.college_for_email(p.email) is not null
    where p.id = ${id}`);
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
