"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { acceptApplication, reviewApplication } from "@/app/actions/teams";
import { Button } from "@/components/ui/button";

export function ApplicationActions({
  applicationId,
  name,
  shortlisted,
  canAccept,
}: {
  applicationId: string;
  name: string;
  shortlisted: boolean;
  canAccept: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(success);
      router.refresh();
    });

  return (
    <div className="ml-auto flex flex-wrap gap-2">
      {!shortlisted && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => reviewApplication({ applicationId, decision: "shortlist" }), "Shortlisted")}>
          Shortlist
        </Button>
      )}
      <Button
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() => {
          if (confirm(`Reject ${name}? They'll be notified.`)) run(() => reviewApplication({ applicationId, decision: "reject" }), "Rejected");
        }}
      >
        Reject
      </Button>
      <Button
        size="sm"
        disabled={pending || !canAccept}
        title={canAccept ? undefined : "This role or your team is already full"}
        onClick={() => run(() => acceptApplication({ applicationId }), `${name} joined your team 🎉`)}
      >
        Accept
      </Button>
    </div>
  );
}
