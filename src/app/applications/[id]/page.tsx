import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { isUuid } from "@/lib/queries";
import { relative } from "@/lib/format";
import { loadApplicationThread, threadMessages } from "@/lib/threads";
import { Breadcrumbs } from "@/components/nav-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReportButton } from "@/components/report-button";
import { UserAvatar } from "@/components/user-avatar";
import { ApplicationThread } from "./application-thread";

export const metadata: Metadata = { title: "Conversation" };

const STATUS_LABEL = {
  pending: "Waiting for review",
  shortlisted: "Shortlisted",
  accepted: "Accepted",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
} as const;

export default async function ApplicationThreadPage({ params }: PageProps<"/applications/[id]">) {
  const { id } = await params;
  const user = await requireUser({ next: `/applications/${id}` });
  if (!isUuid(id)) notFound();
  const thread = await loadApplicationThread(id, user.id);
  if (!thread) notFound();

  const { application, vacancy, team, event, leader, applicant, isLeader } = thread;
  const other = isLeader ? applicant : leader;

  const [messages] = await Promise.all([
    threadMessages(id),
    // Opening the conversation reads its notifications.
    db
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(schema.notifications.userId, user.id),
          isNull(schema.notifications.readAt),
          sql`${schema.notifications.payload}->>'href' = ${`/applications/${id}`}`,
        ),
      ),
  ]);

  const closed = application.status === "withdrawn" ? "This application was withdrawn, so the conversation is closed." : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6 sm:py-10">
      <header className="flex flex-col gap-2">
        <Breadcrumbs
          items={
            isLeader
              ? [
                  { href: `/teams/${team.id}`, label: team.name },
                  { href: `/teams/${team.id}/applications`, label: "Applications" },
                  { label: applicant.name },
                ]
              : [
                  { href: "/me/applications", label: "My teams" },
                  { label: `${vacancy.roleTitle} at ${team.name}` },
                ]
          }
        />
        <div className="flex items-center gap-3">
          <UserAvatar name={other.name} src={other.avatarUrl} className="size-11" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold">{other.name}</h1>
            <p className="text-sm text-muted-foreground">
              {isLeader ? "Applied for" : "Leader of"}{" "}
              {isLeader ? (
                <strong className="font-medium text-foreground">{vacancy.roleTitle}</strong>
              ) : (
                <Link href={`/teams/${team.id}`} className="font-medium text-foreground hover:underline">
                  {team.name}
                </Link>
              )}{" "}
              · <Link href={`/events/${event.id}?tab=teams`} className="hover:underline">{event.title}</Link>
            </p>
          </div>
          <Badge variant={application.status === "accepted" ? "default" : "secondary"} className="ml-auto shrink-0">
            {STATUS_LABEL[application.status]}
          </Badge>
        </div>
      </header>

      {/* The application itself opens the conversation. */}
      <article className="rounded-xl border border-rule bg-secondary/50 p-4 text-sm">
        <p className="label-mono mb-1 text-muted-foreground">
          {isLeader ? `${applicant.name.split(" ")[0]}'s application` : "Your application"} · {relative(application.createdAt)}
        </p>
        <p className="break-words whitespace-pre-wrap">{application.message}</p>
        {application.screeningAnswer && vacancy.screeningQuestion && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">{vacancy.screeningQuestion}</p>
            <p className="break-words">{application.screeningAnswer}</p>
          </div>
        )}
      </article>

      <ApplicationThread
        applicationId={id}
        me={{ id: user.id, name: user.name, avatarUrl: user.avatarUrl }}
        other={{ id: other.id, name: other.name, avatarUrl: other.avatarUrl }}
        initial={messages.map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt.toISOString(), sender: m.sender }))}
        closed={closed}
      />

      <div className="flex flex-wrap items-center gap-2">
        <ReportButton targetType="conversation" targetId={id} what="this conversation" className="order-last ml-auto text-muted-foreground" />
        {isLeader ? (
          <Button variant="outline" render={<Link href={`/teams/${team.id}/applications`} />}>
            Back to all applications
          </Button>
        ) : application.status === "accepted" ? (
          <Button render={<Link href={`/teams/${team.id}`} />}>Open your team</Button>
        ) : (
          <Button variant="outline" render={<Link href="/me/applications" />}>
            All my applications
          </Button>
        )}
      </div>
    </div>
  );
}
