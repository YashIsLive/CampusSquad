"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { closeAvailability, postAvailability } from "@/app/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, NativeSelect } from "@/components/form";

type Existing = { rolesWanted: string[]; note: string; scope: "intra" | "cross"; hoursPerWeek: number | null };

export function AvailabilityForm({ eventId, existing, allowCross }: { eventId: string; existing: Existing | null; allowCross: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [roles, setRoles] = useState(existing?.rolesWanted.join(", ") ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [scope, setScope] = useState<"intra" | "cross">(allowCross ? (existing?.scope ?? "cross") : "intra");
  const [hours, setHours] = useState(existing?.hoursPerWeek?.toString() ?? "");

  return (
    <div className="flex gap-2">
      <Button size="sm" data-tour="looking" onClick={() => setOpen(true)}>
        {existing ? "Edit my free-agent card" : "List me as a free agent"}
      </Button>
      {existing && (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await closeAvailability({ eventId });
              if (!res.ok) return void toast.error(res.error);
              toast.success("You're no longer listed");
              router.refresh();
            })
          }
        >
          Remove
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Be a free agent</DialogTitle>
            <DialogDescription>Team leads at this event see your card and can invite you. This also signs you up for the event.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await postAvailability({
                  eventId,
                  rolesWanted: roles.split(",").map((r) => r.trim()).filter(Boolean),
                  note,
                  scope,
                  hoursPerWeek: hours ? Number(hours) : null,
                });
                if (!res.ok) return void toast.error(res.error);
                toast.success("You're listed as a free agent");
                setOpen(false);
                router.refresh();
              });
            }}
          >
            <Field label="Roles you want" htmlFor="roles" hint="Comma-separated, e.g. ML engineer, Backend">
              <Input id="roles" value={roles} onChange={(e) => setRoles(e.target.value)} required />
            </Field>
            <Field label="Note" htmlFor="note">
              <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} placeholder="What you've built, what you want to learn, availability" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Teams from" htmlFor="scope">
                <NativeSelect id="scope" value={scope} onChange={(e) => setScope(e.target.value as "intra" | "cross")}>
                  <option value="intra">My college only</option>
                  {allowCross && <option value="cross">Any college</option>}
                </NativeSelect>
              </Field>
              <Field label="Hours / week" htmlFor="hours">
                <Input id="hours" type="number" min={1} max={80} value={hours} onChange={(e) => setHours(e.target.value)} />
              </Field>
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Posting…" : "Post card"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
