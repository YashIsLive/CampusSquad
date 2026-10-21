import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/nav-bits";
import { notFound } from "next/navigation";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { AlertTriangle, BadgeCheck, CalendarClock } from "lucide-react";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/queries";
import { formatDateTime, relative } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReportButton } from "@/components/report-button";
import { EmptyState } from "@/components/empty-state";
import { TeamSheet } from "@/components/team-sheet";
import { MemberActions, TeamSettings, VacancyActions } from "./team-controls";
import { PostVacancyButton } from "./post-vacancy";
import { TeamChat } from "./team-chat";
import { TeamChecklist } from "./team-checklist";
import { EndorsePanel } from "./endorse-panel";
import { SuggestedTeammates } from "./suggested-teammates";
import { PageTour } from "@/components/guide/page-tour";

async function getTeam(id: string) {
  if (!isUuid(id)) return undefined;
  return db.query.teams.findFirst({
    where: eq(schema.teams.id, id),
    with: {
      event: true,
      leader: { columns: { collegeId: true } },
      members: {
        with: { user: { with: { college: true, skills: { with: { skill: true } } } } },
        orderBy: asc(schema.teamMembers.joinedAt),
      },
      vacancies: { with: { skills: { with: { skill: true } } }, orderBy: asc(schema.vacancies.createdAt) },
    },
  });
}

export async function generateMetadata({ params }: PageProps<"/teams/[id]">): Promise<Metadata> {
  const { id } = await params;
  const team = await getTeam(id);
  return { title: team ? `${team.name} · ${team.event.title}` : "Team" };
}

