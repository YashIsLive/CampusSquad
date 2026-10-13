"use client";

import { useState, useTransition } from "react";
import { sendMagicLink } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MagicLinkForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (sentTo) {
    return (
      <p className="rounded-md bg-muted px-3 py-3 text-sm">
        Check <strong>{sentTo}</strong> for a sign-in link. You can close this tab.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const res = await sendMagicLink({ email, next });
          if (res.ok) setSentTo(email);
          else setError(res.error);
        });
      }}
    >
      <Label htmlFor="email">Email</Label>
      <Input
        id="email"
        type="email"
        autoComplete="email"
        placeholder="you@college.edu"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="h-10"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="h-10" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
