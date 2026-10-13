import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { BadgeCheck, ExternalLink } from "lucide-react";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, EVENT_TYPE_LABEL } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { EmptyState } from "@/components/empty-state";

async function getProfile(username: string) {
  return db.query.profiles.findFirst({
    where: eq(schema.profiles.username, username.toLowerCase()),
    with: {
      college: true,
      skills: { with: { skill: true } },
    },
  });
}

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  const p = await getProfile(username);
  if (!p) return { title: "Profile not found" };
  return {
    title: p.name || p.username,
    description: [p.bio, p.college?.name].filter(Boolean).join(" · ") || undefined,
  };
}

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const [profile, viewer] = await Promise.all([getProfile(username), getCurrentUser()]);
  if (!profile) notFound();

  const [regs, teams] = await Promise.all([
    db.query.registrations.findMany({
      where: eq(schema.registrations.userId, profile.id),
      with: { event: { columns: { id: true, title: true, type: true, startsAt: true, status: true } } },
      orderBy: desc(schema.registrations.createdAt),
      limit: 20,
    }),
    db.query.teamMembers.findMany({
      where: eq(schema.teamMembers.userId, profile.id),
      with: { team: { with: { event: { columns: { id: true, title: true } } } } },
      orderBy: desc(schema.teamMembers.joinedAt),
      limit: 20,
    }),
  ]);

  const skills = [...profile.skills].sort((a, b) => b.endorsedCount - a.endorsedCount || b.level - a.level);
  const isMe = viewer?.id === profile.id;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:py-10">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <UserAvatar name={profile.name} src={profile.avatarUrl} className="size-20" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{profile.name || profile.username}</h1>
            <span className="text-sm text-muted-foreground">@{profile.username}</span>
          </div>
          {profile.college && (
            <p className="mt-1 flex items-center gap-1.5 text-sm">
              {profile.college.name}
              {profile.collegeVerified && (
                <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <BadgeCheck className="size-4" /> Verified
                </span>
              )}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {[profile.year && `Year ${profile.year}`, profile.branch].filter(Boolean).join(" · ")}
          </p>
          {profile.bio && <p className="mt-3 text-sm">{profile.bio}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.githubUrl && (
              <Button variant="outline" size="sm" render={<a href={profile.githubUrl} target="_blank" rel="noreferrer" />}>
                GitHub <ExternalLink />
              </Button>
            )}
            {profile.linkedinUrl && (
              <Button variant="outline" size="sm" render={<a href={profile.linkedinUrl} target="_blank" rel="noreferrer" />}>
                LinkedIn <ExternalLink />
              </Button>
            )}
            {profile.openToCrossCollege && <Badge variant="secondary">Open to cross-college teams</Badge>}
            {isMe && (
              <Button size="sm" variant="ghost" render={<Link href="/onboarding" />}>
                Edit profile
              </Button>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Skills</h2>
        {skills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No skills added yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {skills.map((s) => (
              <li key={s.skillId} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm">
                <span className="font-medium">{s.skill.name}</span>
                <span className="flex gap-0.5" aria-label={`Level ${s.level} of 5`}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className={i <= s.level ? "size-1.5 rounded-full bg-primary" : "size-1.5 rounded-full bg-muted"} />
                  ))}
                </span>
                {s.endorsedCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    · {s.endorsedCount} endorsement{s.endorsedCount === 1 ? "" : "s"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section>
          <h2 className="mb-2 font-medium">Teams</h2>
          {teams.length === 0 ? (
            <EmptyState compact title="No teams yet" />
          ) : (
            <ul className="flex flex-col divide-y rounded-xl border">
              {teams.map((t) => (
                <li key={t.teamId} className="px-3 py-2.5 text-sm">
                  <span className="font-medium">{t.team.name}</span>
                  {t.roleTitle && <span className="text-muted-foreground"> · {t.roleTitle}</span>}
                  <Link href={`/events/${t.team.event.id}`} className="block text-muted-foreground hover:underline">
                    {t.team.event.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="mb-2 font-medium">Events</h2>
          {regs.length === 0 ? (
            <EmptyState compact title="No events yet" />
          ) : (
            <ul className="flex flex-col divide-y rounded-xl border">
              {regs.map((r) => (
                <li key={r.id} className="px-3 py-2.5 text-sm">
                  <Link href={`/events/${r.event.id}`} className="font-medium hover:underline">
                    {r.event.title}
                  </Link>
                  <span className="block text-muted-foreground">
                    {EVENT_TYPE_LABEL[r.event.type]} · {formatDate(r.event.startsAt)}
                    {r.status === "checked_in" && " · attended"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
