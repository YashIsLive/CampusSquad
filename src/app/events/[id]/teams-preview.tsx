import Link from "next/link";
import { and, asc, eq, sql } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db, schema } from "@/db";
import { Slots } from "@/components/noticeboard";

/**
 * On the event's Overview tab: a glimpse of the team side, so nobody has to discover the Teams tab
 * to learn that teams here are looking for people.
 */
export async function TeamsPreview({ eventId, teamMax }: { eventId: string; teamMax: number }) {
  const [open, [counts]] = await Promise.all([
    db
      .select({
        id: schema.vacancies.id,
        roleTitle: schema.vacancies.roleTitle,
        teamName: schema.teams.name,
        size: sql<number>`(select count(*)::int from team_members m where m.team_id = ${schema.teams.id})`,
      })
      .from(schema.vacancies)
      .innerJoin(schema.teams, eq(schema.teams.id, schema.vacancies.teamId))
      .where(and(eq(schema.teams.eventId, eventId), eq(schema.vacancies.status, "open")))
      .orderBy(asc(schema.vacancies.createdAt))
      .limit(3),
    db
      .select({
        teams: sql<number>`(select count(*)::int from teams where event_id = ${eventId})`,
        freeAgents: sql<number>`(select count(*)::int from availability_posts where event_id = ${eventId} and status = 'open')`,
      })
      .from(sql`(select 1) as _`),
  ]);

  const href = `/events/${eventId}?tab=teams`;
  return (
    <section aria-labelledby="teams-preview" className="overflow-hidden rounded-2xl border border-ink">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink bg-court px-4 py-3 text-[#0f0f0e]">
        <h2 id="teams-preview" className="text-lg font-extrabold">
          Need a team?
        </h2>
        <p className="text-sm font-medium">
          {counts.teams} team{counts.teams === 1 ? "" : "s"} · {counts.freeAgents} free agent{counts.freeAgents === 1 ? "" : "s"}
        </p>
      </div>
      {open.length === 0 ? (
        <div className="flex flex-col gap-2 bg-card p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>No open spots yet. Start a team and say who you need, or list yourself as a free agent.</p>
          <Link href={href} scroll={false} className="inline-flex shrink-0 items-center gap-1 font-semibold underline decoration-court decoration-2 underline-offset-4">
            Go to teams <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-rule bg-card">
          {open.map((v) => (
            <li key={v.id}>
              <Link href={href} scroll={false} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/60">
                <Slots filled={v.size} total={teamMax} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{v.roleTitle}</span>
                  <span className="block truncate text-xs text-muted-foreground">needed by {v.teamName}</span>
                </span>
                <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
          <li>
            <Link href={href} scroll={false} className="flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-secondary/60">
              See every open spot and free agent <ArrowRight className="size-4" />
            </Link>
          </li>
        </ul>
      )}
    </section>
  );
}
