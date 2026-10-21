"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { acceptTerms } from "@/app/actions/consent";
import { Button } from "@/components/ui/button";

export function ConsentForm({ next }: { next: string }) {
  const [adult, setAdult] = useState(false);
  const [agree, setAgree] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await acceptTerms({ adult, agree, next });
          if (res && !res.ok) toast.error(res.error);
        });
      }}
    >
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-0.5 size-4 accent-[var(--ink)]" />
        I&apos;m 18 or older.
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 accent-[var(--ink)]" />
        <span>
          I agree to the{" "}
          <a href="/terms" target="_blank" className="underline decoration-court decoration-2 underline-offset-4">
            terms
          </a>{" "}
          and{" "}
          <a href="/privacy" target="_blank" className="underline decoration-court decoration-2 underline-offset-4">
            privacy policy
          </a>
          .
        </span>
      </label>
      <Button type="submit" className="mt-2 w-fit" disabled={pending || !adult || !agree}>
        {pending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
