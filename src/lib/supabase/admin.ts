import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service-role client. Server only — bypasses RLS and can create users. */
export function createSupabaseAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
