import Link from "next/link";
import { ViewTransition, type ReactNode } from "react";
import type { schema } from "@/db";
import { KitTile } from "@/components/event-kit";
import { MetaLine, Slots, Stamp } from "@/components/noticeboard";
import { EVENT_TYPE_LABEL, MODE_LABEL, relative } from "@/lib/format";
import { cn } from "@/lib/utils";

type EventRow = typeof schema.events.$inferSelect;

export type CardEvent = Pick<
  EventRow,
  | "id" | "title" | "type" | "mode" | "city" | "startsAt" | "endsAt" | "regDeadline" | "teamMin" | "teamMax"
  | "isFree" | "beginnerFriendly" | "posterUrl" | "status" | "registrationsOpen" | "externalUrl"
> & { org: { name: string; slug: string }; openSpots?: number };

/** Shared-element names so a card's title (and the poster on the event page) morph across pages. */
export const posterVT = (id: string) => `poster-${id}`;
export const titleVT = (id: string) => `title-${id}`;

/**
 * One event as a fixture ticket: the date in the type's kit on the left, the facts on the right,
 * and the team spots still open along the bottom.
 */
export function EventCard({
  event,
  showStatus = false,
  action,
  footer,
  index = 0,
  tourTarget = false,
}: {
  event: CardEvent;
  showStatus?: boolean;
  action?: ReactNode;
  footer?: ReactNode;
  index?: number;
  /** First card on the feed carries the guided-tour anchors. */
  tourTarget?: boolean;
}) {
  const now = new Date();
  const closed = event.regDeadline < now || !event.registrationsOpen || event.status === "closed";
  const msLeft = event.regDeadline.getTime() - now.getTime();
  const closingSoon = !closed && msLeft < 48 * 3600 * 1000;
  const over = event.endsAt < now;
  const team = event.teamMax > 1;
  const spots = event.openSpots ?? 0;

  return (
    <article
      className={cn("group lift relative grid grid-cols-[5.25rem_1fr] overflow-hidden rounded-2xl border border-rule bg-card", over && "opacity-70")}
      data-tour={tourTarget ? "event-card" : undefined}
      style={{ "--i": index } as React.CSSProperties}
    >
      <KitTile type={event.type} date={event.startsAt} className="border-r border-rule" />

      <div className="flex min-w-0 flex-col gap-2.5 p-4">
        <div className="flex min-h-7 items-start justify-between gap-2">
          <p className="label-mono pt-1 text-muted-foreground">
            {EVENT_TYPE_LABEL[event.type]}
            {showStatus && event.status !== "published" && <span className="ml-1.5 rounded-sm bg-ink px-1 text-paper">{event.status}</span>}
          </p>
          {action && (
            <div className="relative z-10 -mt-1.5 -mr-1.5" data-tour={tourTarget ? "save" : undefined}>
              {action}
            </div>
          )}
        </div>

        <div className="-mt-1">
          <h3 className="text-xl leading-[1.12] font-bold">
            <Link
              href={`/events/${event.id}`}
              className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:outline-2 focus-visible:after:outline-ink"
            >
              <ViewTransition name={titleVT(event.id)} share="morph" default="none">
                <span>{event.title}</span>
              </ViewTransition>
            </Link>
          </h3>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{event.org.name}</p>
        </div>

        <MetaLine
          items={[
            event.mode === "online" ? "Online" : `${MODE_LABEL[event.mode]}${event.city ? `, ${event.city}` : ""}`,
            team ? `Teams of ${event.teamMin === event.teamMax ? event.teamMax : `${event.teamMin}–${event.teamMax}`}` : "Solo",
            event.isFree ? "Free" : "Paid",
            event.beginnerFriendly && "Good for beginners",
          ]}
        />

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pt-1 text-sm">
          {team && spots > 0 && !over ? (
            <span className="flex items-center gap-2 rounded-full bg-court/45 py-0.5 pr-2.5 pl-1.5">
              <Slots filled={0} total={Math.min(spots, 5)} className="dot-pop" />
              <span className="font-semibold">
                {spots} open spot{spots === 1 ? "" : "s"}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{over ? "Finished" : team ? "No open spots yet" : "On your own"}</span>
          )}
          {over ? null : closed ? (
            <span className="text-muted-foreground">Sign-ups closed</span>
          ) : closingSoon ? (
            <Stamp>Closes {relative(event.regDeadline, now)}</Stamp>
          ) : (
            <span className="text-muted-foreground">Closes {relative(event.regDeadline, now)}</span>
          )}
        </div>
        {footer && <div className="relative z-10">{footer}</div>}
      </div>
    </article>
  );
}
