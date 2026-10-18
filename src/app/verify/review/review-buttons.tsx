"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reviewIdCard } from "@/app/actions/verification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReviewButtons({ requestId, name }: { requestId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  const decide = (approve: boolean) =>
    start(async () => {
      const res = await reviewIdCard({ requestId, approve, note });
      if (!res.ok) return void toast.error(res.error);
      toast.success(approve ? (res.data.granted ? `${name} is verified` : `Approved — but ${name} has since changed college`) : "Rejected; they've been told why");
      router.refresh();
    });

  if (rejecting) {
    return (
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          decide(false);
        }}
      >
        <label htmlFor={`note-${requestId}`} className="text-sm font-medium">
          What should {name.split(" ")[0]} fix?
        </label>
        <Input id={`note-${requestId}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Photo is blurry / name doesn't match" maxLength={300} required autoFocus />
        <div className="flex gap-2">
          <Button type="submit" variant="destructive" size="sm" disabled={pending || !note.trim()}>
            Reject
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setRejecting(false)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={() => decide(true)}>
        Approve
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => setRejecting(true)}>
        Reject…
      </Button>
    </div>
  );
}