export default async function TeamPage({ params }: PageProps<"/teams/[id]">) {
  const { id } = await params;
  const [team, user] = await Promise.all([getTeam(id), getCurrentUser()]);
  if (!team) notFound();

  const isMember = Boolean(user && team.members.some((m) => m.userId === user.id));
  const isLeader = user?.id === team.leaderId;
  const event = team.event;
  const now = new Date();
  const over = event.endsAt < now;
  const size = team.members.length;
  const incomplete = size < event.teamMin;

  const vacancyIds = team.vacancies.map((v) => v.id);
  const pendingCounts = isLeader && vacancyIds.length
    ? await db
        .select({ vacancyId: schema.applications.vacancyId, n: count() })
        .from(schema.applications)
        .where(and(inArray(schema.applications.vacancyId, vacancyIds), inArray(schema.applications.status, ["pending", "shortlisted"])))
        .groupBy(schema.applications.vacancyId)
    : [];
  const pendingBy = new Map(pendingCounts.map((p) => [p.vacancyId, p.n]));
  const totalPending = pendingCounts.reduce((a, p) => a + p.n, 0);

  const [skills, messages, tasks] = isMember
    ? await Promise.all([
        isLeader ? db.select({ id: schema.skills.id, name: schema.skills.name, category: schema.skills.category }).from(schema.skills).orderBy(asc(schema.skills.name)) : [],
        db.query.messages.findMany({
          where: eq(schema.messages.teamId, team.id),
          with: { sender: { columns: { id: true, name: true, avatarUrl: true } } },
          orderBy: asc(schema.messages.createdAt),
          limit: 200,
        }),
        db.query.teamTasks.findMany({ where: eq(schema.teamTasks.teamId, team.id), orderBy: asc(schema.teamTasks.createdAt) }),
      ])
    : [[], [], []];

  const capacityLeft =
    event.teamMax - size - team.vacancies.filter((v) => v.status === "open").reduce((a, v) => a + v.slotsOpen, 0);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:py-8">
      {isMember && user && <PageTour tour="team" seen={Boolean(user.guide.tours?.team)} />}
      <header className="flex flex-col gap-2">
        <Breadcrumbs
          items={[
            { href: "/", label: "Explore" },
            { href: `/events/${event.id}?tab=teams`, label: event.title },
            { label: team.name },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-4xl leading-[0.95] font-black sm:text-5xl">{team.name}</h1>

          {incomplete && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="size-3" /> Needs {event.teamMin - size} more to meet the minimum
            </Badge>
          )}
          {!team.isOpen && <Badge variant="outline">Not recruiting</Badge>}
        </div>
        {team.ideaPitch && <p className="max-w-2xl text-sm">{team.ideaPitch}</p>}
        {user && !isLeader && (
          <div>
            <ReportButton targetType="team" targetId={team.id} what="this team" className="-ml-2 text-muted-foreground" />
          </div>
        )}
        {isLeader && !over && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" data-tour="review" render={<Link href={`/teams/${team.id}/applications`} />}>
              Review applications{totalPending ? ` (${totalPending})` : ""}
            </Button>
            <TeamSettings team={{ id: team.id, name: team.name, ideaPitch: team.ideaPitch ?? "", isOpen: team.isOpen }} />
          </div>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <div data-tour="members" className="flex flex-col gap-3">
            <div className="flex items-center justify-end gap-2">
              {isLeader && !over && <PostVacancyButton teamId={team.id} skills={skills} capacityLeft={capacityLeft} allowCross={event.allowCrossCollege} />}
            </div>
            <TeamSheet
              name="Lineup"
              subtitle={`Teams of ${event.teamMin}–${event.teamMax} at ${event.title}`}
              size={event.teamMax}
              members={team.members.map((m) => ({
                id: m.userId,
                name: m.user.name,
                avatarUrl: m.user.avatarUrl,
                href: `/u/${m.user.username}`,
                detail: (
                  <span className="flex items-center gap-1">
                    {m.userId === team.leaderId ? "Team lead" : (m.roleTitle ?? "Member")} · {m.user.college?.name ?? "No college"}
                    {m.user.collegeVerified && <BadgeCheck className="size-3.5 text-ok" />}
                    {m.user.skills.length > 0 && (
                      <span className="hidden sm:inline">
                        {" · "}
                        {[...m.user.skills]
                          .sort((a, b) => b.level - a.level)
                          .slice(0, 3)
                          .map((s) => s.skill.name)
                          .join(", ")}
                      </span>
                    )}
                  </span>
                ),
                trailing:
                  !over && m.userId !== team.leaderId && (isLeader || m.userId === user?.id) ? (
                    <MemberActions teamId={team.id} userId={m.userId} self={m.userId === user?.id} />
                  ) : undefined,
              }))}
              openings={team.vacancies
                .filter((v) => v.status === "open")
                .map((v) => ({
                  id: v.id,
                  role: `${v.roleTitle}${v.slotsOpen > 1 ? ` (${v.slotsOpen} spots)` : ""}`,
                  detail: [
                    v.skills.map((s) => (s.required ? s.skill.name : `${s.skill.name} (bonus)`)).join(", "),
                    v.commitmentHours ? `${v.commitmentHours} h/week` : null,
                    v.scope === "intra" ? "same college" : null,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                  trailing: isLeader ? (
                    <VacancyActions vacancyId={v.id} teamId={team.id} pending={pendingBy.get(v.id) ?? 0} />
                  ) : !isMember ? (
                    <Button size="sm" variant="ink" render={<Link href={`/events/${event.id}?tab=teams`} />}>
                      I&apos;ve got it
                    </Button>
                  ) : undefined,
                }))}
            />
            {isLeader && team.vacancies.every((v) => v.status !== "open") && !over && size < event.teamMax && (
              <p className="text-sm text-muted-foreground">
                Free spots stay quiet until you post them. Add a spot with the skills you need, and people at this event can say they&apos;ve
                got it.
              </p>
            )}
            {isLeader && team.vacancies.some((v) => v.status !== "open") && (
              <p className="text-sm text-muted-foreground">
                Closed spots:{" "}
                {team.vacancies
                  .filter((v) => v.status !== "open")
                  .map((v) => `${v.roleTitle} (${v.status})`)
                  .join(", ")}
              </p>
            )}
          </div>

          {isLeader && !over && size < event.teamMax && (
            <SuggestedTeammates
              team={{ id: team.id }}
              event={{ id: event.id, allowCrossCollege: event.allowCrossCollege }}
              leaderCollegeId={team.leader.collegeId}
              roles={team.vacancies}
            />
          )}

          {isMember && over && user && (
            <EndorsePanel
              eventId={event.id}
              teamId={team.id}
              me={user.id}
              teammates={team.members
                .filter((m) => m.userId !== user.id)
                .map((m) => ({ id: m.userId, name: m.user.name, skills: m.user.skills.map((s) => ({ id: s.skillId, name: s.skill.name })) }))}
            />
          )}
        </div>

        {isMember ? (
          <aside className="flex flex-col gap-4">
            <section className="rounded-xl border border-rule bg-card p-4">
              <h2 className="mb-2 flex items-center gap-1.5 text-lg font-bold">
                <CalendarClock className="size-4" /> Deadlines
              </h2>
              <ul className="flex flex-col gap-1.5 text-sm">
                <Deadline label="Sign-ups close" at={event.regDeadline} now={now} />
                <Deadline label="Event starts" at={event.startsAt} now={now} />
                <Deadline label="Event ends" at={event.endsAt} now={now} />
              </ul>
            </section>
            <TeamChecklist teamId={team.id} initial={tasks.map((t) => ({ id: t.id, title: t.title, done: t.done }))} />
            <TeamChat
              teamId={team.id}
              me={{ id: user!.id, name: user!.name }}
              initial={messages.map((m) => ({
                id: m.id,
                body: m.body,
                createdAt: m.createdAt.toISOString(),
                sender: { id: m.sender.id, name: m.sender.name, avatarUrl: m.sender.avatarUrl },
              }))}
              members={team.members.map((m) => ({ id: m.userId, name: m.user.name, avatarUrl: m.user.avatarUrl }))}
            />
          </aside>
        ) : (
          <aside>
            <EmptyState
              compact
              title="Members only"
              description="The team's chat and checklist are private to the people on it."
            />
          </aside>
        )}
      </div>
    </div>
  );
}

function Deadline({ label, at, now }: { label: string; at: Date; now: Date }) {
  const past = at < now;
  return (
    <li className="flex justify-between gap-2">
      <span className={past ? "text-muted-foreground line-through" : ""}>{label}</span>
      <span className="text-right text-muted-foreground">
        {formatDateTime(at)}
        {!past && <span className="block text-xs">{relative(at, now)}</span>}
      </span>
    </li>
  );
}
