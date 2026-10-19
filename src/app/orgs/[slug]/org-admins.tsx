"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addOrgAdmin, removeOrgMember } from "@/app/actions/orgs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Member = { userId: string; name: string; username: string; role: string };

export function OrgAdmins({ orgId, members }: { orgId: string; members: Member[] }) {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-rule bg-card p-4">
      <ul className="flex flex-col divide-y">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between py-2 text-sm">
            <Link href={`/u/${m.username}`} className="hover:underline">
              {m.name} <span className="text-muted-foreground">· {m.role}</span>
            </Link>
            {m.role !== "owner" && (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await removeOrgMember({ orgId, userId: m.userId });
                    if (!res.ok) toast.error(res.error);
                  })
                }
              >
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await addOrgAdmin({ orgId, email });
            if (!res.ok) return void toast.error(res.error);
            toast.success(`${res.data.name} is now an admin`);
            setEmail("");
          });
        }}
      >
        <Input type="email" placeholder="Add admin by email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Button type="submit" disabled={pending}>
          Add
        </Button>
      </form>
    </div>
  );
}
