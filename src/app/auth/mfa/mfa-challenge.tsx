"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form";
import { signOut } from "@/app/actions/auth";

export function MfaChallenge({ next }: { next: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.mfa.listFactors();
    const factor = data?.totp.find((f: { status: string }) => f.status === "verified");
    if (!factor) {
      setBusy(false);
      return setError("Two-step sign-in isn't set up on this account.");
    }
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
    setBusy(false);
    if (verifyError) return setError("That code didn't work. Use the newest code from your app.");
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-ink bg-card p-5">
      <Field label="6-digit code" htmlFor="mfa-code" error={error ?? undefined}>
        <Input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="h-12 text-center font-mono text-xl tracking-[0.4em]"
        />
      </Field>
      <Button type="submit" size="lg" disabled={busy || code.length !== 6}>
        {busy ? "Checking…" : "Continue"}
      </Button>
      <button type="button" onClick={() => void signOut()} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        Lost your phone? Sign out, then contact us.
      </button>
    </form>
  );
}
