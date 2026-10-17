import { NextResponse, type NextRequest } from "next/server";
import { destinationAfterSignIn } from "@/lib/auth";
import { safeNext } from "@/lib/auth-errors";

/** After a browser-side sign-in, route new accounts through profile setup. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  return NextResponse.redirect(new URL(await destinationAfterSignIn(safeNext(url.searchParams.get("next"))), url.origin));
}
