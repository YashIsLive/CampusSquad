import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, TabNav } from "@/components/nav-bits";
import { PageTour } from "@/components/guide/page-tour";
import { notFound } from "next/navigation";
import { asc, desc, eq, sql } from "drizzle-orm";
import { Download, Pencil } from "lucide-react";
import { db, schema } from "@/db";
import { isOrgAdmin, requireUser } from "@/lib/auth";
import { getEventWithOrg } from "@/lib/queries";
import { formatDateTime, relative, siteUrl } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { AnnouncementComposer } from "./announcement-composer";
import { CheckInPanel } from "./check-in-panel";
import { FinalizeAttendanceButton, NudgeSoloButton } from "./organizer-actions";
import { ShareKit } from "./share-kit";
import { StatusControls } from "./status-controls";

export const metadata: Metadata = { title: "Manage event" };

const SECTIONS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "registrants", label: "People" },
  { key: "share", label: "Share kit" },
  { key: "checkin", label: "Check-in" },
] as const;

export default async function ManageEventPage({ params, searchParams }: PageProps<"/events/[id]/manage">) {
  const { id } = await params;
  const sp = await searchParams;
  const section = SECTIONS.find((s) => s.key === sp.section)?.key ?? "dashboard";
  const user = await requireUser({ next: `/events/${id}/manage` });
  const event = await getEventWithOrg(id);
  if (!event || !(await isOrgAdmin(user.id, event.orgId))) notFound();

  const [registrants, shareLinks] = await Promise.all([
    db.query.registrations.findMany({
      where: eq(schema.registrations.eventId, event.id),
      with: {
        user: { with: { college: true } },
        team: { columns: { id: true, name: true } },
        shareLink: { columns: { channelLabel: true } },
      },
      orderBy: desc(schema.registrations.createdAt),
    }),
    db.query.shareLinks.findMany({ where: eq(schema.shareLinks.eventId, event.id), orderBy: asc(schema.shareLinks.createdAt) }),
  ]);
  const [teamStats] = await db
    .select({
      teams: sql<number>`count(*)::int`,
      incomplete: sql<number>`count(*) filter (where (select count(*) from team_members m where m.team_id = teams.id) < ${event.teamMin})::int`,
    })
    .from(schema.teams)
    .where(eq(schema.teams.eventId, event.id));

  const total = registrants.length;
  const inTeams = registrants.filter((r) => r.teamId).length;
  const solo = total - inTeams;
  const checkedIn = registrants.filter((r) => r.status === "checked_in").length;
  const isTeamEvent = event.teamMax > 1;

  const byLink = new Map<string, number>();
  for (const r of registrants) {
    const k = r.shareLink?.channelLabel ?? "Direct / Got Next feed";
    byLink.set(k, (byLink.get(k) ?? 0) + 1);
  }
  const byCollege = new Map<string, number>();
  for (const r of registrants) {
    const k = r.user.college?.name ?? "No college";
    byCollege.set(k, (byCollege.get(k) ?? 0) + 1);
  }

  const funnel = [
    { label: "Page views", value: event.viewCount },
    { label: "Registrations", value: total },
    ...(isTeamEvent ? [{ label: "In a team", value: inTeams }] : []),
    { label: "Checked in", value: checkedIn },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 motion-safe:animate-page-in sm:py-8">
      <PageTour tour="manage" seen={Boolean(user.guide.tours?.manage)} />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Breadcrumbs
            items={[
              { href: "/me/events", label: "My events" },
              { href: `/events/${event.id}`, label: event.title },
              { label: "Manage" },
            ]}
          />
          <h1 className="text-4xl leading-[0.95] font-black sm:text-5xl">{event.title}</h1>
          <p className="text-sm text-muted-foreground">
            {event.org.name} · registration closes {formatDateTime(event.regDeadline)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" render={<Link href={`/events/${event.id}/edit`} />}>
            <Pencil /> Edit
          </Button>
          <StatusControls eventId={event.id} status={event.status} registrationsOpen={event.registrationsOpen} />
        </div>
      </header>

      <TabNav
        tourId="manage-tabs"
        label="Manage sections"
        id="manage"
        tabs={SECTIONS.map((s) => ({
          href: `/events/${event.id}/manage${s.key === "dashboard" ? "" : `?section=${s.key}`}`,
          label: s.label,
          active: section === s.key,
        }))}
      />

      {section === "dashboard" && (
        <div className="flex flex-col gap-6">
          <div data-tour="stats" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Views" value={event.viewCount} />
            <Stat label="Registrations" value={total} />
            {isTeamEvent ? (
              <>
                <Stat label="Teams formed" value={teamStats?.teams ?? 0} hint={teamStats?.incomplete ? `${teamStats.incomplete} below min size` : undefined} />
                <Stat label="Without a team" value={solo}>
                  {event.endsAt > new Date() && (
                    <NudgeSoloButton eventId={event.id} solo={solo} nudgedAt={event.soloNudgedAt ? relative(event.soloNudgedAt) : null} />
                  )}
                </Stat>
              </>
            ) : (
              <Stat label="Checked in" value={checkedIn} />
            )}
          </div>

          <section className="rounded-xl border border-rule bg-card p-4">
            <h2 className="mb-3 text-xl font-bold">Funnel</h2>
            <ol className="flex flex-col gap-2">
              {funnel.map((f) => {
                const max = Math.max(1, funnel[0].value, ...funnel.map((x) => x.value));
                return (
                  <li key={f.label} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{f.label}</span>
                    <span className="h-3 rounded-full bg-muted">
                      <span className="block h-3 rounded-full bg-ink" style={{ width: `${(f.value / max) * 100}%` }} />
                    </span>
                    <span className="text-right tabular-nums">{f.value}</span>
                  </li>
                );
              })}
            </ol>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <Breakdown title="Registrations by channel" rows={[...byLink.entries()]} total={total} />
            <Breakdown title="Registrations by college" rows={[...byCollege.entries()]} total={total} />
          </div>

          <AnnouncementComposer eventId={event.id} registrantCount={total} />
        </div>
      )}

      {section === "registrants" && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{total} registrants</p>
            <Button size="sm" variant="outline" render={<a href={`/events/${event.id}/manage/export`} download />}>
              <Download /> Export CSV
            </Button>
          </div>
          {total === 0 ? (
            <EmptyState title="No registrations yet" description="Share your event from the Share kit tab." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-rule bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">College</th>
                    {isTeamEvent && <th className="px-3 py-2 font-medium">Team</th>}
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {registrants.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2">
                        <Link href={`/u/${r.user.username}`} className="font-medium hover:underline">
                          {r.user.name}
                        </Link>
                        <span className="block text-xs text-muted-foreground">{r.user.email}</span>
                      </td>
                      <td className="px-3 py-2">{r.user.college?.name ?? "—"}</td>
                      {isTeamEvent && <td className="px-3 py-2">{r.team?.name ?? <span className="text-muted-foreground">solo</span>}</td>}
                      <td className="px-3 py-2 text-muted-foreground">{r.shareLink?.channelLabel ?? "direct"}</td>
                      <td className="px-3 py-2">
                        <Badge variant={r.status === "checked_in" ? "default" : "secondary"}>{r.status.replace("_", " ")}</Badge>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDateTime(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {section === "share" && (
        <ShareKit
          event={{ id: event.id, title: event.title, orgName: event.org.name, startsAt: formatDateTime(event.startsAt), regDeadline: formatDateTime(event.regDeadline), venue: event.mode === "online" ? "Online" : (event.venue ?? "") }}
          siteUrl={siteUrl()}
          links={shareLinks.map((l) => ({
            id: l.id,
            label: l.channelLabel,
            code: l.shortCode,
            clicks: l.clicks,
            registrations: registrants.filter((r) => r.shareLinkId === l.id).length,
          }))}
        />
      )}

      {section === "checkin" && (
        <div className="flex flex-col gap-6">
          <CheckInPanel eventId={event.id} checkedIn={checkedIn} total={total} />
          <FinalizeAttendanceButton
            eventId={event.id}
            started={event.startsAt <= new Date()}
            finalizedAt={event.attendanceFinalizedAt ? formatDateTime(event.attendanceFinalizedAt) : null}
            pendingCount={registrants.filter((r) => r.status === "registered").length}
          />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint, children }: { label: string; value: number; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-rule bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="score mt-1 text-5xl">{value}</p>
      {hint && <p className="text-xs text-signal-ink">{hint}</p>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

function Breakdown({ title, rows, total }: { title: string; rows: Array<[string, number]>; total: number }) {
  const sorted = rows.sort((a, b) => b[1] - a[1]);
  return (
    <section className="rounded-xl border border-rule bg-card p-4">
      <h2 className="mb-3 text-xl font-bold">{title}</h2>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {sorted.map(([label, n]) => (
            <li key={label} className="flex flex-col gap-1">
              <div className="flex justify-between gap-2">
                <span className="truncate">{label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {n} · {Math.round((n / Math.max(1, total)) * 100)}%
                </span>
              </div>
              <span className="h-1.5 rounded-full bg-muted">
                <span className="block h-1.5 rounded-full bg-ink/70" style={{ width: `${(n / Math.max(1, total)) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
