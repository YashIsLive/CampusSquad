import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * DEV/TEST ONLY: sign in as a seed user without email. Enabled only when E2E_TEST_LOGIN=1
 * and never in production builds. Only `*.seed.test` accounts can be used.
 *   GET /api/test-login?u=riya&next=/events
 */
export async function GET(request: NextRequest) {
  if (process.env.E2E_TEST_LOGIN !== "1" || process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }
  const url = new URL(request.url);
  const handle = (url.searchParams.get("u") ?? "").toLowerCase();
  const next = url.searchParams.get("next") ?? "/";
  if (!/^[a-z0-9_]+$/.test(handle)) return new NextResponse("Bad user", { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  // Seed emails are <handle>@<college>.seed.test; find the matching account.
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) return new NextResponse(listError.message, { status: 500 });
  const user = list.users.find((u) => u.email?.startsWith(`${handle}@`) && u.email.endsWith(".seed.test"));
  if (!user?.email) return new NextResponse("Unknown seed user", { status: 404 });

  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
  if (error) return new NextResponse(error.message, { status: 500 });

  const supabase = await createSupabaseServerClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.properties.hashed_token,
  });
  if (verifyError) return new NextResponse(verifyError.message, { status: 500 });
  return NextResponse.redirect(new URL(next.startsWith("/") ? next : "/", url.origin));
}
