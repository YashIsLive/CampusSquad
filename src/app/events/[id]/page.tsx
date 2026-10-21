import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import ReactMarkdown from "react-markdown";
import { BadgeCheck, CalendarDays, CalendarPlus, Clock, IndianRupee, MapPin, Settings, Trophy, Users } from "lucide-react";
import { ViewTransition } from "react";
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
import { ReportButton } from "@/components/report-button";
import { EmptyState } from "@/components/empty-state";
import { posterVT, titleVT } from "@/components/event-card";
import { Breadcrumbs, TabNav } from "@/components/nav-bits";
import { PageTour } from "@/components/guide/page-tour";
import { cn } from "@/lib/utils";
import { RegisterPanel } from "./register-panel";
import { SaveEventButton } from "./save-button";
import { TeamsTab } from "./teams-tab";
import { TeamsPreview } from "./teams-preview";
import { KitTile } from "@/components/event-kit";

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

const fixtureDate = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" });

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
        updates: sql<number>`(select count(*)::int from announcements where event_id = ${event.id})`,
      })
      .from(sql`(select 1) as _`),
  ]);

  const now = new Date();
  const check = user ? registrationCheck(event, user, now) : null;
  const closed = now > event.regDeadline || !event.registrationsOpen || event.status !== "published";
  const isTeamEvent = event.teamMax > 1;

  const closingSoon = !closed && event.regDeadline.getTime() - now.getTime() < 48 * 3600e3;
  const tabHref = (key: string) => (key === "overview" ? `/events/${event.id}` : `/events/${event.id}?tab=${key}`);

  return (
    <>
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 motion-safe:animate-page-in sm:py-8">
      {user?.onboardedAt && <PageTour tour="event" seen={Boolean(user.guide.tours?.event)} />}
      <Breadcrumbs
        items={[
          { href: "/", label: "Explore" },
          { href: `/orgs/${event.org.slug}`, label: event.org.name },
          { label: event.title },
        ]}
      />

      {event.status !== "published" && (
        <p role="status" className="rounded-md border border-ink/30 bg-marker/40 px-3 py-2 text-sm">
          This event is <strong>{event.status}</strong>
          {event.status === "draft" ? " — only organizers can see it." : "."}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <header className="flex flex-col gap-5" style={{ "--type": `var(--type-${event.type})` } as React.CSSProperties}>
            <div className="flex gap-5">
              <KitTile type={event.type} date={event.startsAt} size="lg" className="hidden w-28 shrink-0 rounded-2xl border border-ink sm:flex" />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <p className="label-mono flex items-center gap-2">
                  <span aria-hidden="true" className="size-2.5 rounded-full bg-(--type)" />
                  {fixtureDate.format(event.startsAt)} · {EVENT_TYPE_LABEL[event.type]}
                </p>
                <h1 className="text-4xl leading-[0.98] font-black sm:text-[3.4rem]">
                  <ViewTransition name={titleVT(event.id)} share="morph" default="none">
                    <span>{event.title}</span>
                  </ViewTransition>
                </h1>
                <Link
                  href={`/orgs/${event.org.slug}`}
                  className="flex w-fit items-center gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  by <span className="font-semibold text-foreground underline decoration-court decoration-2 underline-offset-4">{event.org.name}</span>
                  {event.org.verified && <BadgeCheck className="size-4 text-ok" role="img" aria-label="Verified organization" />}
                  {event.org.college && <span className="hidden sm:inline">· {event.org.college.name}</span>}
                </Link>
                {event.domainTags.length > 0 && (
                  <ul aria-label="Topics" className="flex flex-wrap gap-1.5">
                    {event.domainTags.map((d) => (
                      <li key={d}>
                        <Badge variant="outline">{domainLabel(d)}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {event.posterUrl && (
                <ViewTransition name={posterVT(event.id)} share="morph" default="none">
                  {/* eslint-disable-next-line @next/next/no-img-element -- organizer-uploaded poster of any size */}
                  <img
                    src={event.posterUrl}
                    alt={`Poster for ${event.title}`}
                    className="hidden aspect-[4/5] w-40 shrink-0 rounded-xl border border-rule object-cover sm:block"
                  />
                </ViewTransition>
              )}
            </div>

            {/* Scoreboard: the three numbers people actually decide on. */}
            <dl className="grid grid-cols-3 overflow-hidden rounded-xl border border-ink">
              <div className={cn("flex flex-col gap-1 p-3 sm:p-4", closingSoon && "bg-signal-soft")}>
                <dt className="text-xs text-muted-foreground">{closed ? "Sign-ups" : "Sign-ups close"}</dt>
                <dd className={cn("score text-2xl sm:text-3xl", closingSoon && "text-signal-ink")}>{closed ? "Closed" : relative(event.regDeadline, now)}</dd>
              </div>
              <div className="flex flex-col gap-1 border-l border-ink p-3 sm:p-4">
                <dt className="text-xs text-muted-foreground">Going</dt>
                <dd className="score text-2xl sm:text-3xl">{stats.registrations}</dd>
              </div>
              <div className={cn("flex flex-col gap-1 border-l border-ink p-3 sm:p-4", isTeamEvent && stats.openRoles > 0 && "bg-court text-[#0f0f0e]")}>
                <dt className={cn("text-xs", isTeamEvent && stats.openRoles > 0 ? "text-[#0f0f0e]/70" : "text-muted-foreground")}>
                  {isTeamEvent ? "Open team spots" : "Format"}
                </dt>
                <dd className="score text-2xl sm:text-3xl">{isTeamEvent ? stats.openRoles : "Solo"}</dd>
              </div>
            </dl>
          </header>

          <dl data-tour="facts" className="grid overflow-hidden rounded-xl border border-rule bg-card sm:grid-cols-2">
            <Fact icon={CalendarDays} label="When">
              {formatDateTime(event.startsAt)} → {formatDateTime(event.endsAt)}
            </Fact>
            <Fact icon={Clock} label="Register by">
              {formatDateTime(event.regDeadline)}
            </Fact>
            <Fact icon={MapPin} label="Where">
              {event.mode === "online" ? "Online" : event.venue}
              {event.mode === "hybrid" && " + online"}
              {event.mode !== "online" && event.city && <span className="text-muted-foreground"> · {event.city}</span>}
            </Fact>
            <Fact icon={Users} label="Who">
              {isTeamEvent ? `Teams of ${event.teamMin}–${event.teamMax}` : "On your own"} · {SCOPE_LABEL[event.eligibilityScope]}
              {isTeamEvent && <span className="text-muted-foreground">{event.allowCrossCollege ? " · teams can mix colleges" : " · team must be from one college"}</span>}
            </Fact>
            <Fact icon={IndianRupee} label="Fee">
              {event.isFree ? "Free" : event.feeText}
              {event.beginnerFriendly && <span className="text-muted-foreground"> · good for beginners</span>}
            </Fact>
            {event.prizeText && (
              <Fact icon={Trophy} label="Prizes">
                {event.prizeText}
              </Fact>
            )}
          </dl>

          <TabNav
            tourId="event-tabs"
            label="Event sections"
            id="event"
            tabs={TABS.map((t) => ({
              href: tabHref(t.key),
              label: t.label,
              active: tab === t.key,
              badge:
                t.key === "teams" && stats.openRoles > 0 ? (
                  <span className="rounded-full bg-court px-2 text-xs font-semibold text-[#0f0f0e]">{stats.openRoles} open</span>
                ) : t.key === "updates" && stats.updates > 0 ? (
                  <span className="rounded-full bg-secondary px-2 text-xs font-semibold">{stats.updates}</span>
                ) : undefined,
            }))}
          />

          <div key={tab} className="motion-safe:animate-rise">
            {tab === "overview" && (
              <div className="flex flex-col gap-6">
                <p className="max-w-[68ch] text-[0.975rem] leading-relaxed whitespace-pre-line">{event.description}</p>
                {isTeamEvent && !closed && <TeamsPreview eventId={event.id} teamMax={event.teamMax} />}
                {event.rulesMd && (
                  <section aria-labelledby="rules" className="rounded-xl border border-rule bg-card p-5">
                    <h2 id="rules" className="mb-2 text-lg font-bold">
                      Rules and details
                    </h2>
                    <div className="max-w-[68ch] text-sm leading-relaxed [&_h1]:font-display [&_h1]:text-lg [&_h1]:font-bold [&_h2]:font-display [&_h2]:text-base [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_li]:py-0.5 [&_p]:my-2">
                      <ReactMarkdown>{event.rulesMd}</ReactMarkdown>
                    </div>
                  </section>
                )}
              </div>
            )}
            {tab === "teams" &&
              (isTeamEvent ? (
                <TeamsTab event={event} user={user} filters={sp} />
              ) : (
                <EmptyState art="ticket" title="No teams for this one" description="Everyone takes part on their own." />
              ))}
            {tab === "updates" && <UpdatesTab eventId={event.id} />}
          </div>
        </div>

        <aside aria-label="Registration" data-tour="ticket" className="flex flex-col gap-3 lg:sticky lg:top-20">
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
            stub={{
              date: formatDateTime(event.startsAt),
              who: isTeamEvent ? `Teams of ${event.teamMin}–${event.teamMax}` : "Just you",
              registered: stats.registrations,
              teams: stats.teams,
            }}
          />
          <div className="flex gap-2">
            {user && <SaveEventButton eventId={event.id} initialSaved={Boolean(saved)} />}
            <Button variant="outline" className="flex-1" data-tour="calendar" render={<a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer" />}>
              <CalendarPlus /> Add to calendar
            </Button>
          </div>
          {admin && (
            <Button variant="ink" render={<Link href={`/events/${event.id}/manage`} />}>
              <Settings /> Manage event
            </Button>
          )}
          {user && !admin && <ReportButton targetType="event" targetId={event.id} what="this event" className="self-start text-muted-foreground" />}
        </aside>
      </div>
    </div>

      {/* Below lg the ticket sits under the content, so keep the next step one tap away.
          Kept outside the animated container: a transform there would anchor `fixed` to it. */}
      <div
        className={cn(
          "fixed inset-x-0 z-30 flex items-center justify-between gap-3 border-t border-rule bg-paper/95 px-4 py-2.5 backdrop-blur-sm lg:hidden",
          user ? "bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:bottom-0" : "bottom-0 pb-[calc(0.625rem+env(safe-area-inset-bottom))]",
        )}
      >
        <p className="min-w-0 truncate text-sm font-medium">
          {registration ? (
            <span className="text-ok">You&apos;re in</span>
          ) : closed ? (
            <span className="text-muted-foreground">Sign-ups closed</span>
          ) : (
            <span className={closingSoon ? "font-semibold text-signal-ink" : ""}>Closes {relative(event.regDeadline, now)}</span>
          )}
        </p>
        <Button size="sm" variant={registration || closed ? "outline" : "default"} render={<a href="#ticket-heading" />}>
          {registration ? "Your pass" : closed ? "Details" : "Register"}
        </Button>
      </div>
      <div aria-hidden="true" className="h-14 lg:hidden" />
    </>
  );
}

function Fact({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-rule p-4 sm:border-r sm:even:border-r-0">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="label-mono text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-sm">{children}</dd>
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
        <li key={a.id} className="rounded-xl border border-rule bg-card p-4">
          <p className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</p>
          <p className="mt-1 text-sm whitespace-pre-line">{a.body}</p>
        </li>
      ))}
    </ul>
  );
}
