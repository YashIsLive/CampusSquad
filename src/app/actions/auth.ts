"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authErrorMessage, safeNext } from "@/lib/auth-errors";
import { siteUrl } from "@/lib/format";
import { destinationAfterSignIn } from "@/lib/auth";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Base URL for links in auth emails. In production it is always NEXT_PUBLIC_SITE_URL — never a
 * request header, which a client can spoof. Locally we follow the host so LAN/phone testing works.
 */
async function origin() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SITE_URL) return siteUrl();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : siteUrl();
}

/** Every email link lands on /auth/confirm, which handles token_hash (any device) and PKCE codes. */
async function confirmUrl(next?: string) {
  return `${await origin()}/auth/confirm?next=${encodeURIComponent(safeNext(next))}`;
}

const email = z.email("Enter a valid email address.").transform((v) => v.trim().toLowerCase());
const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Passwords can be at most 72 characters.")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Use at least one letter and one number.");

function firstIssue(err: z.ZodError) {
  return err.issues[0]?.message ?? "Please check what you entered.";
}

// ---------- Email link / code ----------

export async function sendMagicLink(input: { email: string; next?: string }): Promise<Result> {
  const parsed = z.object({ email, next: z.string().optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: await confirmUrl(parsed.data.next), shouldCreateUser: true },
  });
  if (error) return { ok: false, error: authErrorMessage(error) };
  return { ok: true };
}

/** The 6-digit code from the same email — works even when the link opens in another app. */
export async function verifyEmailCode(input: { email: string; code: string; next?: string }): Promise<Result> {
  const parsed = z
    .object({ email, code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from the email."), next: z.string().optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ email: parsed.data.email, token: parsed.data.code, type: "email" });
  if (error) return { ok: false, error: authErrorMessage(error) };
  redirect(await destinationAfterSignIn(safeNext(parsed.data.next)));
}

// ---------- Password ----------

export async function signUpWithPassword(input: { email: string; password: string; next?: string }): Promise<Result & { needsConfirmation?: boolean }> {
  const parsed = z.object({ email, password, next: z.string().optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: await confirmUrl(parsed.data.next ?? "/onboarding") },
  });
  if (error) return { ok: false, error: authErrorMessage(error) };
  // With "Confirm email" on, there's no session until they click the link.
  if (!data.session) return { ok: true, needsConfirmation: true };
  redirect(safeNext(parsed.data.next ?? "/onboarding"));
}

export async function signInWithPassword(input: { email: string; password: string; next?: string }): Promise<Result> {
  const parsed = z.object({ email, password: z.string().min(1, "Enter your password."), next: z.string().optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) return { ok: false, error: authErrorMessage(error) };
  redirect(await destinationAfterSignIn(safeNext(parsed.data.next)));
}

export async function sendPasswordReset(input: { email: string }): Promise<Result> {
  const parsed = z.object({ email }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: await confirmUrl("/auth/reset-password"),
  });
  // Don't reveal whether the account exists; only surface delivery problems.
  if (error && error.status !== 400) return { ok: false, error: authErrorMessage(error) };
  return { ok: true };
}

/** Sets a new password for the signed-in user (after following a reset link). */
export async function updatePassword(input: { password: string }): Promise<Result> {
  const parsed = z.object({ password }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { ok: false, error: "Your reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: authErrorMessage(error) };
  redirect("/?password=updated");
}

// ---------- Google / sign out ----------

export async function signInWithGoogle(next?: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: await confirmUrl(next) },
  });
  if (error || !data.url) redirect(`/login?error=${encodeURIComponent(error ? authErrorMessage(error) : "Google sign-in isn't set up yet.")}`);
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
