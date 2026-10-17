import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import type { CurrentUser } from "@/lib/auth";
import { getChecklist } from "@/lib/guide";
import { cn } from "@/lib/utils";
import { ChecklistControls } from "./checklist-controls";

/**
 * "Get started" panel on the feed. Progress comes from real activity, so it never lies:
 * an item ticks off when you've actually done the thing, wherever you did it.
 */
export async function GettingStarted({ user }: { user: CurrentUser }) {
  const { track, items, hidden } = await getChecklist(user);
  if (hidden) return null;
  const done = items.filter((i) => i.done).length;
  const allDone = done === items.length;
  const nextItem = items.find((i) => !i.done);

  return (
    <section aria-labelledby="getting-started" className="overflow-hidden rounded-lg border border-ink/25 bg-card motion-safe:animate-rise">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-rule bg-secondary/60 px-4 py-3">
        <div className="min-w-0">
          <h2 id="getting-started" className="text-lg leading-tight font-bold">
            {allDone ? "You're all set" : track === "organizer" ? "Run your first event" : "Get started"}
          </h2>
          <p className="label-mono text-muted-foreground">
            {done} of {items.length} done
          </p>
        </div>
        <ChecklistControls track={track} />
      </div>

      <div
        role="progressbar"
        aria-label="Getting started progress"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={items.length}
        className="h-1 bg-secondary"
      >
        <div className="h-full bg-ok transition-[width] duration-500" style={{ width: `${(done / items.length) * 100}%` }} />
      </div>

      {allDone ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          That&apos;s the whole loop. Use the <strong className="text-foreground">?</strong> in the header whenever you want a tour of a page.
        </p>
      ) : (
        <ol className="grid divide-y divide-dashed divide-rule sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5">
          {items.map((item, i) => (
            <li
              key={item.id}
              className={cn(
                "flex gap-3 px-4 py-3 sm:border-r sm:border-dashed sm:border-rule sm:last:border-r-0",
                item === nextItem && "bg-signal-soft/40",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-xs font-bold",
                  item.done ? "border-ok bg-ok text-paper" : "border-ink/40 text-muted-foreground",
                )}
              >
                {item.done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <div className="min-w-0">
                <p className={cn("text-sm font-semibold", item.done && "text-muted-foreground line-through decoration-1")}>
                  {item.title}
                  <span className="sr-only">{item.done ? " (done)" : " (to do)"}</span>
                </p>
                {!item.done && (
                  <>
                    <p className="text-xs text-muted-foreground">{item.why}</p>
                    <Link
                      href={item.href}
                      className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-signal-ink underline-offset-4 hover:underline"
                    >
                      {item.cta} <ArrowRight className="size-3.5" />
                    </Link>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
