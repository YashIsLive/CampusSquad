import Link from "next/link";
import { ViewTransition, type ReactNode } from "react";
import type { schema } from "@/db";
import { MetaLine, Slots, Stamp } from "@/components/noticeboard";
import { EVENT_TYPE_LABEL, MODE_LABEL, TIME_ZONE, relative } from "@/lib/format";
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

const fixtureDate = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short" });

/**
 * One event, written like a fixture: when, what, where — and how many team spots are still open.
 * Text first; the poster lives on the event page.
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
      className={cn("group lift relative flex flex-col overflow-hidden rounded-xl border border-rule bg-card", over && "opacity-70")}
      data-tour={tourTarget ? "event-card" : undefined}
      style={{ "--i": index, "--type": `var(--type-${event.type})` } as React.CSSProperties}
    >
      {/* Type colour runs down the left edge, like a team's kit colour on a fixture list. */}
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-(--type)" />

      <div className="flex flex-1 flex-col gap-3 py-4 pr-4 pl-5">
        <div className="flex min-h-8 items-start justify-between gap-2">
          <p className="label-mono pt-1.5">
            <time dateTime={event.startsAt.toISOString()}>{fixtureDate.format(event.startsAt)}</time>
            <span className="text-muted-foreground"> · {EVENT_TYPE_LABEL[event.type]}</span>
            {showStatus && event.status !== "published" && <span className="ml-1.5 rounded-sm bg-ink px-1 text-paper">{event.status}</span>}
          </p>
          {action && (
            <div className="relative z-10 -mt-1 -mr-1.5" data-tour={tourTarget ? "save" : undefined}>
              {action}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xl leading-[1.15] font-bold">
            <Link
              href={`/events/${event.id}`}
              className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-ink"
            >
              <ViewTransition name={titleVT(event.id)} share="morph" default="none">
                <span>{event.title}</span>
              </ViewTransition>
            </Link>
          </h3>
          <p className="mt-1 truncate text-sm text-muted-foreground">{event.org.name}</p>
        </div>

        <MetaLine
          items={[
            event.mode === "online" ? "Online" : `${MODE_LABEL[event.mode]}${event.city ? `, ${event.city}` : ""}`,
            team ? `Teams of ${event.teamMin === event.teamMax ? event.teamMax : `${event.teamMin}–${event.teamMax}`}` : "Solo",
            event.isFree ? "Free" : "Paid",
            event.beginnerFriendly && "Good for beginners",
          ]}
        />

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-rule pt-3 text-sm">
          {team && spots > 0 && !over ? (
            <span className="flex items-center gap-2">
              <Slots filled={0} total={Math.min(spots, 5)} />
              <span className="font-medium">
                {spots} open spot{spots === 1 ? "" : "s"}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{over ? "Finished" : team ? "No open spots yet" : "Just you"}</span>
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
