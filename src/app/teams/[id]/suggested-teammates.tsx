import Link from "next/link";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { Sparkles } from "lucide-react";
import { db, schema } from "@/db";
import { suggestTeammates, type Candidate } from "@/lib/recommend";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { InviteButton } from "@/app/events/[id]/invite-button";

type Role = {
  id: string;
  roleTitle: string;
  scope: "intra" | "cross";
  status: "open" | "filled" | "closed";
  skills: Array<{ skillId: string; required: boolean }>;
};

/**
 * For team leaders: people at this event who aren't on a team yet, ranked by fit for the
 * team's open roles. Excludes anyone already invited or already applying to this team.
 */
export async function SuggestedTeammates({
  team,
  event,
  leaderCollegeId,
  roles,
}: {
  team: { id: string };
  event: { id: string; allowCrossCollege: boolean };
  leaderCollegeId: string | null;
  roles: Role[];
}) {
  const open = roles.filter((r) => r.status === "open");
  if (open.length === 0) return null;

  // Everyone at the event without a team: open "looking" cards + solo registrants.
  const [looking, solo, invited, applied] = await Promise.all([
    db
      .select({ userId: schema.availabilityPosts.userId })
      .from(schema.availabilityPosts)
      .where(and(eq(schema.availabilityPosts.eventId, event.id), eq(schema.availabilityPosts.status, "open"))),
    db
      .select({ userId: schema.registrations.userId })
      .from(schema.registrations)
      .where(and(eq(schema.registrations.eventId, event.id), isNull(schema.registrations.teamId))),
    db
      .select({ userId: schema.invites.userId })
      .from(schema.invites)
      .where(and(eq(schema.invites.teamId, team.id), or(eq(schema.invites.status, "pending"), eq(schema.invites.status, "declined")))),
    db
      .select({ userId: schema.applications.applicantId })
      .from(schema.applications)
      .where(inArray(schema.applications.vacancyId, roles.map((r) => r.id))),
  ]);
  const exclude = new Set([...invited, ...applied].map((r) => r.userId));
  const lookingIds = new Set(looking.map((l) => l.userId));
  const ids = [...new Set([...looking, ...solo].map((r) => r.userId))].filter((id) => !exclude.has(id));
  if (ids.length === 0) return null;

  const people = await db.query.profiles.findMany({
    where: inArray(schema.profiles.id, ids),
    with: { college: true, skills: { with: { skill: true } } },
  });
  const candidates: Candidate[] = people.map((p) => ({
    userId: p.id,
    collegeId: p.collegeId,
    openToCrossCollege: p.openToCrossCollege,
    skills: p.skills.map((s) => ({ skillId: s.skillId, level: s.level })),
    source: lookingIds.has(p.id) ? "looking" : "solo",
  }));
  const suggestions = suggestTeammates({
    roles: open.map((r) => ({
      id: r.id,
      roleTitle: r.roleTitle,
      scope: r.scope,
      requiredSkillIds: r.skills.filter((s) => s.required).map((s) => s.skillId),
      niceSkillIds: r.skills.filter((s) => !s.required).map((s) => s.skillId),
    })),
    candidates,
    leaderCollegeId,
    allowCrossCollege: event.allowCrossCollege,
  });
  if (suggestions.length === 0) return null;
  const byId = new Map(people.map((p) => [p.id, p]));

  return (
    <section>
      <h2 className="mb-1 flex items-center gap-1.5 font-medium">
        <Sparkles className="size-4 text-primary" /> Suggested teammates
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">People at this event without a team whose skills fit your open roles.</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {suggestions.map((s) => {
          const p = byId.get(s.candidate.userId)!;
          return (
            <li key={p.id} className="flex flex-col gap-2 rounded-xl border p-3">
              <div className="flex items-center gap-3">
                <UserAvatar name={p.name} src={p.avatarUrl} className="size-9" />
                <div className="min-w-0 flex-1">
                  <Link href={`/u/${p.username}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.college?.name ?? "No college"}
                    {s.candidate.source === "looking" && " · looking for a team"}
                  </p>
                </div>
                <Badge variant="secondary" title={`Best fit: ${s.roleTitle}`}>
                  {s.score}%
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Fits <strong className="text-foreground">{s.roleTitle}</strong> ·{" "}
                {p.skills
                  .sort((a, b) => b.level - a.level)
                  .slice(0, 4)
                  .map((k) => k.skill.name)
                  .join(", ")}
              </p>
              <InviteButton teamId={team.id} userId={p.id} name={p.name} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
