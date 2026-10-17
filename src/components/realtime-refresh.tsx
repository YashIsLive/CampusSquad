"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { subscribeAsUser } from "@/lib/supabase/client";

/**
 * Re-renders the current server page whenever matching rows change (Supabase Realtime + RLS).
 * Keeps the source of truth on the server: we only use the event as a "something changed" ping.
 */
export function RealtimeRefresh({
  channel,
  table,
  filter,
  events = "*",
}: {
  channel: string;
  table: string;
  filter?: string;
  events?: "*" | "INSERT" | "UPDATE" | "DELETE";
}) {
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeAsUser((supabase) =>
      supabase.channel(channel).on("postgres_changes", { event: events, schema: "public", table, ...(filter ? { filter } : {}) }, () => {
        // Coalesce bursts (an accept touches several rows).
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 250);
      }),
    );
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [channel, table, filter, events, router]);
  return null;
}
