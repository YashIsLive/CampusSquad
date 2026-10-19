"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authedAction, fail } from "@/lib/actions";
import { deleteAccount, deletionBlockers } from "@/lib/account";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { forgetThisDevice } from "@/lib/trusted-device";

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
