"use client";

import { useOptimistic, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { toggleSaveEvent } from "@/app/actions/registrations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SaveEventButton({
  eventId,
  initialSaved,
  compact = false,
}: {
  eventId: string;
  initialSaved: boolean;
  compact?: boolean;
}) {
  const [, startTransition] = useTransition();
  const [saved, setSaved] = useOptimistic(initialSaved);

  return (
    <Button
      variant={compact ? "secondary" : "outline"}
      size={compact ? "icon-sm" : "default"}
      aria-pressed={saved}
      aria-label={saved ? "Unsave event" : "Save event"}
      className={cn(compact && "bg-background/90")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          setSaved(!saved);
          const res = await toggleSaveEvent({ eventId, save: !saved });
          if (!res.ok) toast.error(res.error);
          else if (res.data.saved) toast.success("Saved — we'll remind you before the deadline");
        });
      }}
    >
      <Bookmark className={cn(saved && "fill-current")} />
      {!compact && (saved ? "Saved" : "Save")}
    </Button>
  );
}
