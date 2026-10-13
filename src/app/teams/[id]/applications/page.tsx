import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { BadgeCheck, ExternalLink } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { isUuid } from "@/lib/queries";
import { MIN_LEVEL_HELD } from "@/lib/match-score";
import { relative } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { ApplicationActions } from "./application-actions";

export const metadata: Metadata = { title: "Review applications" };

const STATUS_ORDER = { shortlisted: 0, pending: 1, accepted: 2, rejected: 3, withdrawn: 4 } as const;

export default async function ApplicationsPage({ params }: PageProps<"/teams/[id]/applications">) {
  const { id } = await params;
  const user = await requireUser({ next: `/teams/${id}/applications` });
  if (!isUuid(id)) notFound();
  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.id, id),
    with: {
      event: { columns: { id: true, title: true, endsAt: true, teamMax: true } },
      members: { columns: { userId: true } },
      vacancies: { with: { skills: { with: { skill: true } } }, orderBy: asc(schema.vacancies.createdAt) },
    },
  });
  if (!team) notFound();
  if (team.leaderId !== user.id) redirect(`/teams/${id}`);

  const vacancyIds = team.vacancies.map((v) => v.id);
  const apps = vacancyIds.length
    ? await db.query.applications.findMany({
        where: inArray(schema.applications.vacancyId, vacancyIds),
        with: { applicant: { with: { college: true, skills: { with: { skill: true } } } } },
        orderBy: [desc(schema.applications.matchScore), asc(schema.applications.createdAt)],
      })
    : [];

  // Track record: events attended / registered, for each applicant.
  const applicantIds = [...new Set(apps.map((a) => a.applicantId))];
  const history = applicantIds.length
    ? await db
        .select({
          userId: schema.registrations.userId,
          events: sql<number>`count(*)::int`,
          attended: sql<number>`count(*) filter (where ${schema.registrations.status} = 'checked_in')::int`,
        })
        .from(schema.registrations)
        .where(inArray(schema.registrations.userId, applicantIds))
        .groupBy(schema.registrations.userId)
    : [];
  const historyBy = new Map(history.map((h) => [h.userId, h]));
  const teamFull = team.members.length >= team.event.teamMax;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:py-8">
      <RealtimeRefresh channel={`apps:${team.id}`} table="applications" filter={`vacancy_id=in.(${vacancyIds.join(",") || "00000000-0000-0000-0000-000000000000"})`} />
      <header>
        <Link href={`/teams/${team.id}`} className="text-sm text-muted-foreground hover:underline">
          ← {team.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <p className="text-sm text-muted-foreground">
          Sorted by match score. New applications appear live. {teamFull && "Your team is full."}
        </p>
      </header>

      {team.vacancies.length === 0 ? (
        <EmptyState
          title="No roles posted yet"
          action={<Button render={<Link href={`/teams/${team.id}`} />}>Post a role</Button>}
        />
      ) : (
        team.vacancies.map((v) => {
          const list = apps
            .filter((a) => a.vacancyId === v.id)
            .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.matchScore - a.matchScore);
          const wanted = new Map(v.skills.map((s) => [s.skillId, s.required]));
          return (
            <section key={v.id} className="flex flex-col gap-3">
              <h2 className="flex flex-wrap items-center gap-2 font-medium">
                {v.roleTitle}
                <Badge variant={v.status === "open" ? "secondary" : "outline"} className="capitalize">
                  {v.status === "open" ? `${v.slotsOpen}/${v.slotsTotal} open` : v.status}
                </Badge>
                <span className="text-sm font-normal text-muted-foreground">
                  needs {v.skills.filter((s) => s.required).map((s) => s.skill.name).join(", ")}
                </span>
              </h2>
              {list.length === 0 ? (
                <EmptyState compact title="No applicants yet" description="Share the event link — the team board is on the event page." />
              ) : (
                <ul className="flex flex-col gap-3">
                  {list.map((a) => {
                    const h = historyBy.get(a.applicantId);
                    const decided = !["pending", "shortlisted"].includes(a.status);
                    return (
                      <li key={a.id} className={cn("flex flex-col gap-3 rounded-xl border p-4", decided && "opacity-70")}>
                        <div className="flex items-start gap-3">
                          <UserAvatar name={a.applicant.name} src={a.applicant.avatarUrl} className="size-10" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link href={`/u/${a.applicant.username}`} className="font-medium hover:underline">
                                {a.applicant.name}
                              </Link>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                                  a.matchScore >= 75 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : a.matchScore >= 40 ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-muted",
                                )}
                              >
                                {a.matchScore}% match
                              </span>
                              {a.status !== "pending" && (
                                <Badge variant={a.status === "accepted" ? "default" : "outline"} className="capitalize">
                                  {a.status}
                                </Badge>
                              )}
                            </div>
                            <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                              {a.applicant.college?.name ?? "No college"}
                              {a.applicant.collegeVerified && <BadgeCheck className="size-3.5 text-emerald-600" />}
                              {a.applicant.year && ` · Year ${a.applicant.year}`}
                              {a.applicant.branch && ` · ${a.applicant.branch}`}
                              {` · applied ${relative(a.createdAt)}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {h ? `${h.events} event${h.events === 1 ? "" : "s"} · ${h.attended} attended` : "First event"} · reliability{" "}
                              {Math.round(Number(a.applicant.reliabilityScore))}%
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {a.applicant.skills
                            .sort((x, y) => Number(wanted.has(y.skillId)) - Number(wanted.has(x.skillId)) || y.level - x.level)
                            .slice(0, 10)
                            .map((s) => (
                              <Badge
                                key={s.skillId}
                                variant={wanted.has(s.skillId) && s.level >= MIN_LEVEL_HELD ? "default" : "outline"}
                                title={`Level ${s.level}/5${s.endorsedCount ? ` · ${s.endorsedCount} endorsements` : ""}`}
                              >
                                {s.skill.name} · {s.level}
                                {s.endorsedCount > 0 && ` · ✓${s.endorsedCount}`}
                              </Badge>
                            ))}
                        </div>
                        <blockquote className="border-l-2 pl-3 text-sm">{a.message}</blockquote>
                        {a.screeningAnswer && v.screeningQuestion && (
                          <div className="rounded-lg bg-muted/50 p-2 text-sm">
                            <p className="text-xs text-muted-foreground">{v.screeningQuestion}</p>
                            <p className="break-words">{a.screeningAnswer}</p>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          {a.applicant.githubUrl && (
                            <Button size="xs" variant="ghost" render={<a href={a.applicant.githubUrl} target="_blank" rel="noreferrer" />}>
                              GitHub <ExternalLink />
                            </Button>
                          )}
                          {a.applicant.linkedinUrl && (
                            <Button size="xs" variant="ghost" render={<a href={a.applicant.linkedinUrl} target="_blank" rel="noreferrer" />}>
                              LinkedIn <ExternalLink />
                            </Button>
                          )}
                          {!decided && (
                            <ApplicationActions
                              applicationId={a.id}
                              name={a.applicant.name}
                              shortlisted={a.status === "shortlisted"}
                              canAccept={v.status === "open" && !teamFull}
                            />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
