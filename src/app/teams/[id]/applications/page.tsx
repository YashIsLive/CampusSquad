import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/nav-bits";
import { notFound, redirect } from "next/navigation";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { BadgeCheck, ExternalLink, MessageSquare } from "lucide-react";
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
import { MatchMeter, SkillChip } from "@/components/match";
import { MetaLine } from "@/components/noticeboard";
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

  // Conversation sizes, and which ones have an unread reply for the leader.
  const appIds = apps.map((a) => a.id);
  const [threadStats, unread] = await Promise.all([
    appIds.length
      ? db
          .select({ applicationId: schema.applicationMessages.applicationId, total: sql<number>`count(*)::int` })
          .from(schema.applicationMessages)
          .where(inArray(schema.applicationMessages.applicationId, appIds))
          .groupBy(schema.applicationMessages.applicationId)
      : [],
    db
      .select({ href: sql<string>`${schema.notifications.payload}->>'href'` })
      .from(schema.notifications)
      .where(sql`${schema.notifications.userId} = ${user.id} and ${schema.notifications.type} = 'application_message' and ${schema.notifications.readAt} is null`),
  ]);
  const threadBy = new Map(threadStats.map((t) => [t.applicationId, t.total]));
  const unreadHrefs = new Set(unread.map((u) => u.href));
  const teamFull = team.members.length >= team.event.teamMax;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:py-8">
      <RealtimeRefresh channel={`apps:${team.id}`} table="applications" filter={`vacancy_id=in.(${vacancyIds.join(",") || "00000000-0000-0000-0000-000000000000"})`} />
      <RealtimeRefresh channel={`apps-notes:${user.id}`} table="notifications" filter={`user_id=eq.${user.id}`} />
      <header>
        <Breadcrumbs
          items={[
            { href: `/events/${team.event.id}?tab=teams`, label: team.event.title },
            { href: `/teams/${team.id}`, label: team.name },
            { label: "Applications" },
          ]}
        />
        <h1 className="text-4xl leading-[0.95] font-black sm:text-5xl">Applications</h1>
        <p className="text-sm text-muted-foreground">
          Sorted by match score. New applications appear live. {teamFull && "Your team is full."}
        </p>
      </header>

      {team.vacancies.length === 0 ? (
        <EmptyState
          title="No open spots yet"
          action={<Button render={<Link href={`/teams/${team.id}`} />}>Add an open spot</Button>}
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
                      <li key={a.id} className={cn("flex flex-col gap-3 rounded-xl border border-rule bg-card p-4", decided && "opacity-70")}>
                        <div className="flex items-start gap-3">
                          <UserAvatar name={a.applicant.name} src={a.applicant.avatarUrl} className="size-10" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link href={`/u/${a.applicant.username}`} className="font-medium hover:underline">
                                {a.applicant.name}
                              </Link>
                              {a.status !== "pending" && (
                                <Badge variant={a.status === "accepted" ? "default" : "outline"} className="capitalize">
                                  {a.status}
                                </Badge>
                              )}
                            </div>
                            <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                              {a.applicant.college?.name ?? "No college"}
                              {a.applicant.collegeVerified && <BadgeCheck className="size-3.5 text-ok" />}
                              {a.applicant.year && ` · Year ${a.applicant.year}`}
                              {a.applicant.branch && ` · ${a.applicant.branch}`}
                              {` · applied ${relative(a.createdAt)}`}
                            </p>
                            <MetaLine
                              className="mt-1"
                              items={[
                                h ? `${h.events} event${h.events === 1 ? "" : "s"} · ${h.attended} attended` : "First event",
                                `Reliability ${Math.round(Number(a.applicant.reliabilityScore))}%`,
                              ]}
                            />
                          </div>
                          <MatchMeter score={a.matchScore} />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {a.applicant.skills
                            .sort((x, y) => Number(wanted.has(y.skillId)) - Number(wanted.has(x.skillId)) || y.level - x.level)
                            .slice(0, 10)
                            .map((s) => (
                              <SkillChip
                                key={s.skillId}
                                name={s.endorsedCount > 0 ? `${s.skill.name} (${s.endorsedCount} endorsed)` : s.skill.name}
                                required={wanted.has(s.skillId)}
                                held={wanted.has(s.skillId) && s.level >= MIN_LEVEL_HELD}
                                level={s.level}
                              />
                            ))}
                        </div>
                        <blockquote className="border-l-2 border-ink/30 pl-3 text-sm">{a.message}</blockquote>
                        {a.screeningAnswer && v.screeningQuestion && (
                          <div className="rounded-md bg-secondary p-3 text-sm">
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
                          {a.status !== "withdrawn" && (
                            <Button
                              size="xs"
                              variant={unreadHrefs.has(`/applications/${a.id}`) ? "default" : "outline"}
                              render={<Link href={`/applications/${a.id}`} />}
                            >
                              <MessageSquare />
                              {unreadHrefs.has(`/applications/${a.id}`)
                                ? "New reply"
                                : threadBy.get(a.id)
                                  ? `Messages (${threadBy.get(a.id)})`
                                  : "Message"}
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
