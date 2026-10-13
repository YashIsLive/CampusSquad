import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { refCookieName } from "@/lib/registration";

/**
 * Short share link: counts the click, remembers the channel for 30 days (so a later registration
 * is attributed to it), then redirects to the event page.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/s/[code]">) {
  const { code } = await ctx.params;
  const link = await db.query.shareLinks.findFirst({ where: eq(schema.shareLinks.shortCode, code) });
  if (!link) return NextResponse.redirect(new URL("/", request.url));

  const ua = request.headers.get("user-agent") ?? "";
  // Link-preview bots (WhatsApp, Slack…) fetch the URL too; don't count them as clicks.
  const isBot = /bot|crawler|spider|facebookexternalhit|whatsapp|slack|telegram|preview/i.test(ua);
  if (!isBot) {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.shareLinks)
        .set({ clicks: sql`${schema.shareLinks.clicks} + 1` })
        .where(eq(schema.shareLinks.id, link.id));
      await tx.insert(schema.shareLinkClicks).values({
        shareLinkId: link.id,
        userAgentHash: createHash("sha256").update(ua).digest("hex").slice(0, 16),
      });
    });
  }

  const res = NextResponse.redirect(new URL(`/events/${link.eventId}`, request.url));
  res.cookies.set(refCookieName(link.eventId), link.id, {
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return res;
}
