import "server-only";
import { redirect } from "next/navigation";
import type { CurrentUser } from "@/lib/auth";
import { fail } from "@/lib/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Two-step sign-in (TOTP authenticator apps, via Supabase Auth MFA).
 *
 * - Anyone can turn it on in Account and privacy → Two-step sign-in. Once on, pages ask for a code
 *   after sign-in (`aal1` → `aal2`).
 * - Platform admins and ID reviewers must have it on and confirmed for this session before they can
 *   use admin tools or see student ID photos. Enforced in production, or anywhere with ADMIN_MFA=1.
 */
export function adminMfaRequired() {
  return process.env.NODE_ENV === "production" || process.env.ADMIN_MFA === "1";
}

export async function assuranceLevel() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return { current: data?.currentLevel ?? null, next: data?.nextLevel ?? null };
}

/** True when the person has two-step sign-in set up but hasn't entered a code this session. */
export async function needsMfaChallenge() {
  const { current, next } = await assuranceLevel();
  return next === "aal2" && current !== "aal2";
}

/** For admin pages: send the person to set up / confirm two-step sign-in first. */
export async function requireAdminPageAal(next: string) {
  if (!adminMfaRequired()) return;
  const { current } = await assuranceLevel();
  if (current !== "aal2") redirect(`/account/security?next=${encodeURIComponent(next)}&reason=admin`);
}

/** For admin and reviewer actions: must be an admin (if `adminOnly`) with a confirmed second step. */
export async function requireAdminAal(user: CurrentUser, { adminOnly = true }: { adminOnly?: boolean } = {}) {
  if (adminOnly && !user.isAdmin) fail("Admins only.");
  if (!adminMfaRequired()) return;
  const { current } = await assuranceLevel();
  if (current !== "aal2") fail("Confirm with your authenticator app first: Account and privacy → Two-step sign-in.");
}
