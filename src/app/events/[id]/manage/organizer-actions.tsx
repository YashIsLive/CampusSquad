"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { finalizeAttendance, nudgeSoloRegistrants } from "@/app/actions/manage";
import { Button } from "@/components/ui/button";

export function NudgeSoloButton({ eventId, solo, nudgedAt }: { eventId: string; solo: number; nudgedAt: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (solo === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await nudgeSoloRegistrants({ eventId });
            if (!res.ok) return void toast.error(res.error);
            toast.success(`Nudged ${res.data.nudged} solo registrant${res.data.nudged === 1 ? "" : "s"} to the team board`);
            router.refresh();
          })
        }
      >
        <Send /> Nudge {solo} to find a team
      </Button>
      {nudgedAt && <p className="text-xs text-muted-foreground">Last nudged {nudgedAt}</p>}
    </div>
  );
}

export function FinalizeAttendanceButton({
  eventId,
  started,
  finalizedAt,
  pendingCount,
}: {
  eventId: string;
  started: boolean;
  finalizedAt: string | null;
  pendingCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (finalizedAt) {
    return <p className="text-sm text-muted-foreground">Attendance finalized {finalizedAt}. Late check-ins still update reliability.</p>;
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-rule bg-card p-4">
      <h2 className="text-xl font-bold">Finalize attendance</h2>
      <p className="text-sm text-muted-foreground">
        When check-in is over, mark the {pendingCount} registrant{pendingCount === 1 ? "" : "s"} who didn&apos;t show as no-shows. This
        feeds each student&apos;s reliability score, which team leaders see when reviewing applications.
      </p>
      <Button
        className="self-start"
        variant="outline"
        disabled={pending || !started}
        title={started ? undefined : "Available once the event starts"}
        onClick={() => {
          if (!confirm(`Mark ${pendingCount} unchecked registrant(s) as no-shows?`)) return;
          startTransition(async () => {
            const res = await finalizeAttendance({ eventId });
            if (!res.ok) return void toast.error(res.error);
            toast.success(`Attendance finalized · ${res.data.noShows} no-show${res.data.noShows === 1 ? "" : "s"}`);
            router.refresh();
          });
        }}
      >
        <UserCheck /> Finalize attendance
      </Button>
    </div>
  );
}
