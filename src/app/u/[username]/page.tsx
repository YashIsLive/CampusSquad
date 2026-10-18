import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { BadgeCheck, ExternalLink } from "lucide-react";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, EVENT_TYPE_LABEL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { EmptyState } from "@/components/empty-state";
import { Stamp } from "@/components/noticeboard";
import { VOUCHES_NEEDED, countValidVouches } from "@/lib/verification";
import { VouchButton } from "./vouch-button";

const LEVEL = ["", "Beginner", "Basic", "Comfy", "Strong", "Expert"];

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

  // A verified student at the same college can vouch for an unverified classmate.
  const canVouch = Boolean(
    viewer && viewer.id !== profile.id && viewer.collegeVerified && viewer.collegeId && !profile.collegeVerified && profile.collegeId === viewer.collegeId,
  );
  const [vouchCount, alreadyVouched] =
    canVouch || (viewer?.id === profile.id && !profile.collegeVerified && profile.collegeId)
      ? await Promise.all([
          countValidVouches(profile.id, profile.collegeId!),
          viewer
            ? db.query.vouches.findFirst({ where: and(eq(schema.vouches.voucherId, viewer.id), eq(schema.vouches.userId, profile.id)) })
            : null,
        ])
      : [0, null];

  const skills = [...profile.skills].sort((a, b) => b.endorsedCount - a.endorsedCount || b.level - a.level);
  const isMe = viewer?.id === profile.id;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 motion-safe:animate-page-in sm:py-10">
      <section aria-label="Profile" className="overflow-hidden rounded-xl border border-ink/25 bg-card">
        <div className="flex items-center justify-between border-b border-dashed border-rule bg-secondary/60 px-5 py-2.5">
          <span className="label-mono font-semibold">Campus pass</span>
          {profile.collegeVerified ? <Stamp tone="ok">Verified</Stamp> : <span className="label-mono text-muted-foreground">Unverified</span>}
        </div>
        <div className="flex flex-col gap-5 p-5 sm:flex-row">
          <UserAvatar name={profile.name} src={profile.avatarUrl} className="size-24" />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl leading-tight font-extrabold sm:text-4xl">{profile.name || profile.username}</h1>
            <p className="label-mono mt-1 text-muted-foreground">@{profile.username}</p>
            <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {profile.college && (
                <div>
                  <dt className="label-mono text-muted-foreground">College</dt>
                  <dd className="flex items-center gap-1 text-sm">
                    {profile.college.name}
                    {profile.collegeVerified && <BadgeCheck className="size-4 text-ok" role="img" aria-label="Verified student" />}
                  </dd>
                </div>
              )}
              {(profile.year || profile.branch) && (
                <div>
                  <dt className="label-mono text-muted-foreground">Studying</dt>
                  <dd className="text-sm">{[profile.year && `Year ${profile.year}`, profile.branch].filter(Boolean).join(" · ")}</dd>
                </div>
              )}
              <div>
                <dt className="label-mono text-muted-foreground">Reliability</dt>
                <dd className="text-sm">{Math.round(Number(profile.reliabilityScore))}% show-up</dd>
              </div>
              <div>
                <dt className="label-mono text-muted-foreground">Teams</dt>
                <dd className="text-sm">{profile.openToCrossCollege ? "Open to any college" : "Own college only"}</dd>
              </div>
            </dl>
            {profile.bio && <p className="mt-4 max-w-prose border-l-2 border-ink/30 pl-3 text-sm">{profile.bio}</p>}
          </div>
        </div>
        {(profile.githubUrl || profile.linkedinUrl || isMe) && (
          <div className="flex flex-wrap gap-2 border-t border-dashed border-rule px-5 py-3">
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
            {isMe && (
              <Button size="sm" variant="ink" className="ml-auto" render={<Link href="/onboarding" />}>
                Edit profile
              </Button>
            )}
          </div>
        )}
      </section>

      {canVouch && profile.college && (
        <section aria-label="Vouch" className="flex flex-col gap-3 rounded-lg border border-dashed border-ink/30 bg-card p-4 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm">
            {alreadyVouched ? (
              <>You vouched for {profile.name.split(" ")[0]}. {VOUCHES_NEEDED - vouchCount > 0 && `${VOUCHES_NEEDED - vouchCount} more needed.`}</>
            ) : (
              <>
                Do you know {profile.name.split(" ")[0]} from {profile.college.name}? {VOUCHES_NEEDED} vouches from verified classmates verify
                them ({vouchCount} so far).
              </>
            )}
          </p>
          {!alreadyVouched && <VouchButton userId={profile.id} name={profile.name || profile.username} college={profile.college.name} />}
        </section>
      )}
      {isMe && !profile.collegeVerified && (
        <section aria-label="Verification" className="flex flex-col gap-3 rounded-lg border border-dashed border-ink/30 bg-card p-4 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm">
            Your campus isn&apos;t verified yet{profile.collegeId ? ` (${vouchCount} of ${VOUCHES_NEEDED} vouches)` : ""}. Use your student ID or
            ask classmates to vouch.
          </p>
          <Button size="sm" render={<Link href="/verify" />}>
            Get verified
          </Button>
        </section>
      )}

      <section aria-labelledby="skills-heading">
        <h2 id="skills-heading" className="mb-3 text-xl font-bold">
          Skills
        </h2>
        {skills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No skills added yet.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {skills.map((s) => (
              <li key={s.skillId} className="flex items-center justify-between gap-3 rounded-md border border-rule bg-card px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.skill.name}</span>
                  {s.endorsedCount > 0 && (
                    <span className="label-mono text-ok">
                      Endorsed by {s.endorsedCount} teammate{s.endorsedCount === 1 ? "" : "s"}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="flex gap-0.5" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span key={i} className={i <= s.level ? "h-3 w-1.5 rounded-[2px] bg-ink" : "h-3 w-1.5 rounded-[2px] bg-rule"} />
                    ))}
                  </span>
                  <span className="label-mono w-14 text-right text-muted-foreground">{LEVEL[s.level]}</span>
                  <span className="sr-only">Level {s.level} of 5</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section>
          <h2 className="mb-2 text-xl font-bold">Teams</h2>
          {teams.length === 0 ? (
            <EmptyState compact title="No teams yet" />
          ) : (
            <ul className="flex flex-col divide-y divide-rule rounded-lg border border-rule bg-card">
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
          <h2 className="mb-2 text-xl font-bold">Events</h2>
          {regs.length === 0 ? (
            <EmptyState compact title="No events yet" />
          ) : (
            <ul className="flex flex-col divide-y divide-rule rounded-lg border border-rule bg-card">
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
