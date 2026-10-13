"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { closeVacancy, removeMember, updateTeam } from "@/app/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/form";

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success?: string, after?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      if (success) toast.success(success);
      after?.();
      router.refresh();
    });
  return { pending, run };
}

export function MemberActions({ teamId, userId, self }: { teamId: string; userId: string; self: boolean }) {
  const { pending, run } = useAction();
  const router = useRouter();
  return (
    <Button
      size="xs"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        if (!confirm(self ? "Leave this team?" : "Remove this member?")) return;
        run(() => removeMember({ teamId, userId }), self ? "You left the team" : "Member removed", () => {
          if (self) router.push("/me/applications");
        });
      }}
    >
      {self ? "Leave" : "Remove"}
    </Button>
  );
}

export function VacancyActions({ vacancyId, teamId, pending: pendingApps }: { vacancyId: string; teamId: string; pending: number }) {
  const { pending, run } = useAction();
  return (
    <div className="flex shrink-0 gap-2">
      <Button size="sm" variant="outline" render={<Link href={`/teams/${teamId}/applications`} />}>
        {pendingApps} applicant{pendingApps === 1 ? "" : "s"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          if (confirm("Close this role? Pending applicants will be notified.")) run(() => closeVacancy({ vacancyId }), "Role closed");
        }}
      >
        Close
      </Button>
    </div>
  );
}

export function TeamSettings({ team }: { team: { id: string; name: string; ideaPitch: string; isOpen: boolean } }) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(team);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Settings /> Team settings
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Team settings</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => updateTeam({ teamId: team.id, name: v.name, ideaPitch: v.ideaPitch, isOpen: v.isOpen }), "Saved", () => setOpen(false));
            }}
          >
            <Field label="Name" htmlFor="tname">
              <Input id="tname" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required />
            </Field>
            <Field label="Idea pitch" htmlFor="tpitch" hint="Shown on every role you post.">
              <Textarea id="tpitch" rows={3} value={v.ideaPitch} onChange={(e) => setV({ ...v, ideaPitch: e.target.value })} maxLength={300} />
            </Field>
            <label className="flex items-center justify-between text-sm">
              Recruiting
              <Switch checked={v.isOpen} onCheckedChange={(c) => setV({ ...v, isOpen: c })} />
            </label>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
