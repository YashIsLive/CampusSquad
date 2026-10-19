import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { exportAccountData } from "@/lib/account";

/** "Download my data": everything Got Next holds about the signed-in person, as a JSON file. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Please sign in first.", { status: 401 });
  const data = await exportAccountData(user.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="got-next-${user.username}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
