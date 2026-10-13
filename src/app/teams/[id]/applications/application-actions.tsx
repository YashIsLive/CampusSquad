"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { acceptApplication, messageApplicant, reviewApplication } from "@/app/actions/teams";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [msgOpen, setMsgOpen] = useState(false);
  const [body, setBody] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(success);
      router.refresh();
    });

  return (
    <div className="ml-auto flex flex-wrap gap-2">
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => setMsgOpen(true)}>
        Message
      </Button>
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

      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message {name}</DialogTitle>
            <DialogDescription>Sent as a notification. Ask a follow-up or share a call link.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await messageApplicant({ applicationId, body });
                if (!res.ok) return void toast.error(res.error);
                toast.success("Message sent");
                setBody("");
                setMsgOpen(false);
              });
            }}
          >
            <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} required maxLength={500} />
            <Button type="submit" disabled={pending}>
              Send
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
