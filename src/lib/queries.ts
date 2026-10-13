import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";

/** Organizations where the user is owner/admin. */
export async function getAdminOrgs(userId: string) {
  const rows = await db
    .select({ id: schema.organizations.id, name: schema.organizations.name, collegeId: schema.organizations.collegeId })
    .from(schema.orgMembers)
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.orgMembers.orgId))
    .where(and(eq(schema.orgMembers.userId, userId), inArray(schema.orgMembers.role, ["owner", "admin"])));
  return rows.map((r) => ({ id: r.id, name: r.name, hasCollege: Boolean(r.collegeId) }));
}

export const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function getEventWithOrg(eventId: string) {
  if (!isUuid(eventId)) return undefined;
  return db.query.events.findFirst({
    where: eq(schema.events.id, eventId),
    with: { org: { with: { college: true } }, college: true },
  });
}

export type EventWithOrg = NonNullable<Awaited<ReturnType<typeof getEventWithOrg>>>;
