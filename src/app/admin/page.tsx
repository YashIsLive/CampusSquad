import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, count, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import { ArrowRight, BadgeCheck, Search } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { requireAdminPageAal } from "@/lib/mfa";
import { formatShort } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { TabNav } from "@/components/nav-bits";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { CollegeReview, OrgVerifyToggle, PersonActions, ReportActions, TakeDownButton } from "./admin-controls";
import { relative } from "@/lib/format";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const SECTIONS = [
  { key: "overview", label: "Overview" },
  { key: "reports", label: "Reports" },
  { key: "colleges", label: "Colleges" },
  { key: "clubs", label: "Clubs" },
  { key: "people", label: "People" },
  { key: "events", label: "Events" },
] as const;
type Section = (typeof SECTIONS)[number]["key"];

/** Platform admin: a to-do list first, then the tools. Admins only (everyone else gets a 404). */
export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const user = await requireUser({ next: "/admin" });
  if (!user.isAdmin) notFound();
  const sp = await searchParams;
  await requireAdminPageAal(`/admin${typeof sp.section === "string" ? `?section=${sp.section}` : ""}`);
  const section: Section = SECTIONS.find((s) => s.key === sp.section)?.key ?? "overview";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";

  const [todo] = await db
    .select({
      colleges: sql<number>`(select count(*)::int from colleges where not verified)`,
      ids: sql<number>`(select count(*)::int from verification_requests where status = 'pending')`,
      clubs: sql<number>`(select count(*)::int from organizations where not verified)`,
      reports: sql<number>`(select count(*)::int from reports where status = 'open')`,
    })
    .from(sql`(select 1) as _`);

  const href = (key: Section) => (key === "overview" ? "/admin" : `/admin?section=${key}`);
  const badge = (n: number) => (n > 0 ? <span className="rounded-full bg-court px-2 text-xs font-semibold text-[#0f0f0e]">{n}</span> : undefined);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:py-10">
      <header>
        <p className="text-sm text-muted-foreground">Platform admin</p>
        <h1 className="text-4xl leading-[0.95] font-black sm:text-5xl">Admin</h1>
      </header>

      <TabNav
        label="Admin sections"
        id="admin"
        tabs={SECTIONS.map((s) => ({
          href: href(s.key),
          label: s.label,
          active: section === s.key,
          badge:
            s.key === "colleges" ? badge(todo.colleges) : s.key === "clubs" ? badge(todo.clubs) : s.key === "reports" ? badge(todo.reports) : undefined,
        }))}
      />

      {section === "overview" && <Overview todo={todo} />}
      {section === "reports" && <Reports />}
      {section === "colleges" && <Colleges />}
      {section === "clubs" && <Clubs q={q} />}
      {section === "people" && <People q={q} me={user.id} />}
      {section === "events" && <Events q={q} />}
    </div>
  );
}

