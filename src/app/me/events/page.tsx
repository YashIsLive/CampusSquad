import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { CalendarPlus } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getAdminOrgs } from "@/lib/queries";
import { googleCalendarUrl } from "@/lib/calendar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { EventCard } from "@/components/event-card";
import { SaveEventButton } from "@/app/events/[id]/save-button";

export const metadata: Metadata = { title: "My events" };

export default async function MyEventsPage() {
  const user = await requireUser({ next: "/me/events" });
  const orgs = await getAdminOrgs(user.id);

  const [registrations, saved, hosting] = await Promise.all([
    db.query.registrations.findMany({
      where: eq(schema.registrations.userId, user.id),
      with: { event: { with: { org: { columns: { name: true, slug: true } } } }, team: { columns: { id: true, name: true } } },
    }),
    db.query.savedEvents.findMany({
      where: eq(schema.savedEvents.userId, user.id),
      with: { event: { with: { org: { columns: { name: true, slug: true } } } } },
      orderBy: asc(schema.savedEvents.createdAt),
    }),
    orgs.length
      ? db.query.events.findMany({
          where: (e, { inArray }) => inArray(e.orgId, orgs.map((o) => o.id)),
          with: { org: { columns: { name: true, slug: true } } },
          orderBy: (e, { desc }) => desc(e.startsAt),
        })
      : [],
  ]);

  const now = new Date();
  const registeredIds = new Set(registrations.map((r) => r.eventId));
  const upcoming = registrations.filter((r) => r.event.endsAt >= now).sort((a, b) => +a.event.startsAt - +b.event.startsAt);
  const past = registrations.filter((r) => r.event.endsAt < now);
  const savedOnly = saved.filter((s) => !registeredIds.has(s.eventId) && s.event.endsAt >= now && s.event.status !== "draft");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:py-10">
      <h1 className="text-4xl leading-[0.95] font-black sm:text-5xl">My events</h1>

      {hosting.length > 0 && (
        <Section title="Hosting">
          {hosting.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              showStatus
              action={
                <Button size="xs" variant="secondary" className="bg-background/90" render={<Link href={`/events/${e.id}/manage`} />}>
                  Manage
                </Button>
              }
            />
          ))}
        </Section>
      )}

      <Section title="Registered — upcoming">
        {upcoming.length === 0 ? (
          <EmptyState
            compact
            className="col-span-full"
            title="You haven't registered for anything upcoming"
            action={<Button render={<Link href="/" />}>Find events</Button>}
          />
        ) : (
          upcoming.map((r) => (
            <div key={r.id} className="flex flex-col gap-1.5">
              <EventCard event={r.event} />
              <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
                <span>
                  {r.event.teamMax > 1 &&
                    (r.team ? (
                      <Link href={`/teams/${r.team.id}`} className="hover:underline">
                        Team {r.team.name}
                      </Link>
                    ) : (
                      <Link href={`/events/${r.eventId}?tab=teams`} className="text-signal-ink hover:underline">
                        No team yet — find one
                      </Link>
                    ))}
                </span>
                <a href={googleCalendarUrl(r.event)} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
                  <CalendarPlus className="size-3.5" /> Calendar
                </a>
              </div>
            </div>
          ))
        )}
      </Section>

      <Section title="Saved">
        {savedOnly.length === 0 ? (
          <EmptyState compact className="col-span-full" title="Nothing saved" description="Tap the bookmark on any event to get a reminder 24 h before it closes." />
        ) : (
          savedOnly.map((s) => (
            <div key={s.eventId} className="flex flex-col gap-1.5">
              <EventCard event={s.event} action={<SaveEventButton eventId={s.eventId} initialSaved compact />} />
              <a
                href={googleCalendarUrl(s.event)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 self-end px-1 text-xs text-muted-foreground hover:underline"
              >
                <CalendarPlus className="size-3.5" /> Add to Google Calendar
              </a>
            </div>
          ))
        )}
      </Section>

      {past.length > 0 && (
        <Section title="Past">
          {past.map((r) => (
            <EventCard key={r.id} event={r.event} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-bold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}
