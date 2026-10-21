import Link from "next/link";
import { ViewTransition } from "react";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db, schema } from "@/db";
import { getCurrentUser, needsConsent } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getFeed, parseFeedFilters, type FeedScope } from "@/lib/feed";
import { groupByWhen } from "@/lib/group-events";
import { relative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { EventCard } from "@/components/event-card";
import { TeamSheet } from "@/components/team-sheet";
import { SpotsRail } from "@/components/spots-rail";
import { TYPE_ICON } from "@/components/event-kit";
import { spotsForYou } from "@/lib/spots";
import { SaveEventButton } from "@/app/events/[id]/save-button";
import { cn } from "@/lib/utils";
import { FeedFilters } from "./feed-filters";
import { GettingStarted } from "@/components/guide/getting-started";
import { PageTour } from "@/components/guide/page-tour";

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user?.onboardedAt && needsConsent(user)) redirect("/consent");
  const filters = parseFeedFilters(sp);
  const [{ scope, events, closingSoon }, spots, skillCount] = await Promise.all([
    getFeed(user, filters),
    user ? spotsForYou(user) : Promise.resolve([]),
    user
      ? db.$count(schema.userSkills, eq(schema.userSkills.userId, user.id))
      : Promise.resolve(0),
  ]);

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
    { key: "campus", label: "My college", disabled: !user?.collegeId },
    { key: "nearby", label: user?.college ? `Around ${user.college.city}` : "Nearby", disabled: !user?.collegeId },
    { key: "india", label: "All of India" },
  ];
  const hrefFor = (s: FeedScope) => {
    const p = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
    p.set("scope", s);
    return `/?${p.toString()}`;
  };

  const groups = groupByWhen(events);
  const filtered = Boolean(filters.q || filters.type || filters.domain || filters.mode || filters.fee || filters.within || filters.size || filters.beginner);
  const openSpots = events.reduce((n, e) => n + (e.openSpots ?? 0), 0);
  let index = 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 motion-safe:animate-page-in sm:py-8">
      {sp.account === "deleted" && !user && (
        <p role="status" className="rounded-xl border border-ink bg-card px-4 py-3 text-sm">
          Your account and its data have been deleted. Thanks for playing.
        </p>
      )}
      {user ? (
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{user.college?.name ?? "Welcome"}</p>
            <h1 className="text-4xl font-extrabold sm:text-5xl">
              {scope === "campus" ? "At your college" : scope === "nearby" ? `Around ${user.college?.city}` : "Across India"}
            </h1>
          </div>
          <dl className="flex gap-6">
            <Stat n={events.length} label={events.length === 1 ? "event" : "events"} />
            <Stat n={openSpots} label={openSpots === 1 ? "open team spot" : "open team spots"} lime />
          </dl>
        </header>
      ) : (
        <Hero />
      )}

      {user && <GettingStarted user={user} />}
      {user && <PageTour tour="feed" seen={Boolean(user.guide.tours?.feed)} />}

      {user && !filtered && <SpotsRail spots={spots} hasSkills={skillCount > 0} />}

      <div id="events" className="flex scroll-mt-20 flex-col gap-3">
        <nav aria-label="Where" data-tour="scope" className="flex w-full gap-1 rounded-full border border-rule bg-card p-1 sm:w-fit">
          {scopes.map((s) =>
            s.disabled ? (
              <span
                key={s.key}
                aria-disabled="true"
                title="Add your college to your profile to unlock this"
                className="flex-1 cursor-not-allowed rounded-full px-4 py-2 text-center text-sm whitespace-nowrap text-muted-foreground/60 sm:flex-none"
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
                  "relative flex-1 rounded-full px-4 py-2 text-center text-sm whitespace-nowrap transition-colors sm:flex-none",
                  scope === s.key ? "font-semibold text-paper" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {scope === s.key && (
                  <ViewTransition name="scope-pill" share="slide-indicator" default="none">
                    <span aria-hidden="true" className="absolute inset-0 rounded-full bg-ink" />
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
          <h2 id="last-call" className="mb-2 flex items-center gap-2 px-4 text-base font-bold sm:px-0">
            <span aria-hidden="true" className="size-2 rounded-full bg-signal motion-safe:animate-pulse" /> Closing in the next two days
          </h2>
          <ul className="no-scrollbar flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:px-0">
            {closingSoon.map((e) => (
              <li key={e.id} className="snap-start">
                <Link href={`/events/${e.id}`} className="group lift flex w-72 items-stretch overflow-hidden rounded-xl border border-rule bg-card">
                  <span
                    aria-hidden="true"
                    className={`kit kit-${e.type} grid w-14 shrink-0 place-items-center border-r border-rule`}
                    style={{ "--kit-bg": `var(--type-${e.type})`, "--kit-fg": `var(--type-fg-${e.type})` } as React.CSSProperties}
                  >
                    <TypeIcon type={e.type} />
                  </span>
                  <span className="flex min-w-0 flex-col justify-center gap-0.5 px-3 py-3">
                    <span className="truncate font-bold">{e.title}</span>
                    <span className="text-sm font-medium text-signal-ink">Closes {relative(e.regDeadline)}</span>
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
          title={filtered ? "Nothing matches those filters" : scope === "campus" ? "Nothing at your college yet" : "No events here yet"}
          description={
            filtered
              ? "Try removing a filter or two."
              : scope === "campus"
                ? "Look around your city, or be the club that posts the first one."
                : "Clubs post new events every week. Check back soon."
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {scope !== "india" && (
                <Button variant="outline" render={<Link href="/?scope=india" />}>
                  See all of India
                </Button>
              )}
              {user && <Button render={<Link href="/events/new" />}>Post an event</Button>}
            </div>
          }
        />
      ) : (
        <div className="flex flex-col gap-10">
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`g-${g.key}`}>
              <h2
                id={`g-${g.key}`}
                className="sticky top-14 z-20 -mx-4 mb-4 flex items-baseline justify-between border-b border-ink bg-paper/95 px-4 py-2.5 text-2xl font-extrabold backdrop-blur-sm sm:mx-0 sm:px-0"
              >
                {g.label}
                <span className="text-sm font-normal text-muted-foreground [font-stretch:100%]">
                  {g.items.length} event{g.items.length === 1 ? "" : "s"}
                </span>
              </h2>
              <div className="stagger grid gap-4 md:grid-cols-2">
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

function Stat({ n, label, lime = false }: { n: number; label: string; lime?: boolean }) {
  return (
    <div className="flex flex-col">
      <dd className={cn("score text-4xl", lime && n > 0 && "w-fit rounded-md bg-court px-1.5 text-[#0f0f0e]")}>{n}</dd>
      <dt className="order-last text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}

/** Signed-out landing: the question, a real team with an open spot, and how it works. */
async function Hero() {
  const [stats] = await db
    .select({
      events: sql<number>`(select count(*)::int from events where status = 'published' and ends_at >= now())`,
      colleges: sql<number>`(select count(*)::int from colleges where verified)`,
      spots: sql<number>`(select coalesce(sum(slots_open), 0)::int from vacancies where status = 'open')`,
    })
    .from(sql`(select 1) as _`);

  // A real team that's still looking, to show what a spot looks like.
  const vacancy = await db.query.vacancies.findFirst({
    where: eq(schema.vacancies.status, "open"),
    orderBy: asc(schema.vacancies.createdAt),
    with: {
      skills: { with: { skill: { columns: { name: true } } } },
      team: {
        with: {
          event: { columns: { title: true, teamMax: true } },
          members: { with: { user: { columns: { id: true, name: true, avatarUrl: true } } } },
        },
      },
    },
  });

  return (
    <section className="flex flex-col gap-12 py-2 lg:py-8">
      <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
        <div className="flex flex-col gap-6">
          <h1 className="text-[3.4rem] leading-[0.92] font-black sm:text-[5.2rem]">
            Who&apos;s got <span className="marker">next</span>?
          </h1>
          <p className="max-w-lg text-lg sm:text-xl">
            Hackathons, coding contests and workshops near your college. And the people to build with: teams post the spot they
            need filled, and you say you&apos;ve got it.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" render={<Link href="/login?mode=signup" />}>
              Join free <ArrowRight />
            </Button>
            <Button size="lg" variant="outline" render={<a href="#events" />}>
              Browse events
            </Button>
          </div>
          <dl className="flex flex-wrap gap-x-10 gap-y-4 border-t border-ink pt-5">
            <Stat n={stats.events} label="events coming up" />
            <Stat n={stats.colleges} label="colleges" />
            <Stat n={stats.spots} label="team spots open right now" lime />
          </dl>
        </div>

        {vacancy && (
          <div className="relative motion-safe:animate-rise" style={{ animationDelay: "120ms" }}>
            <p className="mb-2 text-sm text-muted-foreground">Right now, on Got Next:</p>
            <TeamSheet
              headingLevel="h2"
              name={vacancy.team.name}
              subtitle={vacancy.team.event.title}
              size={vacancy.team.event.teamMax}
              members={vacancy.team.members.map((m) => ({
                id: m.user.id,
                name: m.user.name,
                avatarUrl: m.user.avatarUrl,
                detail: m.roleTitle ?? (m.userId === vacancy.team.leaderId ? "Team lead" : "Member"),
              }))}
              openings={[
                {
                  id: vacancy.id,
                  role: `Needs: ${vacancy.roleTitle}`,
                  detail: vacancy.skills.map((s) => s.skill.name).join(", "),
                  trailing: (
                    <Button size="sm" variant="ink" render={<Link href="/login?mode=signup" />}>
                      I&apos;ve got it
                    </Button>
                  ),
                },
              ]}
            />
          </div>
        )}
      </div>

      <ol className="grid gap-px overflow-hidden rounded-xl border border-ink bg-ink sm:grid-cols-3">
        {[
          ["Pick an event", "Everything from your college, your city and the rest of India, in one list."],
          ["Find your team", "Fill an open spot on a team, or start one and say who you need."],
          ["Show up", "Reminders before it starts, your entry code on your phone, your team chat in your pocket."],
        ].map(([title, body], i) => (
          <li key={title} className="flex gap-4 bg-card p-5">
            <span className="score text-5xl">{i + 1}</span>
            <div>
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TypeIcon({ type }: { type: keyof typeof TYPE_ICON }) {
  const Icon = TYPE_ICON[type];
  return <Icon className="size-5" strokeWidth={2.4} />;
}
