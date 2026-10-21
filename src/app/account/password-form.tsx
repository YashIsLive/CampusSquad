"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { changePassword } from "@/app/actions/account";
import { sendMyPasswordReset } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/form";
import { PasswordInput } from "@/app/(auth)/login/password-input";

/** Change (or set a first) password. Forgot the current one? A reset link to your own email. */
export function PasswordForm({ hasPassword, email }: { hasPassword: boolean; email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await changePassword({ current: hasPassword ? current : undefined, next });
          if (!res.ok) return setError(res.error);
          setCurrent("");
          setNext("");
          toast.success(hasPassword ? "Password changed" : "Password set. You can now sign in with it.");
        });
      }}
    >
      {hasPassword && (
        <Field label="Current password" htmlFor="current-password">
          <PasswordInput id="current-password" autoComplete="current-password" value={current} onChange={setCurrent} />
        </Field>
      )}
      <Field label={hasPassword ? "New password" : "Password"} htmlFor="new-password" hint="At least 10 characters, with a letter and a number." error={error ?? undefined}>
        <PasswordInput id="new-password" autoComplete="new-password" value={next} onChange={setNext} invalid={Boolean(error)} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending || next.length < 10 || (hasPassword && !current)}>
          {pending ? "Saving…" : hasPassword ? "Change password" : "Set password"}
        </Button>
        {hasPassword && (
          <button
            type="button"
            disabled={pending}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() =>
              start(async () => {
                const res = await sendMyPasswordReset();
                if (!res.ok) return void toast.error(res.error);
                toast.success(`Reset link sent to ${email}`);
              })
            }
          >
            Forgot it? Email me a reset link
          </button>
        )}
      </div>
    </form>
  );
}
