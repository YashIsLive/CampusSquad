import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { AlarmClock, Bell, CalendarClock, CalendarPlus, CheckCircle2, Megaphone, UserPlus, Users, UsersRound, XCircle } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { relative } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { cn } from "@/lib/utils";
import { MarkAllRead } from "./mark-all-read";

export const metadata: Metadata = { title: "Notifications" };

const ICONS = {
  application_new: Users,
  application_accepted: CheckCircle2,
  application_rejected: XCircle,
  vacancy_closed: XCircle,
  team_invite: UserPlus,
  invite_response: UserPlus,
  announcement: Megaphone,
  event_closing: CalendarClock,
  new_event: CalendarPlus,
  team_nudge: UsersRound,
  event_reminder: AlarmClock,
} as const;

export default async function NotificationsPage() {
  const user = await requireUser({ next: "/notifications" });
  const rows = await db.query.notifications.findMany({
    where: eq(schema.notifications.userId, user.id),
    orderBy: desc(schema.notifications.createdAt),
    limit: 100,
  });
  const unread = rows.filter((r) => !r.readAt).length;
  const now = new Date();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6 sm:py-10">
      <RealtimeRefresh channel={`notif-page:${user.id}`} table="notifications" filter={`user_id=eq.${user.id}`} events="INSERT" />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Notifications</h1>
        {unread > 0 && <MarkAllRead />}
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<Bell className="size-6" />} title="All caught up" description="Applications, invites, announcements and deadline reminders show up here." />
      ) : (
        <ul className="flex flex-col divide-y divide-rule rounded-lg border border-rule bg-card">
          {rows.map((n) => {
            const Icon = ICONS[n.type];
            const content = (
              <div className={cn("flex gap-3 px-4 py-3", !n.readAt && "bg-signal-soft/40")}>
                <Icon className={cn("mt-0.5 size-5 shrink-0", !n.readAt ? "text-signal-ink" : "text-muted-foreground")} />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", !n.readAt && "font-medium")}>{n.payload.title}</p>
                  {n.payload.body && <p className="text-sm whitespace-pre-line text-muted-foreground">{n.payload.body}</p>}
                  <p className="mt-0.5 text-xs text-muted-foreground">{relative(n.createdAt, now)}</p>
                </div>
                {!n.readAt && (
                  <>
                    <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-signal" />
                    <span className="sr-only">Unread</span>
                  </>
                )}
              </div>
            );
            return (
              <li key={n.id}>
                {n.payload.href ? (
                  <Link href={n.payload.href} className="block hover:bg-muted/50">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
