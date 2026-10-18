import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { relative } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { InviteResponse, WithdrawButton } from "./controls";

export const metadata: Metadata = { title: "Teams & applications" };

const STATUS_VARIANT = {
  pending: "secondary",
  shortlisted: "default",
  accepted: "default",
  rejected: "outline",
  withdrawn: "outline",
} as const;

export default async function MyApplicationsPage() {
  const user = await requireUser({ next: "/me/applications" });

  const [memberships, applications, invites] = await Promise.all([
    db.query.teamMembers.findMany({
      where: eq(schema.teamMembers.userId, user.id),
      with: { team: { with: { event: { columns: { id: true, title: true, endsAt: true, teamMin: true, teamMax: true } }, members: { columns: { userId: true } } } } },
      orderBy: desc(schema.teamMembers.joinedAt),
    }),
    db.query.applications.findMany({
      where: eq(schema.applications.applicantId, user.id),
      with: { vacancy: { with: { team: { with: { event: { columns: { id: true, title: true } } } } } } },
      orderBy: desc(schema.applications.createdAt),
    }),
    db.query.invites.findMany({
      where: eq(schema.invites.userId, user.id),
      with: { team: { with: { event: { columns: { id: true, title: true } } } } },
      orderBy: desc(schema.invites.createdAt),
    }),
  ]);

  const pendingInvites = invites.filter((i) => i.status === "pending");

  const appIds = applications.map((a) => a.id);
  const [threadCounts, unread] = await Promise.all([
    appIds.length
      ? db
          .select({ applicationId: schema.applicationMessages.applicationId, total: sql<number>`count(*)::int` })
          .from(schema.applicationMessages)
          .where(inArray(schema.applicationMessages.applicationId, appIds))
          .groupBy(schema.applicationMessages.applicationId)
      : [],
    db
      .select({ href: sql<string>`${schema.notifications.payload}->>'href'` })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, user.id), eq(schema.notifications.type, "application_message"), isNull(schema.notifications.readAt))),
  ]);
  const countBy = new Map(threadCounts.map((t) => [t.applicationId, t.total]));
  const unreadHrefs = new Set(unread.map((u) => u.href));
  const now = new Date();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 sm:py-10">
      {/* Applicants see accept/reject the moment the leader decides. */}
      <RealtimeRefresh channel={`my-apps:${user.id}`} table="applications" filter={`applicant_id=eq.${user.id}`} events="UPDATE" />
      <RealtimeRefresh channel={`my-app-notes:${user.id}`} table="notifications" filter={`user_id=eq.${user.id}`} />
      <h1 className="text-3xl font-extrabold sm:text-4xl">Teams & applications</h1>

      {pendingInvites.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Invites</h2>
          <ul className="flex flex-col gap-2">
            {pendingInvites.map((i) => (
              <li key={i.id} className="flex flex-col gap-2 rounded-lg border border-ink bg-signal-soft/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">
                    <Link href={`/teams/${i.teamId}`} className="hover:underline">
                      {i.team.name}
                    </Link>{" "}
                    invited you
                  </p>
                  <p className="text-sm text-muted-foreground">{i.team.event.title}</p>
                  {i.message && <p className="mt-1 text-sm">“{i.message}”</p>}
                </div>
                <InviteResponse inviteId={i.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xl font-bold">My teams</h2>
        {memberships.length === 0 ? (
          <EmptyState compact title="You're not on any team yet" action={<Button render={<Link href="/" />}>Find an event</Button>} />
        ) : (
          <ul className="flex flex-col gap-2">
            {memberships.map((m) => {
              const size = m.team.members.length;
              return (
                <li key={m.teamId}>
                  <Link href={`/teams/${m.teamId}`} className="flex items-center justify-between gap-2 rounded-lg border border-rule bg-card p-4 hover:bg-muted/50">
                    <div>
                      <p className="font-medium">
                        {m.team.name} {m.team.leaderId === user.id && <Badge variant="secondary">Leader</Badge>}
                      </p>
                      <p className="text-sm text-muted-foreground">{m.team.event.title}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {size}/{m.team.event.teamMax} members
                      {size < m.team.event.teamMin && <span className="block text-destructive">below minimum</span>}
                      {m.team.event.endsAt < now && <span className="block">event over</span>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">My applications</h2>
        {applications.length === 0 ? (
          <EmptyState compact title="No applications yet" description="Open any team event and check the Teams tab for open roles." />
        ) : (
          <ul className="flex flex-col gap-2">
            {applications.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 rounded-lg border border-rule bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">
                    {a.vacancy.roleTitle} <span className="font-normal text-muted-foreground">at {a.vacancy.team.name}</span>
                  </p>
                  <Link href={`/events/${a.vacancy.team.event.id}?tab=teams`} className="text-sm text-muted-foreground hover:underline">
                    {a.vacancy.team.event.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {a.matchScore}% match · applied {relative(a.createdAt, now)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {a.status !== "withdrawn" && (
                    <Button
                      size="sm"
                      variant={unreadHrefs.has(`/applications/${a.id}`) ? "default" : "outline"}
                      render={<Link href={`/applications/${a.id}`} />}
                    >
                      <MessageSquare />
                      {unreadHrefs.has(`/applications/${a.id}`)
                        ? "New message"
                        : countBy.get(a.id)
                          ? `Messages (${countBy.get(a.id)})`
                          : "Message leader"}
                    </Button>
                  )}
                  <Badge variant={STATUS_VARIANT[a.status]} className="capitalize">
                    {a.status}
                  </Badge>
                  {a.status === "accepted" && (
                    <Button size="sm" render={<Link href={`/teams/${a.vacancy.teamId}`} />}>
                      Open team
                    </Button>
                  )}
                  {["pending", "shortlisted"].includes(a.status) && <WithdrawButton applicationId={a.id} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
