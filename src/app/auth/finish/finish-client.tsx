"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { authErrorMessage, safeNext } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";

/**
 * Finishes sign-in for links that carry tokens in the URL fragment (#access_token=…), which the
 * server never sees. Stores the session in cookies via the browser client, then continues.
 */
export function FinishClient() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // The fragment is read once and then wiped, so a second (Strict Mode) run must not re-read it.
    if (started.current) return;
    started.current = true;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const hashError = hash.get("error_description") ?? hash.get("error");
    // Never leave tokens sitting in the address bar or history.
    history.replaceState(null, "", window.location.pathname + window.location.search);

    const finish = async () => {
      if (hashError) return setError(authErrorMessage(hashError));
      if (!accessToken || !refreshToken) return setError("This sign-in link is incomplete or has already been used. Request a new one.");
      const { error: e } = await getSupabaseBrowserClient().auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (e) return setError(authErrorMessage(e));
      // Let the server decide (profile setup first for new accounts) by going through /auth/continue.
      window.location.replace(hash.get("type") === "recovery" ? "/auth/reset-password" : `/auth/continue?next=${encodeURIComponent(next)}`);
    };
    void finish();
  }, [next]);

  return (
    <div className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      {error ? (
        <>
          <h1 className="text-2xl font-bold">Couldn&apos;t sign you in</h1>
          <p role="alert" className="text-sm text-muted-foreground">
            {error}
          </p>
          <Button render={<Link href={`/login?next=${encodeURIComponent(next)}`} />}>Back to sign in</Button>
        </>
      ) : (
        <p role="status" className="label-mono text-muted-foreground">
          Signing you in…
        </p>
      )}
    </div>
  );
}
