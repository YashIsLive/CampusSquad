import Link from "next/link";
import { after } from "next/server";
import { and, count, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CurrentUser } from "@/lib/auth";
import { runReminders } from "@/lib/reminders";
import { reviewableColleges } from "@/lib/verification";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/brand";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { NavLinks } from "@/components/layout/nav-links";
import { GuideMenu } from "@/components/guide/guide-menu";

export async function SiteHeader({ user }: { user: CurrentUser | null }) {
  let unread = 0;
  let reviewer = false;
  if (user) {
    // Lazily create this user's due reminders (deadline + event start). Idempotent and cheap.
    after(() => runReminders({ userId: user.id }).catch((e) => console.error("reminders", e)));
    const [row] = await db
      .select({ n: count() })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)));
    unread = row?.n ?? 0;
    const colleges = await reviewableColleges(user);
    reviewer = colleges === "all" || colleges.length > 0;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/95 backdrop-blur-sm" style={{ viewTransitionName: "site-header" }}>
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="shrink-0 rounded-md" aria-label="Got Next home">
          <Wordmark />
        </Link>
        {user && <NavLinks />}
        <div className="ml-auto flex items-center gap-1.5">
          {user ? (
            <>
              <Button render={<Link href="/events/new" />} size="sm" className="hidden sm:inline-flex">
                Post an event
              </Button>
              <GuideMenu />
              <NotificationBell userId={user.id} initialUnread={unread} />
              <UserMenu
                user={{ name: user.name, username: user.username, avatarUrl: user.avatarUrl, isAdmin: user.isAdmin, verified: user.collegeVerified, reviewer }}
              />
            </>
          ) : (
            <Button render={<Link href="/login" />} size="sm">
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
