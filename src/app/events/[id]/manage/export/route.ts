import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser, isOrgAdmin } from "@/lib/auth";
import { getEventWithOrg } from "@/lib/queries";

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formula injection and quote everything.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET(_req: NextRequest, ctx: RouteContext<"/events/[id]/manage/export">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const event = await getEventWithOrg(id);
  if (!event || !(await isOrgAdmin(user.id, event.orgId))) return new NextResponse("Not found", { status: 404 });

  const rows = await db.query.registrations.findMany({
    where: eq(schema.registrations.eventId, event.id),
    with: { user: { with: { college: true } }, team: true, shareLink: true },
    orderBy: desc(schema.registrations.createdAt),
  });

  const header = ["Name", "Email", "College", "Verified", "Year", "Branch", "Team", "Source", "Status", "Check-in code", "Registered at", "Checked in at"];
  const lines = rows.map((r) =>
    [
      r.user.name,
      r.user.email,
      r.user.college?.name,
      r.user.collegeVerified ? "yes" : "no",
      r.user.year,
      r.user.branch,
      r.team?.name ?? "",
      r.shareLink?.channelLabel ?? "direct",
      r.status,
      r.checkinCode,
      r.createdAt.toISOString(),
      r.checkedInAt?.toISOString() ?? "",
    ]
      .map(csvCell)
      .join(","),
  );
  const csv = "﻿" + [header.map(csvCell).join(","), ...lines].join("\r\n");
  const filename = `${event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-registrants.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
