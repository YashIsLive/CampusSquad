import "server-only";
import { and, eq, gt, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CurrentUser } from "@/lib/auth";
import { matchScore } from "@/lib/match-score";

export type SpotForYou = {
  vacancyId: string;
  roleTitle: string;
  score: number;
  team: { id: string; name: string; size: number };
  event: { id: string; title: string; teamMax: number; regDeadline: Date };
};

const MIN_SCORE = 40;

/**
 * Open spots across upcoming events that fit the student's skills, best first. Skips events where
 * they already have a team, spots they've applied to, and spots the college rules keep them out of.
 * Powers the "teams that need you" rail on the home page.
 */
export async function spotsForYou(user: CurrentUser, limit = 8): Promise<SpotForYou[]> {
  const now = new Date();
  const [mySkills, myTeams, myApps] = await Promise.all([
    db.query.userSkills.findMany({ where: eq(schema.userSkills.userId, user.id) }),
    db.select({ eventId: schema.teamMembers.eventId }).from(schema.teamMembers).where(eq(schema.teamMembers.userId, user.id)),
    db.select({ vacancyId: schema.applications.vacancyId }).from(schema.applications).where(eq(schema.applications.applicantId, user.id)),
  ]);
  if (mySkills.length === 0) return [];
  const busyEvents = new Set(myTeams.map((t) => t.eventId));
  const applied = new Set(myApps.map((a) => a.vacancyId));

  const upcoming = await db
    .select({ id: schema.events.id })
    .from(schema.events)
    .where(and(eq(schema.events.status, "published"), eq(schema.events.registrationsOpen, true), gt(schema.events.regDeadline, now)));
  const eventIds = upcoming.map((e) => e.id).filter((id) => !busyEvents.has(id));
  if (eventIds.length === 0) return [];

  const teams = await db.query.teams.findMany({
    where: inArray(schema.teams.eventId, eventIds),
    with: {
      event: { columns: { id: true, title: true, teamMax: true, regDeadline: true, allowCrossCollege: true } },
      leader: { columns: { collegeId: true } },
      members: { columns: { userId: true } },
      vacancies: { where: eq(schema.vacancies.status, "open"), with: { skills: true } },
    },
  });

  const spots: SpotForYou[] = [];
  for (const team of teams) {
    if (team.leaderId === user.id || !team.isOpen) continue;
    const sameCollege = user.collegeId !== null && user.collegeId === team.leader.collegeId;
    if (!team.event.allowCrossCollege && !sameCollege) continue;
    for (const v of team.vacancies) {
      if (applied.has(v.id) || (v.scope === "intra" && !sameCollege)) continue;
      const score = matchScore({
        requiredSkillIds: v.skills.filter((s) => s.required).map((s) => s.skillId),
        niceToHaveSkillIds: v.skills.filter((s) => !s.required).map((s) => s.skillId),
        applicantSkills: mySkills.map((s) => ({ skillId: s.skillId, level: s.level })),
        sameCollege,
      });
      if (score < MIN_SCORE) continue;
      spots.push({
        vacancyId: v.id,
        roleTitle: v.roleTitle,
        score,
        team: { id: team.id, name: team.name, size: team.members.length },
        event: { id: team.event.id, title: team.event.title, teamMax: team.event.teamMax, regDeadline: team.event.regDeadline },
      });
    }
  }
  return spots.sort((a, b) => b.score - a.score).slice(0, limit);
}
