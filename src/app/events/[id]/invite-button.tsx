"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { inviteToTeam } from "@/app/actions/teams";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function InviteButton({ teamId, userId, name }: { teamId: string; userId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button size="sm" variant="outline" className="self-start" onClick={() => setOpen(true)}>
        Invite to my team
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite {name}</DialogTitle>
            <DialogDescription>They&apos;ll get a notification and can accept or decline.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await inviteToTeam({ teamId, userId, message: message || undefined });
                if (!res.ok) return void toast.error(res.error);
                toast.success(`Invite sent to ${res.data.name}`);
                setOpen(false);
                router.refresh();
              });
            }}
          >
            <Textarea
              rows={3}
              placeholder="Optional note — what you're building and why they'd fit"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={400}
            />
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Send invite"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
