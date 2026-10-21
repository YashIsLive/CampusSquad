"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { rejectCollege, setAdmin, setOrgVerified, setStudentVerified, takeDownEvent, verifyCollege } from "@/app/actions/admin";
import { closeReport } from "@/app/actions/reports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/form";

export function CollegeReview({
  college,
}: {
  college: { id: string; name: string; city: string; state: string; students: number; suggestedDomain: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState({ name: college.name, city: college.city, state: college.state, emailDomain: college.suggestedDomain });

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-rule bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await verifyCollege({ collegeId: college.id, ...v });
          if (!res.ok) return void toast.error(res.error);
          toast.success(`${v.name} verified · ${res.data.studentsVerified} student(s) now verified`);
          router.refresh();
        });
      }}
    >
      <p className="text-xs text-muted-foreground">
        Requested by {college.students} student{college.students === 1 ? "" : "s"}. Check the domain against the college&apos;s official website.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor={`${college.id}-name`}>
          <Input id={`${college.id}-name`} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required />
        </Field>
        <Field
          label="Student email domain (optional)"
          htmlFor={`${college.id}-domain`}
          hint="Only the college's own domain, from its official website. Leave empty if students don't get college email: they'll verify with their ID or classmates instead."
        >
          <Input id={`${college.id}-domain`} value={v.emailDomain} onChange={(e) => setV({ ...v, emailDomain: e.target.value })} placeholder="college.ac.in" />
        </Field>
        <Field label="City" htmlFor={`${college.id}-city`}>
          <Input id={`${college.id}-city`} value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} required />
        </Field>
        <Field label="State" htmlFor={`${college.id}-state`}>
          <Input id={`${college.id}-state`} value={v.state} onChange={(e) => setV({ ...v, state: e.target.value })} required />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Reject "${college.name}"? Its students will need to pick their college again.`)) return;
            startTransition(async () => {
              const res = await rejectCollege({ collegeId: college.id });
              if (!res.ok) return void toast.error(res.error);
              toast.success("Request rejected");
              router.refresh();
            });
          }}
        >
          Reject
        </Button>
        <Button type="submit" disabled={pending}>
          Verify college
        </Button>
      </div>
    </form>
  );
}

export function OrgVerifyToggle({ orgId, verified }: { orgId: string; verified: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      Verified
      <Switch
        checked={verified}
        disabled={pending}
        onCheckedChange={(checked) =>
          startTransition(async () => {
            const res = await setOrgVerified({ orgId, verified: checked });
            if (!res.ok) return void toast.error(res.error);
            router.refresh();
          })
        }
      />
    </label>
  );
}

/** Row actions on the People section: verify a student by hand, grant or remove admin. */
export function PersonActions({ userId, name, verified, admin, self }: { userId: string; name: string; verified: boolean; admin: boolean; self: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(done);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <Button
        size="xs"
        variant={verified ? "ghost" : "outline"}
        disabled={pending}
        onClick={() => run(() => setStudentVerified({ userId, verified: !verified }), verified ? `${name} is no longer verified` : `${name} is verified`)}
      >
        {verified ? "Unverify" : "Verify"}
      </Button>
      {!(self && admin) && (
        <Button
          size="xs"
          variant={admin ? "destructive" : "ghost"}
          disabled={pending}
          onClick={() => {
            if (confirm(admin ? `Remove admin access from ${name}?` : `Make ${name} a platform admin? They'll be able to verify colleges, clubs and students.`))
              run(() => setAdmin({ userId, admin: !admin }), admin ? "Admin access removed" : `${name} is now an admin`);
          }}
        >
          {admin ? "Remove admin" : "Make admin"}
        </Button>
      )}
    </div>
  );
}

export function TakeDownButton({ eventId, title }: { eventId: string; title: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="xs"
      variant="destructive"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Take "${title}" off the site? It goes back to a draft its organizers can fix and republish.`)) return;
        startTransition(async () => {
          const res = await takeDownEvent({ eventId });
          if (!res.ok) return void toast.error(res.error);
          toast.success("Event taken down");
          router.refresh();
        });
      }}
    >
      Take down
    </Button>
  );
}

/** Close a report: "Acted on it" (resolved) or "No action" (dismissed), with an optional note the reporter sees. */
export function ReportActions({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const close = (outcome: "resolved" | "dismissed") =>
    startTransition(async () => {
      const res = await closeReport({ reportId, outcome, note });
      if (!res.ok) return void toast.error(res.error);
      toast.success(outcome === "resolved" ? "Marked as acted on; the reporter has been told" : "Dismissed; the reporter has been told");
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-2">
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the reporter (optional)" maxLength={500} aria-label="Note to the reporter" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending} onClick={() => close("resolved")}>
          Acted on it
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => close("dismissed")}>
          No action needed
        </Button>
      </div>
    </div>
  );
}
