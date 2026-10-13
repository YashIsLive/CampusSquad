import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import ReactMarkdown from "react-markdown";
import { BadgeCheck, CalendarDays, Clock, IndianRupee, MapPin, Settings, Trophy, Users } from "lucide-react";
import { db, schema } from "@/db";
import { getCurrentUser, isOrgAdmin } from "@/lib/auth";
import { getEventWithOrg } from "@/lib/queries";
import { registrationCheck } from "@/lib/registration";
import {
  EVENT_TYPE_LABEL,
  MODE_LABEL,
  SCOPE_LABEL,
  domainLabel,
  formatDateTime,
  relative,
  siteUrl,
} from "@/lib/format";
import { googleCalendarUrl } from "@/lib/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { RegisterPanel } from "./register-panel";
import { SaveEventButton } from "./save-button";
import { TeamsTab } from "./teams-tab";

export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  const { id } = await params;
  const event = await getEventWithOrg(id);
  if (!event || event.status === "draft") return { title: "Event" };
  const description = `${EVENT_TYPE_LABEL[event.type]} by ${event.org.name} · ${formatDateTime(event.startsAt)} · ${
    MODE_LABEL[event.mode]
  }${event.city ? `, ${event.city}` : ""}. Register by ${formatDateTime(event.regDeadline)}.`;
  return {
    title: event.title,
    description,
    alternates: { canonical: `${siteUrl()}/events/${event.id}` },
    openGraph: { title: event.title, description, type: "website", url: `${siteUrl()}/events/${event.id}` },
    twitter: { card: "summary_large_image", title: event.title, description },
  };
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "teams", label: "Teams" },
  { key: "updates", label: "Updates" },
] as const;

