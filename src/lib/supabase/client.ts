"use client";
import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | undefined;

/** Browser Supabase client — used only for Realtime subscriptions and Storage uploads. */
export function getSupabaseBrowserClient() {
  client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}

type Channel = ReturnType<ReturnType<typeof createBrowserClient>["channel"]>;

/**
 * Subscribe to a Realtime channel *as the signed-in user*. The session is read from cookies
 * asynchronously; joining before it's loaded would join as anonymous and RLS would filter out
 * every row. So: load the session, hand its token to Realtime, then build + subscribe.
 * Returns a cleanup function that is safe to call before the subscription exists.
 */
export function subscribeAsUser(build: (supabase: ReturnType<typeof getSupabaseBrowserClient>) => Channel) {
  const supabase = getSupabaseBrowserClient();
  let channel: Channel | null = null;
  let cancelled = false;
  void (async () => {
    const { data } = await supabase.auth.getSession();
    if (cancelled) return;
    if (data.session) await supabase.realtime.setAuth(data.session.access_token);
    if (cancelled) return;
    channel = build(supabase).subscribe();
  })();
  return () => {
    cancelled = true;
    if (channel) void supabase.removeChannel(channel);
  };
}
