import { NextResponse, type NextRequest } from "next/server";
import { sendClosingReminders } from "@/lib/reminders";

/** Called by Vercel Cron (see vercel.json) or any scheduler with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const sent = await sendClosingReminders();
  return NextResponse.json({ sent });
}
