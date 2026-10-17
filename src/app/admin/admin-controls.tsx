"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { rejectCollege, setOrgVerified, verifyCollege } from "@/app/actions/admin";
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
      className="flex flex-col gap-3 rounded-lg border border-rule bg-card p-4"
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
        <Field label="Email domain" htmlFor={`${college.id}-domain`} hint="Students with this domain (or a subdomain) get verified.">
          <Input id={`${college.id}-domain`} value={v.emailDomain} onChange={(e) => setV({ ...v, emailDomain: e.target.value })} placeholder="college.ac.in" required />
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
