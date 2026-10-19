"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteMyAccount } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form";

export function DeleteAccount({ blocked }: { blocked: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <Button variant="destructive" className="w-fit" disabled={blocked} onClick={() => setOpen(true)}>
        Delete my account
      </Button>
    );
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await deleteMyAccount({ confirm });
          if (res && !res.ok) toast.error(res.error);
        });
      }}
    >
      <Field label='Type "delete" to confirm' htmlFor="confirm-delete">
        <Input id="confirm-delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" autoFocus className="max-w-xs" />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" disabled={pending || confirm.trim().toLowerCase() !== "delete"}>
          {pending ? "Deleting…" : "Delete everything"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Keep my account
        </Button>
      </div>
    </form>
  );
}
