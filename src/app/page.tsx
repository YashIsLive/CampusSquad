import Link from "next/link";
import { ViewTransition } from "react";
import { and, eq, inArray, sql } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { getFeed, parseFeedFilters, type FeedScope } from "@/lib/feed";
import { groupByWhen } from "@/lib/group-events";
import { formatShort, relative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { EventCard } from "@/components/event-card";
import { EventArt } from "@/components/event-art";
import { Pin } from "@/components/noticeboard";
import { SaveEventButton } from "@/app/events/[id]/save-button";
import { cn } from "@/lib/utils";
import { FeedFilters } from "./feed-filters";
import { GettingStarted } from "@/components/guide/getting-started";
import { PageTour } from "@/components/guide/page-tour";

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const filters = parseFeedFilters(sp);
  const { scope, events, closingSoon } = await getFeed(user, filters);

  const savedIds = new Set(
    user && events.length
      ? (
          await db
            .select({ id: schema.savedEvents.eventId })
            .from(schema.savedEvents)
            .where(and(eq(schema.savedEvents.userId, user.id), inArray(schema.savedEvents.eventId, events.map((e) => e.id))))
        ).map((r) => r.id)
      : [],
  );

  const scopes: Array<{ key: FeedScope; label: string; disabled?: boolean }> = [
    { key: "campus", label: "My campus", disabled: !user?.collegeId },
    { key: "nearby", label: user?.college ? `Near ${user.college.city}` : "Nearby", disabled: !user?.collegeId },
    { key: "india", label: "All India" },
  ];
  const hrefFor = (s: FeedScope) => {
    const p = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
    p.set("scope", s);
    return `/?${p.toString()}`;
  };

  const groups = groupByWhen(events);
  const filtered = Boolean(filters.q || filters.type || filters.domain || filters.mode || filters.fee || filters.within || filters.size || filters.beginner);
  let index = 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 motion-safe:animate-page-in sm:py-8">
      {user ? (
        <header className="flex flex-col gap-1">
          <p className="label-mono text-muted-foreground">{user.college?.name ?? "CampusSquad"}</p>
          <h1 className="text-3xl font-extrabold sm:text-4xl">
            {scope === "campus" ? "Happening on campus" : scope === "nearby" ? `Happening around ${user.college?.city}` : "Happening across India"}
          </h1>
        </header>
      ) : (
        <Hero events={events.slice(0, 3)} />
      )}

      {user && <GettingStarted user={user} />}
      {user && <PageTour tour="feed" seen={Boolean(user.guide.tours?.feed)} />}

      <div className="flex flex-col gap-3">
        <nav aria-label="Where" data-tour="scope" className="flex w-full gap-1 rounded-lg border border-rule bg-card p-1 sm:w-fit">
          {scopes.map((s) =>
            s.disabled ? (
              <span
                key={s.key}
                aria-disabled="true"
                title="Add your college to your profile to unlock this"
                className="flex-1 cursor-not-allowed rounded-md px-3 py-2 text-center text-sm whitespace-nowrap text-muted-foreground/60 sm:flex-none"
              >
                {s.label}
              </span>
            ) : (
              <Link
                key={s.key}
                href={hrefFor(s.key)}
                aria-current={scope === s.key ? "page" : undefined}
                scroll={false}
                className={cn(
                  "relative flex-1 rounded-md px-3 py-2 text-center text-sm whitespace-nowrap transition-colors sm:flex-none",
                  scope === s.key ? "font-medium text-paper" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {scope === s.key && (
                  <ViewTransition name="scope-pill" share="slide-indicator" default="none">
                    <span aria-hidden="true" className="absolute inset-0 rounded-md bg-ink" />
                  </ViewTransition>
                )}
                <span className="relative">{s.label}</span>
              </Link>
            ),
          )}
        </nav>
        <FeedFilters />
      </div>

      {closingSoon.length > 0 && !filtered && (
        <section aria-labelledby="last-call" className="-mx-4 sm:mx-0">
          <h2 id="last-call" className="label-mono mb-2 flex items-center gap-2 px-4 font-semibold text-signal-ink sm:px-0">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-signal motion-safe:animate-pulse" /> Last call · closing within 48 hours
          </h2>
          <ul className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:px-0">
            {closingSoon.map((e) => (
              <li key={e.id} className="snap-start">
                <Link
                  href={`/events/${e.id}`}
                  className="lift flex w-72 items-stretch overflow-hidden rounded-lg border border-rule bg-card"
                >
                  <EventArt id={e.id} type={e.type} posterUrl={e.posterUrl} className="w-20 shrink-0" />
                  <span className="flex min-w-0 flex-col justify-center gap-1 border-l border-dashed border-rule px-3 py-2.5">
                    <span className="truncate font-display font-bold">{e.title}</span>
                    <span className="label-mono text-signal-ink">Closes {relative(e.regDeadline)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {events.length === 0 ? (
        <EmptyState
          art="board"
          title={filtered ? "Nothing matches those filters" : scope === "campus" ? "The campus board is empty" : "No events here yet"}
          description={
            filtered
              ? "Try removing a filter or two."
              : scope === "campus"
                ? "Look further afield — or be the club that posts the first event."
                : "Check back soon, clubs post new events every week."
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {scope !== "india" && (
                <Button variant="outline" render={<Link href="/?scope=india" />}>
                  Browse all India
                </Button>
              )}
              {user && <Button render={<Link href="/events/new" />}>Post an event</Button>}
            </div>
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`g-${g.key}`}>
              <h2
                id={`g-${g.key}`}
                className="sticky top-14 z-20 -mx-4 mb-3 flex items-baseline justify-between border-b border-rule bg-paper/95 px-4 py-2 text-xl font-bold backdrop-blur-sm sm:mx-0 sm:px-0"
              >
                {g.label}
                <span className="label-mono font-normal text-muted-foreground">
                  {g.items.length} event{g.items.length === 1 ? "" : "s"}
                </span>
              </h2>
              <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    tourTarget={index === 0}
                    index={index++}
                    action={user ? <SaveEventButton eventId={e.id} initialSaved={savedIds.has(e.id)} compact /> : undefined}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** Signed-out hero: the pitch on the left, a pinboard of real upcoming events on the right. */
async function Hero({ events }: { events: Awaited<ReturnType<typeof getFeed>>["events"] }) {
  const [stats] = await db
    .select({
      events: sql<number>`(select count(*)::int from events where status = 'published' and ends_at >= now())`,
      colleges: sql<number>`(select count(*)::int from colleges where verified)`,
      roles: sql<number>`(select coalesce(sum(slots_open), 0)::int from vacancies where status = 'open')`,
    })
    .from(sql`(select 1) as _`);
  const tilts = ["-rotate-3", "rotate-2", "-rotate-1"];

  return (
    <section className="grid items-center gap-10 py-4 lg:grid-cols-[1.1fr_1fr] lg:py-10">
      <div className="flex flex-col gap-5">
        <p className="label-mono text-muted-foreground">For college clubs &amp; the students who show up</p>
        <h1 className="text-[2.6rem] leading-[1.02] font-extrabold sm:text-6xl">
          Every hackathon on campus. And <span className="marker">the people</span> to build it with.
        </h1>
        <p className="max-w-lg text-lg text-muted-foreground">
          Clubs post once and reach every campus nearby. Teams post the roles they&apos;re missing; you apply with your skills, not a
          WhatsApp forward.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" render={<Link href="/login" />}>
            Get started <ArrowRight />
          </Button>
          <Button size="lg" variant="outline" render={<a href="#main-feed" />}>
            Browse events
          </Button>
        </div>
        <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-3 border-t border-dashed border-rule pt-4">
          {[
            [stats.events, "upcoming events"],
            [stats.colleges, "verified colleges"],
            [stats.roles, "open team roles"],
          ].map(([n, label]) => (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd className="font-display text-3xl font-extrabold tabular-nums">{n}</dd>
              <dd className="label-mono text-muted-foreground">{label}</dd>
            </div>
          ))}
        </dl>
      </div>

      {events.length > 0 && (
        <div aria-hidden="true" className="relative hidden h-[30rem] sm:block">
          {events.map((e, i) => (
            <div
              key={e.id}
              className={cn(
                "absolute w-56 rounded-md border border-ink/20 bg-card p-2 pb-3 shadow-[4px_6px_0_0_rgba(26,23,20,0.12)] motion-safe:animate-rise",
                tilts[i],
                i === 0 && "top-4 left-0",
                i === 1 && "top-0 right-0",
                i === 2 && "bottom-0 left-1/2 -translate-x-1/2",
              )}
              style={{ animationDelay: `${120 + i * 110}ms` }}
            >
              <Pin />
              <EventArt id={e.id} type={e.type} posterUrl={e.posterUrl} className="aspect-[4/3] rounded-sm" />
              <p className="mt-2 line-clamp-2 font-display leading-tight font-bold">{e.title}</p>
              <p className="label-mono mt-1 text-muted-foreground">
                {formatShort(e.startsAt)} · {e.org.name}
              </p>
            </div>
          ))}
        </div>
      )}
      <span id="main-feed" />
    </section>
  );
}
