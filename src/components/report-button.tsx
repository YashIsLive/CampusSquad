"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { reportContent } from "@/app/actions/reports";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const REASONS = [
  ["spam", "Spam or a scam"],
  ["fake", "Fake or pretending to be someone else"],
  ["harassment", "Harassment or bullying"],
  ["inappropriate", "Inappropriate or offensive"],
  ["other", "Something else"],
] as const;

/** Small "Report" link that opens a short form. Reports go to the admins' queue. */
export function ReportButton({
  targetType,
  targetId,
  what,
  className,
}: {
  targetType: "event" | "profile" | "team" | "conversation";
  targetId: string;
  /** "this event", "Riya's profile"… */
  what: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number][0] | null>(null);
  const [details, setDetails] = useState("");
  const [pending, start] = useTransition();

  return (
    <>
      <Button type="button" variant="ghost" size="sm" className={className ?? "text-muted-foreground"} onClick={() => setOpen(true)}>
        <Flag /> Report
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report {what}</DialogTitle>
            <DialogDescription>An admin looks at every report within 24 hours. The person you report isn&apos;t told who reported them.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!reason) return;
              start(async () => {
                const res = await reportContent({ targetType, targetId, reason, details });
                if (!res.ok) return void toast.error(res.error);
                toast.success("Thanks. We'll look at it within 24 hours.");
                setOpen(false);
                setReason(null);
                setDetails("");
              });
            }}
          >
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">What&apos;s wrong?</legend>
              {REASONS.map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} className="size-4 accent-[var(--ink)]" />
                  {label}
                </label>
              ))}
            </fieldset>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Anything else we should know? {reason !== "other" && <span className="font-normal text-muted-foreground">(optional)</span>}</span>
              <Textarea rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
            </label>
            <Button type="submit" variant="destructive" disabled={pending || !reason || (reason === "other" && !details.trim())}>
              {pending ? "Sending…" : "Send report"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
