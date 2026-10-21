"use client";

import { useState, useTransition } from "react";
import { updatePassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/form";
import { PasswordInput } from "@/app/(auth)/login/password-input";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const res = await updatePassword({ password });
          if (res && !res.ok) setError(res.error);
        });
      }}
    >
      <Field label="New password" htmlFor="new-password" hint="At least 10 characters, with a letter and a number." error={error ?? undefined}>
        <PasswordInput id="new-password" autoComplete="new-password" value={password} onChange={setPassword} invalid={Boolean(error)} />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
