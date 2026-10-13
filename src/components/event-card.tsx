import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import type { schema } from "@/db";
import { Badge } from "@/components/ui/badge";
import { EVENT_TYPE_LABEL, MODE_LABEL, formatShort, relative } from "@/lib/format";
import { cn } from "@/lib/utils";

type EventRow = typeof schema.events.$inferSelect;

const TYPE_GRADIENT: Record<EventRow["type"], string> = {
  hackathon: "from-indigo-500 to-violet-600",
  quiz: "from-amber-400 to-orange-500",
  coding_contest: "from-emerald-500 to-teal-600",
  workshop: "from-sky-500 to-blue-600",
  ideathon: "from-pink-500 to-rose-600",
  ctf: "from-slate-700 to-zinc-900",
};

export function EventCard({
  event,
  showStatus = false,
  action,
}: {
  event: Pick<
    EventRow,
    | "id" | "title" | "type" | "mode" | "city" | "startsAt" | "endsAt" | "regDeadline" | "teamMin" | "teamMax"
    | "isFree" | "beginnerFriendly" | "posterUrl" | "status" | "registrationsOpen" | "externalUrl"
  > & { org: { name: string; slug: string } };
  showStatus?: boolean;
  action?: ReactNode;
}) {
  const now = new Date();
  const closed = event.regDeadline < now || !event.registrationsOpen || event.status === "closed";
  const closingSoon = !closed && event.regDeadline.getTime() - now.getTime() < 48 * 3600 * 1000;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
      <div className={cn("relative h-28 bg-gradient-to-br", TYPE_GRADIENT[event.type])}>
        {event.posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded poster
          <img src={event.posterUrl} alt="" className="absolute inset-0 size-full object-cover" />
        )}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          <Badge className="bg-background/90 text-foreground">{EVENT_TYPE_LABEL[event.type]}</Badge>
          {showStatus && event.status !== "published" && (
            <Badge variant="secondary" className="bg-background/90 capitalize">
              {event.status}
            </Badge>
          )}
        </div>
        {action && <div className="absolute top-2 right-2 z-10">{action}</div>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <h3 className="leading-snug font-medium">
            <Link href={`/events/${event.id}`} className="after:absolute after:inset-0">
              {event.title}
            </Link>
          </h3>
          <p className="text-xs text-muted-foreground">{event.org.name}</p>
        </div>
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" /> {formatShort(event.startsAt)}
            {event.endsAt.toDateString() !== event.startsAt.toDateString() && ` – ${formatShort(event.endsAt)}`}
          </li>
          <li className="flex items-center gap-1.5">
            <MapPin className="size-3.5" /> {MODE_LABEL[event.mode]}
            {event.mode !== "online" && event.city ? ` · ${event.city}` : ""}
          </li>
          <li className="flex items-center gap-1.5">
            <Users className="size-3.5" />
            {event.teamMax === 1 ? "Solo" : `Teams of ${event.teamMin}–${event.teamMax}`}
          </li>
        </ul>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {closed ? (
            <Badge variant="outline">Registrations closed</Badge>
          ) : (
            <Badge variant={closingSoon ? "destructive" : "outline"} className="gap-1">
              <Clock className="size-3" /> Closes {relative(event.regDeadline, now)}
            </Badge>
          )}
          <Badge variant="secondary">{event.isFree ? "Free" : "Paid"}</Badge>
          {event.beginnerFriendly && <Badge variant="secondary">Beginner-friendly</Badge>}
          {event.externalUrl && <Badge variant="outline">External</Badge>}
        </div>
      </div>
    </article>
  );
}
