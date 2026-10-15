import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, count, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { EmptyState } from "@/components/empty-state";
import { CollegeReview, OrgVerifyToggle } from "./admin-controls";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const user = await requireUser({ next: "/admin" });
  if (!user.isAdmin) notFound();

  const [pending, orgs, [stats]] = await Promise.all([
    db
      .select({
        id: schema.colleges.id,
        name: schema.colleges.name,
        city: schema.colleges.city,
        state: schema.colleges.state,
        createdAt: schema.colleges.createdAt,
        students: count(schema.profiles.id),
        sampleEmail: sql<string | null>`min(${schema.profiles.email})`,
      })
      .from(schema.colleges)
      .leftJoin(schema.profiles, eq(schema.profiles.collegeId, schema.colleges.id))
      .where(eq(schema.colleges.verified, false))
      .groupBy(schema.colleges.id)
      .orderBy(asc(schema.colleges.createdAt)),
    db.query.organizations.findMany({ with: { college: true }, orderBy: asc(schema.organizations.name) }),
    db
      .select({
        users: sql<number>`(select count(*)::int from profiles)`,
        events: sql<number>`(select count(*)::int from events where status = 'published')`,
        teams: sql<number>`(select count(*)::int from teams)`,
        accepted: sql<number>`(select count(*)::int from applications where status = 'accepted')`,
      })
      .from(sql`(select 1) as _`),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-6 sm:py-10">
      <h1 className="text-3xl font-extrabold sm:text-4xl">Admin</h1>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Users", stats.users],
          ["Live events", stats.events],
          ["Teams", stats.teams],
          ["Roles filled", stats.accepted],
        ].map(([label, n]) => (
          <div key={label} className="rounded-lg border border-rule bg-card p-4">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{n}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h2 className="text-xl font-bold">College requests</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Students who couldn&apos;t find their college requested these. Set the official email domain to verify everyone whose email matches.
        </p>
        {pending.length === 0 ? (
          <EmptyState compact title="No pending requests" />
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((c) => (
              <li key={c.id}>
                <CollegeReview
                  college={{
                    id: c.id,
                    name: c.name,
                    city: c.city,
                    state: c.state,
                    students: c.students,
                    suggestedDomain: c.sampleEmail?.split("@")[1] ?? "",
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Organizations</h2>
        <ul className="flex flex-col divide-y divide-rule rounded-lg border border-rule bg-card">
          {orgs.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <Link href={`/orgs/${o.slug}`} className="font-medium hover:underline">
                  {o.name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">{o.college?.name ?? "No college"}</p>
              </div>
              <OrgVerifyToggle orgId={o.id} verified={o.verified} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