async function Overview({ todo }: { todo: { colleges: number; ids: number; clubs: number; reports: number } }) {
  const [[stats], recent] = await Promise.all([
    db
      .select({
        users: sql<number>`(select count(*)::int from profiles)`,
        newUsers: sql<number>`(select count(*)::int from profiles where created_at >= now() - interval '7 days')`,
        verified: sql<number>`(select count(*)::int from profiles where college_verified)`,
        events: sql<number>`(select count(*)::int from events where status = 'published' and ends_at >= now())`,
        teams: sql<number>`(select count(*)::int from teams)`,
        filled: sql<number>`(select count(*)::int from applications where status = 'accepted')`,
        open: sql<number>`(select coalesce(sum(slots_open), 0)::int from vacancies where status = 'open')`,
      })
      .from(sql`(select 1) as _`),
    db.query.events.findMany({
      where: sql`${schema.events.createdAt} >= now() - interval '7 days'`,
      with: { org: { columns: { name: true } } },
      orderBy: desc(schema.events.createdAt),
      limit: 5,
    }),
  ]);

  const tasks = [
    { n: todo.reports, label: "reports to look at (within 24 hours)", href: "/admin?section=reports" },
    { n: todo.colleges, label: "college requests to approve", href: "/admin?section=colleges" },
    { n: todo.ids, label: "student IDs to check", href: "/verify/review" },
    { n: todo.clubs, label: "clubs without a verified badge", href: "/admin?section=clubs" },
  ];
  const pending = tasks.filter((t) => t.n > 0);
  const pct = stats.users ? Math.round((stats.verified / stats.users) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="needs-you" className="overflow-hidden rounded-2xl border border-ink">
        <h2 id="needs-you" className="border-b border-ink bg-court px-4 py-3 text-lg font-extrabold text-[#0f0f0e]">
          {pending.length ? "Needs you" : "All caught up"}
        </h2>
        {pending.length === 0 ? (
          <p className="bg-card px-4 py-4 text-sm text-muted-foreground">No requests waiting. New ones also arrive in your notifications.</p>
        ) : (
          <ul className="divide-y divide-rule bg-card">
            {pending.map((t) => (
              <li key={t.label}>
                <Link href={t.href} className="flex items-center gap-4 px-4 py-3 hover:bg-secondary/60">
                  <span className="score w-10 text-4xl">{t.n}</span>
                  <span className="flex-1 font-medium">{t.label}</span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-ink bg-ink sm:grid-cols-4">
        {[
          [stats.users, "students", `+${stats.newUsers} this week`],
          [`${pct}%`, "verified", `${stats.verified} students`],
          [stats.events, "live events", null],
          [stats.open, "open team spots", `${stats.filled} filled so far · ${stats.teams} teams`],
        ].map(([n, label, sub]) => (
          <div key={String(label)} className="flex flex-col gap-1 bg-card p-4">
            <dd className="score text-5xl">{n}</dd>
            <dt className="text-sm font-medium">{label}</dt>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        ))}
      </dl>

      <section aria-labelledby="recent">
        <h2 id="recent" className="mb-3 text-xl font-bold">
          New this week
        </h2>
        {recent.length === 0 ? (
          <EmptyState compact title="No new events this week" />
        ) : (
          <ul className="divide-y divide-rule rounded-2xl border border-rule bg-card">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <Link href={`/events/${e.id}`} className="min-w-0 truncate font-medium hover:underline">
                  {e.title}
                </Link>
                <span className="shrink-0 text-muted-foreground">
                  {e.org.name} · {e.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

async function Colleges() {
  const [pending, all] = await Promise.all([
    db
      .select({
        id: schema.colleges.id,
        name: schema.colleges.name,
        city: schema.colleges.city,
        state: schema.colleges.state,
        students: count(schema.profiles.id),
        sampleEmail: sql<string | null>`min(${schema.profiles.email})`,
      })
      .from(schema.colleges)
      .leftJoin(schema.profiles, eq(schema.profiles.collegeId, schema.colleges.id))
      .where(eq(schema.colleges.verified, false))
      .groupBy(schema.colleges.id)
      .orderBy(asc(schema.colleges.createdAt)),
    db
      .select({
        id: schema.colleges.id,
        name: schema.colleges.name,
        city: schema.colleges.city,
        domain: schema.colleges.emailDomain,
        students: count(schema.profiles.id),
        verified: sql<number>`count(*) filter (where ${schema.profiles.collegeVerified})::int`,
      })
      .from(schema.colleges)
      .leftJoin(schema.profiles, eq(schema.profiles.collegeId, schema.colleges.id))
      .where(eq(schema.colleges.verified, true))
      .groupBy(schema.colleges.id)
      .orderBy(asc(schema.colleges.name)),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-xl font-bold">Requests</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Students who couldn&apos;t find their college asked for these. Set the official email domain to approve; students with a
          proven address on that domain get verified.
        </p>
        {pending.length === 0 ? (
          <EmptyState compact title="No requests waiting" />
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((c) => (
              <li key={c.id}>
                <CollegeReview
                  college={{ id: c.id, name: c.name, city: c.city, state: c.state, students: c.students, suggestedDomain: c.sampleEmail?.split("@")[1] ?? "" }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold">On Got Next</h2>
        <ul className="divide-y divide-rule rounded-2xl border border-rule bg-card">
          {all.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.city} · {c.domain ? `@${c.domain}` : "no email domain"}
                </p>
              </div>
              <span className="shrink-0 text-right text-muted-foreground">
                {c.students} students · {c.verified} verified
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SearchBox({ section, q, placeholder }: { section: Section; q: string; placeholder: string }) {
  return (
    <form action="/admin" className="flex gap-2">
      <input type="hidden" name="section" value={section} />
      <div className="relative flex-1">
        <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder} className="h-10 pl-9" />
      </div>
      <Button type="submit" variant="ink">
        Search
      </Button>
    </form>
  );
}

async function Clubs({ q }: { q: string }) {
  const orgs = await db.query.organizations.findMany({
    where: q ? ilike(schema.organizations.name, `%${q.replace(/[%_\\]/g, "\\$&")}%`) : undefined,
    with: { college: { columns: { name: true } } },
    orderBy: [asc(schema.organizations.verified), asc(schema.organizations.name)],
    limit: 100,
  });
  return (
    <div className="flex flex-col gap-4">
      <SearchBox section="clubs" q={q} placeholder="Search clubs" />
      <p className="text-sm text-muted-foreground">The verified badge tells students a club is real. Unverified clubs are listed first.</p>
      {orgs.length === 0 ? (
        <EmptyState compact title="No clubs found" />
      ) : (
        <ul className="divide-y divide-rule rounded-2xl border border-rule bg-card">
          {orgs.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <Link href={`/orgs/${o.slug}`} className="font-medium hover:underline">
                  {o.name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">{o.college?.name ?? "Not tied to a college"}</p>
              </div>
              <OrgVerifyToggle orgId={o.id} verified={o.verified} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function People({ q, me }: { q: string; me: string }) {
  const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const people = await db.query.profiles.findMany({
    where: q
      ? or(ilike(schema.profiles.name, like), ilike(schema.profiles.email, like), ilike(schema.profiles.username, like))
      : eq(schema.profiles.isAdmin, true),
    with: { college: { columns: { name: true } } },
    orderBy: asc(schema.profiles.name),
    limit: 50,
  });
  return (
    <div className="flex flex-col gap-4">
      <SearchBox section="people" q={q} placeholder="Search by name, email or username" />
      <p className="text-sm text-muted-foreground">{q ? `${people.length} found.` : "Showing admins. Search to find anyone."}</p>
      {people.length === 0 ? (
        <EmptyState compact title="Nobody matches that" />
      ) : (
        <ul className="divide-y divide-rule rounded-2xl border border-rule bg-card">
          {people.map((p) => (
            <li key={p.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <UserAvatar name={p.name} src={p.avatarUrl} className="size-9" />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-medium">
                    <Link href={`/u/${p.username}`} className="truncate hover:underline">
                      {p.name || p.username}
                    </Link>
                    {p.collegeVerified && <BadgeCheck className="size-4 shrink-0 text-ok" role="img" aria-label="Verified" />}
                    {p.isAdmin && <span className="rounded-full bg-ink px-1.5 text-[11px] text-paper">admin</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.email} · {p.college?.name ?? "no college"}
                    {p.collegeVerified && p.collegeVerifiedVia ? ` · verified by ${p.collegeVerifiedVia.replace("_", " ")}` : ""}
                  </p>
                </div>
              </div>
              <PersonActions userId={p.id} name={p.name || p.username} verified={p.collegeVerified} admin={p.isAdmin} self={p.id === me} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function Events({ q }: { q: string }) {
  const events = await db.query.events.findMany({
    where: and(
      eq(schema.events.status, "published"),
      q ? ilike(schema.events.title, `%${q.replace(/[%_\\]/g, "\\$&")}%`) : gte(schema.events.endsAt, new Date()),
    ),
    with: { org: { columns: { name: true, verified: true } } },
    orderBy: asc(schema.events.startsAt),
    limit: 60,
  });
  return (
    <div className="flex flex-col gap-4">
      <SearchBox section="events" q={q} placeholder="Search events" />
      <p className="text-sm text-muted-foreground">Live events. Take one down if it&apos;s spam or a duplicate; its organizers can fix and republish it.</p>
      {events.length === 0 ? (
        <EmptyState compact title="No live events" />
      ) : (
        <ul className="divide-y divide-rule rounded-2xl border border-rule bg-card">
          {events.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <Link href={`/events/${e.id}`} className="font-medium hover:underline">
                  {e.title}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {formatShort(e.startsAt)} · {e.org.name}
                  {!e.org.verified && " · unverified club"}
                </p>
              </div>
              <TakeDownButton eventId={e.id} title={e.title} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const REASON_LABEL = {
  spam: "Spam or a scam",
  fake: "Fake or impersonation",
  harassment: "Harassment or bullying",
  inappropriate: "Inappropriate or offensive",
  other: "Something else",
} as const;

/** Reports queue: oldest open first (the 24-hour clock), then the last few closed ones. */
async function Reports() {
  const [open, closed] = await Promise.all([
    db.query.reports.findMany({
      where: eq(schema.reports.status, "open"),
      with: { reporter: { columns: { name: true, username: true } } },
      orderBy: asc(schema.reports.createdAt),
      limit: 50,
    }),
    db.query.reports.findMany({
      where: sql`${schema.reports.status} <> 'open'`,
      orderBy: desc(schema.reports.resolvedAt),
      limit: 10,
    }),
  ]);

  // Where each report points, and for conversations, the messages themselves.
  const profileIds = open.filter((r) => r.targetType === "profile").map((r) => r.targetId);
  const convoIds = open.filter((r) => r.targetType === "conversation").map((r) => r.targetId);
  const [profiles, convos] = await Promise.all([
    profileIds.length
      ? db.select({ id: schema.profiles.id, username: schema.profiles.username }).from(schema.profiles).where(inArray(schema.profiles.id, profileIds))
      : [],
    convoIds.length
      ? db.query.applicationMessages.findMany({
          where: inArray(schema.applicationMessages.applicationId, convoIds),
          with: { sender: { columns: { name: true } } },
          orderBy: asc(schema.applicationMessages.createdAt),
        })
      : [],
  ]);
  const usernameOf = new Map(profiles.map((p) => [p.id, p.username]));
  const hrefFor = (type: string, id: string) =>
    type === "event" ? `/events/${id}` : type === "team" ? `/teams/${id}` : type === "profile" && usernameOf.get(id) ? `/u/${usernameOf.get(id)}` : null;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-xl font-bold">Open</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Look at each report within 24 hours. Use Events to take an event down; the reporter is told when you close a report, but never
          who you are.
        </p>
        {open.length === 0 ? (
          <EmptyState compact title="No open reports" />
        ) : (
          <ul className="flex flex-col gap-3">
            {open.map((r) => {
              const href = hrefFor(r.targetType, r.targetId);
              const messages = convos.filter((m) => m.applicationId === r.targetId).slice(-20);
              return (
                <li key={r.id} className="grid gap-4 rounded-2xl border border-ink bg-card p-4 sm:grid-cols-[1fr_18rem]">
                  <div className="flex min-w-0 flex-col gap-2 text-sm">
                    <p className="font-semibold">{href ? <Link href={href} className="underline decoration-court decoration-2 underline-offset-4">{r.targetLabel}</Link> : r.targetLabel}</p>
                    <p>
                      <span className="rounded-full bg-signal-soft px-2 py-0.5 text-xs font-semibold text-signal-ink">{REASON_LABEL[r.reason]}</span>
                      <span className="ml-2 text-muted-foreground">
                        {relative(r.createdAt)} · by {r.reporter ? `${r.reporter.name || r.reporter.username}` : "a deleted account"}
                      </span>
                    </p>
                    {r.details && <p className="rounded-md bg-secondary p-3 whitespace-pre-wrap">{r.details}</p>}
                    {messages.length > 0 && (
                      <details className="rounded-md border border-rule p-3">
                        <summary className="cursor-pointer font-medium">Show the conversation ({messages.length} messages)</summary>
                        <ol className="mt-2 flex flex-col gap-1.5">
                          {messages.map((m) => (
                            <li key={m.id}>
                              <strong>{m.sender.name}:</strong> <span className="whitespace-pre-wrap">{m.body}</span>
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}
                  </div>
                  <ReportActions reportId={r.id} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {closed.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Recently closed</h2>
          <ul className="divide-y divide-rule rounded-2xl border border-rule bg-card">
            {closed.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 truncate">{r.targetLabel}</span>
                <span className="shrink-0 text-muted-foreground">
                  {r.status === "resolved" ? "acted on" : "no action"}
                  {r.resolvedAt ? ` · ${relative(r.resolvedAt)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
