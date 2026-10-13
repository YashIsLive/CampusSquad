"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { respondToInvite, withdrawApplication } from "@/app/actions/teams";
import { Button } from "@/components/ui/button";

export function InviteResponse({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const respond = (accept: boolean) =>
    startTransition(async () => {
      const res = await respondToInvite({ inviteId, accept });
      if (!res.ok) return void toast.error(res.error);
      toast.success(accept ? "You joined the team!" : "Invite declined");
      if (res.data.teamId) router.push(`/teams/${res.data.teamId}`);
      else router.refresh();
    });
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => respond(false)}>
        Decline
      </Button>
      <Button size="sm" disabled={pending} onClick={() => respond(true)}>
        Accept
      </Button>
    </div>
  );
}

export function WithdrawButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await withdrawApplication({ applicationId });
          if (!res.ok) return void toast.error(res.error);
          toast.success("Application withdrawn");
          router.refresh();
        })
      }
    >
      Withdraw
    </Button>
  );
}
