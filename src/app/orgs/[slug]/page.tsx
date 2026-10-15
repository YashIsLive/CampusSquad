import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, desc, eq, ne } from "drizzle-orm";
import { BadgeCheck } from "lucide-react";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { EventCard } from "@/components/event-card";
import { UserAvatar } from "@/components/user-avatar";
import { FollowButton } from "./follow-button";
import { OrgAdmins } from "./org-admins";

async function getOrg(slug: string) {
  return db.query.organizations.findFirst({
    where: eq(schema.organizations.slug, slug),
    with: { college: true, members: { with: { user: true } } },
  });
}

export async function generateMetadata({ params }: PageProps<"/orgs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const org = await getOrg(slug);
  if (!org) return { title: "Not found" };
  return {
    title: org.name,
    description: org.description ?? undefined,
    openGraph: org.logoUrl ? { images: [org.logoUrl] } : undefined,
  };
}

export default async function OrgPage({ params }: PageProps<"/orgs/[slug]">) {
  const { slug } = await params;
  const [org, user] = await Promise.all([getOrg(slug), getCurrentUser()]);
  if (!org) notFound();

  const myRole = user ? org.members.find((m) => m.userId === user.id)?.role : undefined;
  const isAdmin = myRole === "owner" || myRole === "admin";

  const [events, [followers], following] = await Promise.all([
    db.query.events.findMany({
      where: isAdmin
        ? eq(schema.events.orgId, org.id)
        : and(eq(schema.events.orgId, org.id), ne(schema.events.status, "draft")),
      with: { org: { columns: { name: true, slug: true } } },
      orderBy: desc(schema.events.startsAt),
    }),
    db.select({ n: count() }).from(schema.orgFollowers).where(eq(schema.orgFollowers.orgId, org.id)),
    user
      ? db.query.orgFollowers.findFirst({
          where: and(eq(schema.orgFollowers.orgId, org.id), eq(schema.orgFollowers.userId, user.id)),
        })
      : undefined,
  ]);

  const now = new Date();
  const upcoming = events.filter((e) => e.endsAt >= now).reverse();
  const past = events.filter((e) => e.endsAt < now);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:py-10">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border bg-muted text-2xl font-semibold">
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo
            <img src={org.logoUrl} alt="" className="size-full object-cover" />
          ) : (
            org.name.slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-3xl font-extrabold sm:text-4xl">
            {org.name}
            {org.verified && <BadgeCheck className="size-5 text-signal-ink" aria-label="Verified organization" />}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[org.type[0].toUpperCase() + org.type.slice(1), org.college?.name, `${followers?.n ?? 0} followers`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {org.description && <p className="mt-2 max-w-2xl text-sm">{org.description}</p>}
        </div>
        <div className="flex gap-2">
          {user && <FollowButton orgId={org.id} initialFollowing={Boolean(following)} />}
          {isAdmin && <Button render={<Link href={`/events/new?org=${org.id}`} />}>Post event</Button>}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Upcoming events</h2>
        {upcoming.length === 0 ? (
          <EmptyState compact title="No upcoming events" description="Follow to hear about the next one." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} showStatus={isAdmin} />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Past events</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((e) => (
              <EventCard key={e.id} event={e} showStatus={isAdmin} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xl font-bold">Team</h2>
        {isAdmin && myRole === "owner" ? (
          <OrgAdmins
            orgId={org.id}
            members={org.members.map((m) => ({ userId: m.userId, name: m.user.name, username: m.user.username, role: m.role }))}
          />
        ) : (
          <ul className="flex flex-wrap gap-3">
            {org.members.map((m) => (
              <li key={m.userId}>
                <Link href={`/u/${m.user.username}`} className="flex items-center gap-2 rounded-lg border border-rule bg-card px-3 py-2 text-sm hover:bg-muted">
                  <UserAvatar name={m.user.name} src={m.user.avatarUrl} className="size-6" />
                  {m.user.name} <span className="text-muted-foreground">· {m.role}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
