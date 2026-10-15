import "server-only";
import { and, eq, isNull, notInArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { EVENT_TYPE_LABEL, formatDateTime } from "@/lib/format";

/**
 * Called after any action that may have published an event. The first time an event is live,
 * stamps `published_at` and notifies the organization's followers. The conditional UPDATE makes
 * this idempotent, so unpublish → republish never notifies twice.
 */
export async function notifyFollowersOnFirstPublish(eventId: string) {
  const [event] = await db
    .update(schema.events)
    .set({ publishedAt: new Date() })
    .where(and(eq(schema.events.id, eventId), eq(schema.events.status, "published"), isNull(schema.events.publishedAt)))
    .returning({
      id: schema.events.id,
      orgId: schema.events.orgId,
      title: schema.events.title,
      type: schema.events.type,
      regDeadline: schema.events.regDeadline,
    });
  if (!event) return 0;

  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, event.orgId),
    columns: { name: true },
  });
  // Organizers don't need to be told about their own event.
  const admins = db.select({ id: schema.orgMembers.userId }).from(schema.orgMembers).where(eq(schema.orgMembers.orgId, event.orgId));
  const followers = await db
    .select({ userId: schema.orgFollowers.userId })
    .from(schema.orgFollowers)
    .where(and(eq(schema.orgFollowers.orgId, event.orgId), notInArray(schema.orgFollowers.userId, admins)));
  if (followers.length === 0) return 0;

  await db.insert(schema.notifications).values(
    followers.map((f) => ({
      userId: f.userId,
      type: "new_event" as const,
      payload: {
        title: `${org?.name ?? "A club you follow"} posted: ${event.title}`,
        body: `${EVENT_TYPE_LABEL[event.type]} · register by ${formatDateTime(event.regDeadline)}`,
        href: `/events/${event.id}`,
      },
    })),
  );
  return followers.length;
}
