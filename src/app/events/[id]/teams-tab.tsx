import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { BadgeCheck } from "lucide-react";
import { db, schema } from "@/db";
import type { CurrentUser } from "@/lib/auth";
import type { EventWithOrg } from "@/lib/queries";
import { crossCollegeAllowed, isEligible } from "@/lib/eligibility";
import { matchScore, MIN_LEVEL_HELD } from "@/lib/match-score";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { MatchMeter, SkillChip } from "@/components/match";
import { MetaLine, Stamp } from "@/components/noticeboard";
import { UserAvatar } from "@/components/user-avatar";
import { ApplyButton } from "./apply-button";
import { AvailabilityForm } from "./availability-form";
import { InviteButton } from "./invite-button";
import { TeamBoardFilters } from "./team-board-filters";

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export async function TeamsTab({ event, user, filters }: { event: EventWithOrg; user: CurrentUser | null; filters: SearchParams }) {
  const f = {
    skill: one(filters.skill),
    where: one(filters.where) as "intra" | "cross" | undefined,
    college: one(filters.college),
    hours: one(filters.hours) ? Number(one(filters.hours)) : undefined,
  };

  const teams = await db.query.teams.findMany({
    where: eq(schema.teams.eventId, event.id),
    with: {
      leader: { with: { college: true } },
      members: { with: { user: { with: { skills: { with: { skill: true } } } } } },
      vacancies: { where: eq(schema.vacancies.status, "open"), with: { skills: { with: { skill: true } } } },
    },
    orderBy: asc(schema.teams.createdAt),
  });
  const vacancyIds = teams.flatMap((t) => t.vacancies.map((v) => v.id));

  const [availability, mySkills, myApps, allSkills, colleges] = await Promise.all([
    db.query.availabilityPosts.findMany({
      where: and(eq(schema.availabilityPosts.eventId, event.id), eq(schema.availabilityPosts.status, "open")),
      with: { user: { with: { college: true, skills: { with: { skill: true } } } } },
      orderBy: asc(schema.availabilityPosts.createdAt),
    }),
    user ? db.query.userSkills.findMany({ where: eq(schema.userSkills.userId, user.id) }) : [],
    user && vacancyIds.length
      ? db.query.applications.findMany({
          where: and(eq(schema.applications.applicantId, user.id), inArray(schema.applications.vacancyId, vacancyIds)),
        })
      : [],
    db.select({ id: schema.skills.id, name: schema.skills.name }).from(schema.skills).orderBy(asc(schema.skills.name)),
    db.select({ id: schema.colleges.id, name: schema.colleges.name }).from(schema.colleges).orderBy(asc(schema.colleges.name)),
  ]);

  const myTeam = user ? teams.find((t) => t.members.some((m) => m.userId === user.id)) : undefined;
  const iLead = myTeam?.leaderId === user?.id;
  const myAppByVacancy = new Map(myApps.map((a) => [a.vacancyId, a]));
  const heldSkillIds = new Set(mySkills.filter((s) => s.level >= MIN_LEVEL_HELD).map((s) => s.skillId));
  const myAvailability = user ? availability.find((a) => a.userId === user.id) : undefined;
  const now = new Date();
  const over = event.endsAt < now;

  const eligibility = user
    ? isEligible(event, { collegeId: user.collegeId, collegeVerified: user.collegeVerified, collegeCity: user.college?.city ?? null })
    : null;

  const sameCollegeAs = (collegeId: string | null) => Boolean(user?.collegeId && collegeId === user.collegeId);

  // ---- vacancies ----
  const vacancies = teams
    .flatMap((team) => team.vacancies.map((v) => ({ v, team })))
    .filter(({ v, team }) => {
      if (f.skill && !v.skills.some((s) => s.skillId === f.skill)) return false;
      if (f.where === "intra" && !sameCollegeAs(team.leader.collegeId)) return false;
      if (f.where === "cross" && sameCollegeAs(team.leader.collegeId)) return false;
      if (f.college && team.leader.collegeId !== f.college) return false;
      if (f.hours && (v.commitmentHours ?? 0) > f.hours) return false;
      return true;
    })
    .map(({ v, team }) => {
      const score = user
        ? matchScore({
            requiredSkillIds: v.skills.filter((s) => s.required).map((s) => s.skillId),
            niceToHaveSkillIds: v.skills.filter((s) => !s.required).map((s) => s.skillId),
            applicantSkills: mySkills.map((s) => ({ skillId: s.skillId, level: s.level })),
            sameCollege: sameCollegeAs(team.leader.collegeId),
          })
        : null;
      let blocked: string | null = null;
      if (!user) blocked = null;
      else if (team.leaderId === user.id || myTeam?.id === team.id) blocked = "Your team";
      else if (myTeam) blocked = "You're already on a team";
      else if (eligibility && !eligibility.ok) blocked = eligibility.reason;
      else if (v.scope === "intra" && !sameCollegeAs(team.leader.collegeId)) blocked = `Same-college only (${team.leader.college?.name ?? "their college"})`;
      else if (!crossCollegeAllowed(event, team.leader.collegeId, user.collegeId)) blocked = "Event requires same-college teams";
      return { v, team, score, blocked };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  // ---- availability ----
  const lookers = availability.filter((a) => {
    if (user && a.userId === user.id) return false;
    if (f.skill && !a.user.skills.some((s) => s.skillId === f.skill)) return false;
    if (f.where === "intra" && !sameCollegeAs(a.user.collegeId)) return false;
    if (f.where === "cross" && sameCollegeAs(a.user.collegeId)) return false;
    if (f.college && a.user.collegeId !== f.college) return false;
    if (f.hours && (a.hoursPerWeek ?? 0) > f.hours) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Viewer's own status */}
      {user && !over && (
        <div className="flex flex-col gap-3 rounded-lg border border-rule bg-secondary/60 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          {myTeam ? (
            <>
              <p>
                You&apos;re on <strong>{myTeam.name}</strong>
                {iLead ? " as leader" : ""} · {myTeam.members.length}/{event.teamMax} members
              </p>
              <div className="flex gap-2">
                {iLead && (
                  <Button size="sm" variant="outline" render={<Link href={`/teams/${myTeam.id}/applications`} />}>
                    Review applications
                  </Button>
                )}
                <Button size="sm" render={<Link href={`/teams/${myTeam.id}`} />}>
                  {iLead ? "Manage team & roles" : "Open team"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p>{myAvailability ? "Your “looking for a team” card is live. Leaders can invite you." : "No team yet? Apply to a role below, or let leaders find you."}</p>
              <AvailabilityForm
                eventId={event.id}
                existing={
                  myAvailability
                    ? {
                        rolesWanted: myAvailability.rolesWanted,
                        note: myAvailability.note ?? "",
                        scope: myAvailability.scope,
                        hoursPerWeek: myAvailability.hoursPerWeek,
                      }
                    : null
                }
                allowCross={event.allowCrossCollege}
              />
            </>
          )}
        </div>
      )}

      <TeamBoardFilters skills={allSkills} colleges={colleges} />

      <section data-tour="roles">
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
          Open roles <span className="text-sm font-normal text-muted-foreground">{vacancies.length}</span>
        </h2>
        {vacancies.length === 0 ? (
          <EmptyState
            compact
            title="No open roles match"
            description={teams.length ? "Try clearing filters, or post a 'looking for a team' card." : "No teams yet — be the first to start one."}
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {vacancies.map(({ v, team, score, blocked }) => {
              const myApp = myAppByVacancy.get(v.id);
              const memberSkills = [...new Set(team.members.flatMap((m) => m.user.skills.filter((s) => s.level >= 3).map((s) => s.skill.name)))];
              return (
                <li key={v.id} className="flex flex-col overflow-hidden rounded-lg border border-rule bg-card">
                  <div className="flex items-center justify-between gap-2 border-b border-dashed border-rule bg-secondary/60 px-4 py-2">
                    <span className="label-mono font-semibold">Wanted</span>
                    <Link href={`/teams/${team.id}`} className="label-mono truncate text-muted-foreground hover:text-foreground hover:underline">
                      {team.name}
                    </Link>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-display text-xl leading-tight font-bold">{v.roleTitle}</h3>
                        <p className="text-sm text-muted-foreground">{team.leader.college?.name ?? "No college listed"}</p>
                      </div>
                      {score !== null && <MatchMeter score={score} label="your match" />}
                    </div>
                    {team.ideaPitch && <p className="border-l-2 border-ink/30 pl-3 text-sm">{team.ideaPitch}</p>}
                    {v.description && <p className="text-sm text-muted-foreground">{v.description}</p>}
                    <ul aria-label="Skills" className="flex flex-wrap gap-1">
                      {v.skills
                        .sort((a, b) => Number(b.required) - Number(a.required))
                        .map((s) => (
                          <li key={s.skillId}>
                            <SkillChip name={s.skill.name} required={s.required} held={Boolean(user && heldSkillIds.has(s.skillId))} />
                          </li>
                        ))}
                    </ul>
                    <MetaLine
                      items={[
                        v.commitmentHours && `${v.commitmentHours} h/week`,
                        `${v.slotsOpen} slot${v.slotsOpen === 1 ? "" : "s"} open`,
                        `Team ${team.members.length}/${event.teamMax}`,
                        v.scope === "intra" ? "Same college only" : "Any college",
                      ]}
                    />
                    {memberSkills.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        <span className="label-mono">Team has · </span>
                        {memberSkills.slice(0, 6).join(", ")}
                      </p>
                    )}
                    <div className="mt-auto pt-1">
                      {!user ? (
                        <Button size="sm" render={<Link href={`/login?next=/events/${event.id}?tab=teams`} />}>
                          Sign in to apply
                        </Button>
                      ) : myApp ? (
                        <Stamp tone={myApp.status === "accepted" ? "ok" : myApp.status === "rejected" ? "signal" : "ink"}>Applied · {myApp.status}</Stamp>
                      ) : blocked ? (
                        <p className="text-xs text-muted-foreground">{blocked}</p>
                      ) : (
                        <ApplyButton vacancyId={v.id} roleTitle={v.roleTitle} teamName={team.name} screeningQuestion={v.screeningQuestion} score={score ?? 0} />
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
          Looking for a team <span className="text-sm font-normal text-muted-foreground">{lookers.length}</span>
        </h2>
        {lookers.length === 0 ? (
          <EmptyState compact title="Nobody's posted yet" description="Solo participants who post a card show up here for team leaders to invite." />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {lookers.map((a) => {
              const canInvite =
                iLead &&
                myTeam &&
                myTeam.members.length < event.teamMax &&
                crossCollegeAllowed(event, myTeam.leader.collegeId, a.user.collegeId) &&
                (a.user.collegeId === myTeam.leader.collegeId || (a.scope === "cross" && a.user.openToCrossCollege));
              return (
                <li key={a.id} className="flex flex-col gap-2 rounded-lg border border-rule bg-card p-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={a.user.name} src={a.user.avatarUrl} className="size-9" />
                    <div className="min-w-0">
                      <Link href={`/u/${a.user.username}`} className="font-medium hover:underline">
                        {a.user.name}
                      </Link>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        {a.user.college?.name ?? "No college"}
                        {a.user.collegeVerified && <BadgeCheck className="size-3.5 text-ok" />}
                        {a.user.year && ` · Year ${a.user.year}`}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm">
                    Wants: <strong>{a.rolesWanted.join(", ")}</strong>
                    {a.hoursPerWeek && <span className="text-muted-foreground"> · {a.hoursPerWeek} h/week</span>}
                  </p>
                  {a.note && <p className="text-sm text-muted-foreground">{a.note}</p>}
                  <div className="flex flex-wrap gap-1">
                    {a.user.skills
                      .sort((x, y) => y.level - x.level)
                      .slice(0, 8)
                      .map((s) => (
                        <SkillChip key={s.skillId} name={s.skill.name} required={false} level={s.level} />
                      ))}
                  </div>
                  {canInvite && myTeam && <InviteButton teamId={myTeam.id} userId={a.userId} name={a.user.name} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
