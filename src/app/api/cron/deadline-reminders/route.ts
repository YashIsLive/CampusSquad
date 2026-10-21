import { NextResponse, type NextRequest } from "next/server";
import { runReminders } from "@/lib/reminders";
import { sweepIdCards } from "@/lib/verification";

/**
 * Daily housekeeping, called by Vercel Cron (see vercel.json) or any scheduler with
 * `Authorization: Bearer $CRON_SECRET`: reminders, and deleting ID photos nobody is reviewing.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const [reminders, idPhotosDeleted] = await Promise.all([runReminders(), sweepIdCards()]);
  return NextResponse.json({ ...reminders, idPhotosDeleted });
}
