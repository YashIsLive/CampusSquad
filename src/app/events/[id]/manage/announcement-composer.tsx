"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { postAnnouncement } from "@/app/actions/manage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function AnnouncementComposer({ eventId, registrantCount }: { eventId: string; registrantCount: number }) {
  const [body, setBody] = useState("");
  const [email, setEmail] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-xl border p-4">
      <h2 className="font-medium">Announce to registrants</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Sends an in-app notification to all {registrantCount} registrants and posts it on the event&apos;s Updates tab.
      </p>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await postAnnouncement({ eventId, body, email });
            if (!res.ok) return void toast.error(res.error);
            toast.success(`Sent to ${res.data.recipients} registrant${res.data.recipients === 1 ? "" : "s"}`);
            setBody("");
          });
        }}
      >
        <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Venue changed to Hall B. Problem statements are live!" maxLength={2000} required />
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
            Also email (if email is configured)
          </label>
          <Button type="submit" disabled={pending || !body.trim()}>
            {pending ? "Sending…" : "Send announcement"}
          </Button>
        </div>
      </form>
    </section>
  );
}
