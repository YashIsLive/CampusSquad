"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setEventStatus } from "@/app/actions/events";
import { Button } from "@/components/ui/button";

export function StatusControls({
  eventId,
  status,
  registrationsOpen,
}: {
  eventId: string;
  status: "draft" | "published" | "closed";
  registrationsOpen: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (patch: { status?: typeof status; registrationsOpen?: boolean }, msg: string) =>
    startTransition(async () => {
      const res = await setEventStatus({ eventId, ...patch });
      if (!res.ok) return void toast.error(res.error);
      toast.success(msg);
      router.refresh();
    });

  return (
    <>
      {status === "published" ? (
        <>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run({ registrationsOpen: !registrationsOpen }, registrationsOpen ? "Registrations closed" : "Registrations reopened")}>
            {registrationsOpen ? "Close registrations" : "Reopen registrations"}
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => confirm("Unpublish? It will disappear from the feed.") && run({ status: "draft" }, "Unpublished")}>
            Unpublish
          </Button>
        </>
      ) : (
        <Button size="sm" disabled={pending} onClick={() => run({ status: "published" }, "Published")}>
          Publish
        </Button>
      )}
    </>
  );
}
