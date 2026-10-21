"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form";

type Factor = { id: string; status: string; friendly_name?: string; created_at: string };

/**
 * Set up or remove two-step sign-in with an authenticator app (Google Authenticator, Microsoft
 * Authenticator, 1Password…). Supabase Auth stores the factor; we only show the QR and check a code.
 */
export function TwoStep({ next }: { next: string | null }) {
  const router = useRouter();
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await getSupabaseBrowserClient().auth.mfa.listFactors();
    if (error) return void toast.error(error.message);
    setFactors(data.totp as Factor[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the account's factors once on mount
    void load();
  }, [load]);

  const verified = factors?.find((f) => f.status === "verified");

  async function start() {
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    // Clear any half-finished setup from before.
    for (const f of factors ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}` });
    setBusy(false);
    if (error) return void toast.error(error.message);
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolling) return;
    setBusy(true);
    const { error } = await getSupabaseBrowserClient().auth.mfa.challengeAndVerify({ factorId: enrolling.id, code: code.trim() });
    setBusy(false);
    if (error) return void toast.error("That code didn't work. Check the time on your phone and try the newest code.");
    toast.success("Two-step sign-in is on");
    setEnrolling(null);
    setCode("");
    if (next) router.push(next);
    else {
      await load();
      router.refresh();
    }
  }

  async function remove() {
    if (!verified || !confirm_("Turn off two-step sign-in? Your account will only be protected by your password or email.")) return;
    setBusy(true);
    const { error } = await getSupabaseBrowserClient().auth.mfa.unenroll({ factorId: verified.id });
    setBusy(false);
    if (error) return void toast.error(error.message.includes("AAL2") ? "Enter a code from your app first (sign out and back in)." : error.message);
    toast.success("Two-step sign-in is off");
    await load();
    router.refresh();
  }

  if (!factors) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (verified && !enrolling) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          <strong>On.</strong> When you sign in, we&apos;ll ask for a code from your authenticator app.
        </p>
        <Button variant="destructive" className="w-fit" disabled={busy} onClick={remove}>
          Turn off
        </Button>
      </div>
    );
  }

  if (enrolling) {
    return (
      <form className="flex flex-col gap-4" onSubmit={confirm}>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
          <li>Scan this code, or type the key below.</li>
          <li>Enter the 6-digit code it shows.</li>
        </ol>
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG data URL from Supabase */}
        <img src={enrolling.qr} alt="QR code for your authenticator app" className="size-44 rounded-lg bg-white p-2" />
        <p className="text-xs text-muted-foreground">
          Key: <span className="font-mono break-all select-all">{enrolling.secret}</span>
        </p>
        <Field label="6-digit code" htmlFor="totp">
          <Input
            id="totp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="h-11 max-w-40 text-center font-mono text-lg tracking-[0.4em]"
          />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy || code.length !== 6}>
            Turn on
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEnrolling(null)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        <strong>Off.</strong> Add a second step with an authenticator app, so a stolen password isn&apos;t enough to get in.
      </p>
      <Button className="w-fit" disabled={busy} onClick={start}>
        Set up two-step sign-in
      </Button>
    </div>
  );
}

const confirm_ = (message: string) => window.confirm(message);
