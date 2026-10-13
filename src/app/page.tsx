import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { Flame } from "lucide-react";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { getFeed, parseFeedFilters, type FeedScope } from "@/lib/feed";
import { relative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { EventCard } from "@/components/event-card";
import { SaveEventButton } from "@/app/events/[id]/save-button";
import { cn } from "@/lib/utils";
import { FeedFilters } from "./feed-filters";

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
            .where(
              and(
                eq(schema.savedEvents.userId, user.id),
                inArray(schema.savedEvents.eventId, events.map((e) => e.id)),
              ),
            )
        ).map((r) => r.id)
      : [],
  );

  const scopes: Array<{ key: FeedScope; label: string; disabled?: boolean }> = [
    { key: "campus", label: "My campus", disabled: !user?.collegeId },
    { key: "nearby", label: user?.college ? `Nearby · ${user.college.city}` : "Nearby", disabled: !user?.collegeId },
    { key: "india", label: "All India" },
  ];

  const hrefFor = (s: FeedScope) => {
    const p = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
    p.set("scope", s);
    return `/?${p.toString()}`;
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6">
      {!user && (
        <section className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-8 text-white">
          <h1 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
            Every tech event on your campus — and the right teammates one application away.
          </h1>
          <p className="mt-2 max-w-xl text-white/80">
            Hackathons, quizzes, coding contests and workshops from clubs near you. Teams post open roles; you apply.
          </p>
          <div className="mt-4 flex gap-2">
            <Button render={<Link href="/login" />} className="bg-white text-indigo-700 hover:bg-white/90">
              Sign in with college email
            </Button>
          </div>
        </section>
      )}

      <div className="flex flex-col gap-3">
        <nav className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1" aria-label="Feed scope">
          {scopes.map((s) =>
            s.disabled ? (
              <span
                key={s.key}
                title="Add your college to your profile to see this"
                className="flex-1 cursor-not-allowed rounded-md px-3 py-1.5 text-center text-sm whitespace-nowrap text-muted-foreground/60"
              >
                {s.label}
              </span>
            ) : (
              <Link
                key={s.key}
                href={hrefFor(s.key)}
                aria-current={scope === s.key ? "page" : undefined}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-center text-sm whitespace-nowrap",
                  scope === s.key ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </Link>
            ),
          )}
        </nav>
        <FeedFilters />
      </div>

      {closingSoon.length > 0 && (
        <section aria-labelledby="closing-soon" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <h2 id="closing-soon" className="mb-2 flex items-center gap-1.5 text-sm font-medium text-destructive">
            <Flame className="size-4" /> Closing in 48 hours
          </h2>
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {closingSoon.map((e) => (
              <li key={e.id} className="shrink-0">
                <Link href={`/events/${e.id}`} className="flex flex-col rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted">
                  <span className="max-w-56 truncate font-medium">{e.title}</span>
                  <span className="text-xs text-destructive">closes {relative(e.regDeadline)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {events.length === 0 ? (
        <EmptyState
          title={scope === "campus" ? "Nothing on your campus right now" : "No events match"}
          description={
            scope === "campus"
              ? "Try Nearby or All India — or post the first event for your club."
              : "Try removing some filters."
          }
          action={
            <div className="flex gap-2">
              <Button variant="outline" render={<Link href="/?scope=india" />}>
                Browse All India
              </Button>
              {user && <Button render={<Link href="/events/new" />}>Post an event</Button>}
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              action={user ? <SaveEventButton eventId={e.id} initialSaved={savedIds.has(e.id)} compact /> : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
