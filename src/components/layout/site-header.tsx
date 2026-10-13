import Link from "next/link";
import { and, count, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";

const NAV = [
  { href: "/", label: "Events" },
  { href: "/me/events", label: "My events" },
  { href: "/me/applications", label: "Teams & applications" },
];

export async function SiteHeader({ user }: { user: CurrentUser | null }) {
  let unread = 0;
  if (user) {
    const [row] = await db
      .select({ n: count() })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)));
    unread = row?.n ?? 0;
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
            CS
          </span>
          <span className="hidden sm:inline">CampusSquad</span>
        </Link>
        {user && (
          <nav className="hidden items-center gap-1 text-sm sm:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Button render={<Link href="/events/new" />} size="sm" className="hidden sm:inline-flex">
                Post event
              </Button>
              <NotificationBell userId={user.id} initialUnread={unread} />
              <UserMenu user={{ name: user.name, username: user.username, avatarUrl: user.avatarUrl }} />
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