export default async function EventPage({ params, searchParams }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "overview";

  const [event, user] = await Promise.all([getEventWithOrg(id), getCurrentUser()]);
  if (!event) notFound();
  const admin = user ? await isOrgAdmin(user.id, event.orgId) : false;
  if (event.status === "draft" && !admin) notFound();

  if (!admin) {
    after(() =>
      db
        .update(schema.events)
        .set({ viewCount: sql`${schema.events.viewCount} + 1` })
        .where(eq(schema.events.id, event.id)),
    );
  }

  const [registration, saved, membership, [stats]] = await Promise.all([
    user
      ? db.query.registrations.findFirst({
          where: and(eq(schema.registrations.eventId, event.id), eq(schema.registrations.userId, user.id)),
        })
      : undefined,
    user
      ? db.query.savedEvents.findFirst({
          where: and(eq(schema.savedEvents.eventId, event.id), eq(schema.savedEvents.userId, user.id)),
        })
      : undefined,
    user
      ? db.query.teamMembers.findFirst({
          where: and(eq(schema.teamMembers.eventId, event.id), eq(schema.teamMembers.userId, user.id)),
          with: { team: { columns: { id: true, name: true, leaderId: true } } },
        })
      : undefined,
    db
      .select({
        registrations: sql<number>`(select count(*)::int from registrations where event_id = ${event.id})`,
        teams: sql<number>`(select count(*)::int from teams where event_id = ${event.id})`,
        openRoles: sql<number>`(select coalesce(sum(v.slots_open), 0)::int from vacancies v join teams t on t.id = v.team_id where t.event_id = ${event.id} and v.status = 'open')`,
      })
      .from(sql`(select 1) as _`),
  ]);

  const now = new Date();
  const check = user ? registrationCheck(event, user, now) : null;
  const closed = now > event.regDeadline || !event.registrationsOpen || event.status !== "published";
  const isTeamEvent = event.teamMax > 1;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        {event.status !== "published" && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            This event is <strong>{event.status}</strong>
            {event.status === "draft" ? " — only organizers can see it." : "."}
          </p>
        )}

        <header className="flex flex-col gap-4 sm:flex-row">
          {event.posterUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded poster
            <img src={event.posterUrl} alt={`${event.title} poster`} className="w-full rounded-xl border object-cover sm:w-48" />
          )}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              <Badge>{EVENT_TYPE_LABEL[event.type]}</Badge>
              <Badge variant="secondary">{MODE_LABEL[event.mode]}</Badge>
              {event.beginnerFriendly && <Badge variant="secondary">Beginner-friendly</Badge>}
              {event.domainTags.map((d) => (
                <Badge key={d} variant="outline">
                  {domainLabel(d)}
                </Badge>
              ))}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{event.title}</h1>
            <Link href={`/orgs/${event.org.slug}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
              {event.org.name}
              {event.org.verified && <BadgeCheck className="size-4 text-primary" aria-label="Verified" />}
              {event.org.college && <span>· {event.org.college.name}</span>}
            </Link>
          </div>
        </header>

        <dl className="grid gap-3 rounded-xl border p-4 text-sm sm:grid-cols-2">
          <Fact icon={CalendarDays} label="When">
            {formatDateTime(event.startsAt)} – {formatDateTime(event.endsAt)}
          </Fact>
          <Fact icon={Clock} label="Register by">
            {formatDateTime(event.regDeadline)}{" "}
            <span className={cn("text-muted-foreground", !closed && event.regDeadline.getTime() - now.getTime() < 48 * 3600e3 && "text-destructive")}>
              ({relative(event.regDeadline, now)})
            </span>
          </Fact>
          <Fact icon={MapPin} label="Where">
            {event.mode === "online" ? "Online" : event.venue}
            {event.mode === "hybrid" && " / online"}
          </Fact>
          <Fact icon={Users} label="Team size">
            {isTeamEvent ? `${event.teamMin}–${event.teamMax} members` : "Solo"} · {SCOPE_LABEL[event.eligibilityScope]}
            {isTeamEvent && (event.allowCrossCollege ? " · cross-college OK" : " · same-college teams")}
          </Fact>
          <Fact icon={IndianRupee} label="Fee">
            {event.isFree ? "Free" : event.feeText}
          </Fact>
          {event.prizeText && (
            <Fact icon={Trophy} label="Prizes">
              {event.prizeText}
            </Fact>
          )}
        </dl>

        <nav className="flex gap-1 border-b" aria-label="Event sections">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === "overview" ? `/events/${event.id}` : `/events/${event.id}?tab=${t.key}`}
              scroll={false}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm",
                tab === t.key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              aria-current={tab === t.key ? "page" : undefined}
            >
              {t.label}
              {t.key === "teams" && stats.openRoles > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 text-xs text-primary">{stats.openRoles} open</span>
              )}
            </Link>
          ))}
        </nav>

        {tab === "overview" && (
          <div className="flex flex-col gap-6">
            <p className="text-sm leading-relaxed whitespace-pre-line">{event.description}</p>
            {event.rulesMd && (
              <div className="prose-sm max-w-none rounded-xl border p-4 text-sm [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:my-2">
                <ReactMarkdown>{event.rulesMd}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
        {tab === "teams" &&
          (isTeamEvent ? (
            <TeamsTab event={event} user={user} filters={sp} />
          ) : (
            <EmptyState title="Solo event" description="Everyone participates individually — no teams needed." />
          ))}
        {tab === "updates" && <UpdatesTab eventId={event.id} />}
      </div>

      <aside className="flex w-full flex-col gap-3 lg:sticky lg:top-20 lg:w-80">
        <RegisterPanel
          eventId={event.id}
          signedIn={Boolean(user)}
          isTeamEvent={isTeamEvent}
          registered={Boolean(registration)}
          checkinCode={registration?.checkinCode ?? null}
          checkedIn={registration?.status === "checked_in"}
          team={membership ? { id: membership.team.id, name: membership.team.name, isLeader: membership.team.leaderId === user?.id } : null}
          blockedReason={closed ? (check && !check.ok ? check.reason : "Registrations are closed.") : check && !check.ok ? check.reason : null}
          externalUrl={event.externalUrl}
          started={now >= event.startsAt}
        />
        <div className="flex gap-2">
          {user && <SaveEventButton eventId={event.id} initialSaved={Boolean(saved)} />}
          <Button
            variant="outline"
            className="flex-1"
            render={<a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer" />}
          >
            Add to Google Calendar
          </Button>
        </div>
        <p className="px-1 text-xs text-muted-foreground">
          {stats.registrations} registered · {stats.teams} teams
        </p>
        {admin && (
          <Button variant="secondary" render={<Link href={`/events/${event.id}/manage`} />}>
            <Settings /> Manage event
          </Button>
        )}
      </aside>
    </div>
  );
}

function Fact({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}

async function UpdatesTab({ eventId }: { eventId: string }) {
  const rows = await db.query.announcements.findMany({
    where: eq(schema.announcements.eventId, eventId),
    orderBy: desc(schema.announcements.createdAt),
  });
  if (rows.length === 0) {
    return <EmptyState title="No updates yet" description="Organizer announcements will show up here and in your notifications." />;
  }
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((a) => (
        <li key={a.id} className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</p>
          <p className="mt-1 text-sm whitespace-pre-line">{a.body}</p>
        </li>
      ))}
    </ul>
  );
}
