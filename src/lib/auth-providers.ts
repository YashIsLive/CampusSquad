import "server-only";

/**
 * Asks Supabase which sign-in providers are enabled, so the login page only shows working
 * options (Google needs an OAuth client configured in the Supabase dashboard).
 * Cached for 5 minutes; on failure we assume Google is enabled and let Supabase report errors.
 */
export async function isGoogleEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      next: { revalidate: 300 },
    });
    if (!res.ok) return true;
    const json = (await res.json()) as { external?: { google?: boolean } };
    return json.external?.google ?? true;
  } catch {
    return true;
  }
}
