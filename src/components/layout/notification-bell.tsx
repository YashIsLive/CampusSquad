"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { subscribeAsUser } from "@/lib/supabase/client";

type NotificationRow = { id: string; payload: { title: string; body?: string; href?: string } };

/** Unread badge that updates live via Supabase Realtime (RLS limits rows to the current user). */
export function NotificationBell({ userId, initialUnread }: { userId: string; initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread);
  const [prevInitial, setPrevInitial] = useState(initialUnread);
  const router = useRouter();

  // Re-sync with the server count after navigations/refreshes.
  if (prevInitial !== initialUnread) {
    setPrevInitial(initialUnread);
    setUnread(initialUnread);
  }

  useEffect(() => {
    return subscribeAsUser((supabase) =>
      supabase.channel(`notifications:${userId}`).on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (msg: RealtimePostgresInsertPayload<NotificationRow>) => {
          const n = msg.new;
          setUnread((u) => u + 1);
          const href = n.payload.href;
          toast(n.payload.title, {
            description: n.payload.body,
            action: href ? { label: "Open", onClick: () => router.push(href) } : undefined,
          });
        },
      ),
    );
  }, [userId, router]);

  return (
    <Link
      href="/notifications"
      data-tour="notifications"
      className="relative grid size-10 place-items-center rounded-full hover:bg-secondary sm:size-9"
    >
      <Bell aria-hidden="true" className="size-5" />
      <span className="sr-only">Notifications{unread > 0 ? `, ${unread} unread` : ""}</span>
      {unread > 0 && (
        <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
