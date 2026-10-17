"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setChecklistHidden, setGuideTrack } from "@/app/actions/guide";
import { cn } from "@/lib/utils";

export function ChecklistControls({ track }: { track: "student" | "organizer" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="flex items-center gap-2">
      <div role="radiogroup" aria-label="Show steps for" className="flex rounded-md border border-rule bg-card p-0.5 text-xs">
        {(
          [
            ["student", "I'm joining"],
            ["organizer", "I'm hosting"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={track === value}
            disabled={pending}
            onClick={() => track !== value && run(() => setGuideTrack({ track: value }))}
            className={cn("h-8 rounded-[5px] px-2.5", track === value ? "bg-ink text-paper" : "text-muted-foreground hover:text-foreground")}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => setChecklistHidden({ hidden: true }))}
        className="h-8 rounded-md px-2 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Hide
      </button>
    </div>
  );
}
