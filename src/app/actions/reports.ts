"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { authedAction, fail } from "@/lib/actions";
import type { CurrentUser } from "@/lib/auth";
import { assertWithinLimit } from "@/lib/rate-limit";
import { loadApplicationThread } from "@/lib/threads";
import { requireAdminAal } from "@/lib/mfa";

const TARGETS = ["event", "profile", "team", "conversation"] as const;
const REASONS = ["spam", "fake", "harassment", "inappropriate", "other"] as const;

/** What's being reported, in words, checked against what the reporter can actually see. */
async function describeTarget(type: (typeof TARGETS)[number], id: string, user: CurrentUser) {
  switch (type) {
    case "event": {
      const e = await db.query.events.findFirst({ where: eq(schema.events.id, id), columns: { title: true } });
      return e ? `Event: ${e.title}` : null;
    }
    case "profile": {
      if (id === user.id) fail("You can't report yourself.");
      const p = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, id), columns: { name: true, username: true } });
      return p ? `Profile: ${p.name || p.username} (@${p.username})` : null;
    }
    case "team": {
      const t = await db.query.teams.findFirst({ where: eq(schema.teams.id, id), columns: { name: true } });
      return t ? `Team: ${t.name}` : null;
    }
    case "conversation": {
      // Only someone in the conversation can report it.
      const thread = await loadApplicationThread(id, user.id);
      return thread ? `Conversation about ${thread.vacancy.roleTitle} at ${thread.team.name}` : null;
    }
  }
}

/**
 * Anyone signed in can flag an event, profile, team or a conversation they're part of. The reporter
 * gets an acknowledgement; admins get one running "reports waiting" notification.
 */
export const reportContent = authedAction(
  z.object({
    targetType: z.enum(TARGETS),
    targetId: z.uuid(),
    reason: z.enum(REASONS),
    details: z.string().trim().max(1000).transform((v) => v || null),
  }),
  async ({ targetType, targetId, reason, details }, user) => {
    const label = await describeTarget(targetType, targetId, user);
    if (!label) fail("That doesn't exist anymore.");
    if (reason === "other" && !details) fail("Tell us briefly what's wrong.");

    const already = await db.query.reports.findFirst({
      where: and(eq(schema.reports.reporterId, user.id), eq(schema.reports.targetId, targetId), eq(schema.reports.status, "open")),
      columns: { id: true },
    });
    if (already) fail("You've already reported this. We'll look at it soon.");
    await assertWithinLimit("report", user.id);

    await db.insert(schema.reports).values({ reporterId: user.id, targetType, targetId, targetLabel: label, reason, details });
    await db.insert(schema.notifications).values({
      userId: user.id,
      type: "report",
      payload: {
        title: "We got your report",
        body: `${label}. An admin will look at it within 24 hours. Thanks for keeping Got Next safe.`,
      },
    });
    await notifyAdminsOfReports();
    return null;
  },
);

/** Admin closes a report, either acting on it ("resolved") or not ("dismissed"). The reporter hears back. */
export const closeReport = authedAction(
  z.object({
    reportId: z.uuid(),
    outcome: z.enum(["resolved", "dismissed"]),
    note: z.string().trim().max(500).transform((v) => v || null),
  }),
  async ({ reportId, outcome, note }, user) => {
    await requireAdminAal(user);
    const report = await db.query.reports.findFirst({ where: eq(schema.reports.id, reportId) });
    if (!report) fail("Report not found.");
    if (report.status !== "open") fail(`This report was already ${report.status}.`);
    await db
      .update(schema.reports)
      .set({ status: outcome, resolution: note, resolvedBy: user.id, resolvedAt: new Date() })
      .where(eq(schema.reports.id, reportId));
    if (report.reporterId) {
      await db.insert(schema.notifications).values({
        userId: report.reporterId,
        type: "report",
        payload: {
          title: outcome === "resolved" ? "We acted on your report" : "We reviewed your report",
          body: note ?? (outcome === "resolved" ? `${report.targetLabel}. Thanks for telling us.` : `${report.targetLabel}. We didn't find a rule broken this time.`),
        },
      });
    }
    revalidatePath("/admin");
    return null;
  },
);

async function notifyAdminsOfReports() {
  const [{ n }] = await db.select({ n: count() }).from(schema.reports).where(eq(schema.reports.status, "open"));
  const admins = await db.select({ id: schema.profiles.id }).from(schema.profiles).where(eq(schema.profiles.isAdmin, true));
  const payload = {
    title: n === 1 ? "A report is waiting" : `${n} reports are waiting`,
    body: "Reports should be looked at within 24 hours.",
    href: "/admin?section=reports",
  };
  for (const a of admins) {
    const updated = await db
      .update(schema.notifications)
      .set({ payload, createdAt: new Date() })
      .where(
        and(
          eq(schema.notifications.userId, a.id),
          eq(schema.notifications.type, "report"),
          isNull(schema.notifications.readAt),
          sql`${schema.notifications.payload}->>'href' = '/admin?section=reports'`,
        ),
      )
      .returning({ id: schema.notifications.id });
    if (updated.length === 0) await db.insert(schema.notifications).values({ userId: a.id, type: "report", payload });
  }
}
