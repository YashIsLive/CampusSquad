import Link from "next/link";
import { ViewTransition, type ReactNode } from "react";
import type { schema } from "@/db";
import { EventArt } from "@/components/event-art";
import { DateBlock, MetaLine, Stamp } from "@/components/noticeboard";
import { EVENT_TYPE_LABEL, MODE_LABEL, relative } from "@/lib/format";
import { cn } from "@/lib/utils";

type EventRow = typeof schema.events.$inferSelect;

export type CardEvent = Pick<
  EventRow,
  | "id" | "title" | "type" | "mode" | "city" | "startsAt" | "endsAt" | "regDeadline" | "teamMin" | "teamMax"
  | "isFree" | "beginnerFriendly" | "posterUrl" | "status" | "registrationsOpen" | "externalUrl"
> & { org: { name: string; slug: string } };

/** Shared-element names so a card's poster and title morph into the event page. */
export const posterVT = (id: string) => `poster-${id}`;
export const titleVT = (id: string) => `title-${id}`;

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

  return (
    <article
      className="group lift relative flex flex-col rounded-lg border border-rule bg-card"
      data-tour={tourTarget ? "event-card" : undefined}
      style={{ "--i": index } as React.CSSProperties}
    >
      <ViewTransition name={posterVT(event.id)} share="morph" default="none">
        <EventArt id={event.id} type={event.type} posterUrl={event.posterUrl} className="aspect-[16/9] rounded-t-[calc(var(--radius)-1px)]">
          <span className="label-mono absolute top-2.5 left-2.5 rounded-sm bg-paper px-1.5 py-0.5 text-ink">
            {EVENT_TYPE_LABEL[event.type]}
          </span>
          {showStatus && event.status !== "published" && (
            <span className="label-mono absolute top-2.5 left-1/2 -translate-x-1/2 rounded-sm bg-ink px-1.5 py-0.5 text-paper">{event.status}</span>
          )}
          {closingSoon && (
            <span className="absolute right-2.5 bottom-2.5 rounded-sm bg-paper px-1 py-0.5">
              <Stamp>Closing soon</Stamp>
            </span>
          )}
        </EventArt>
      </ViewTransition>
      {action && (
        <div className="absolute top-2 right-2 z-10" data-tour={tourTarget ? "save" : undefined}>
          {action}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-3.5">
        <div className="flex gap-3">
          <DateBlock date={event.startsAt} size="sm" className={cn(over && "opacity-60")} />
          <div className="min-w-0">
            <h3 className="text-[1.05rem] leading-snug font-bold">
              <Link href={`/events/${event.id}`} className="outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-ink">
                <ViewTransition name={titleVT(event.id)} share="morph" default="none">
                  <span>{event.title}</span>
                </ViewTransition>
              </Link>
            </h3>
            <p className="truncate text-sm text-muted-foreground">{event.org.name}</p>
          </div>
        </div>
        <MetaLine
          items={[
            MODE_LABEL[event.mode] + (event.mode !== "online" && event.city ? ` · ${event.city}` : ""),
            event.teamMax === 1 ? "Solo" : `Teams ${event.teamMin}–${event.teamMax}`,
            event.isFree ? "Free" : "Paid",
            event.beginnerFriendly && "Beginner-friendly",
          ]}
        />
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-dashed border-rule pt-2.5">
          {over ? (
            <span className="label-mono text-muted-foreground">Event over</span>
          ) : closed ? (
            <span className="label-mono text-muted-foreground">Registrations closed</span>
          ) : (
            <span className={cn("label-mono flex items-center gap-1.5", closingSoon ? "font-semibold text-signal-ink" : "text-foreground")}>
              <span aria-hidden="true" className={cn("size-1.5 rounded-full", closingSoon ? "bg-signal motion-safe:animate-pulse" : "bg-ok")} />
              Closes {relative(event.regDeadline, now)}
            </span>
          )}
          {event.externalUrl && <span className="label-mono text-muted-foreground">External reg.</span>}
        </div>
        {footer && <div className="relative z-10">{footer}</div>}
      </div>
    </article>
  );
}
