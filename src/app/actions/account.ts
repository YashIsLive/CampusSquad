"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authedAction, fail } from "@/lib/actions";
import { deleteAccount, deletionBlockers } from "@/lib/account";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { forgetThisDevice } from "@/lib/trusted-device";
import { createClient } from "@supabase/supabase-js";
import { newPassword } from "@/lib/password";
import { authErrorMessage } from "@/lib/auth-errors";
import { accountHasPassword } from "@/lib/account";

/** Permanently delete the signed-in account. The person types "delete" to confirm. */
export const deleteMyAccount = authedAction(
  z.object({ confirm: z.string().trim().toLowerCase() }),
  async ({ confirm }, user) => {
    if (confirm !== "delete") fail('Type "delete" to confirm.');
    const blockers = await deletionBlockers(user.id);
    if (blockers.length) {
      fail(`You're the only admin of ${blockers.map((b) => b.name).join(", ")}, which has upcoming events. Add another admin first.`);
    }
    await deleteAccount(user.id);
    await forgetThisDevice(user.id);
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: "local" });
    redirect("/?account=deleted");
  },
  { allowUnonboarded: true },
);

/**
 * Set or change the password. If the account already has one, the current password is checked first
 * (on a throwaway client, so a wrong guess doesn't touch this session). Accounts made with Google or
 * an email link can set their first password here.
 */
export const changePassword = authedAction(
  z.object({ current: z.string().optional(), next: newPassword }),
  async ({ current, next }, user) => {
    const supabase = await createSupabaseServerClient();
    const hasPassword = await accountHasPassword(user.id);
    if (hasPassword && current) {
      const check = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await check.auth.signInWithPassword({ email: user.email, password: current });
      if (error) fail(error.code === "invalid_credentials" ? "Your current password isn't right." : authErrorMessage(error));
      await check.auth.signOut({ scope: "local" });
    } else if (hasPassword && !current) {
      fail("Enter your current password. Forgot it? Sign out and use “Forgot password?”.");
    }
    if (current && current === next) fail("Pick a password different from your current one.");
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) fail(authErrorMessage(error));
    return null;
  },
  { allowUnonboarded: true },
);
