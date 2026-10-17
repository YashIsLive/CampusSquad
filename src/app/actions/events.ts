"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { authedAction, fail } from "@/lib/actions";
import { assertWithinLimit } from "@/lib/rate-limit";
import { isOrgAdmin } from "@/lib/auth";
import { DOMAINS, fromLocalInput } from "@/lib/format";
import { notifyFollowersOnFirstPublish } from "@/lib/publish";

const localDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time.")
  .transform(fromLocalInput);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const eventSchema = z
  .object({
    orgId: z.uuid("Pick an organization."),
    title: z.string().trim().min(5, "Title is too short.").max(120),
    description: z.string().trim().min(20, "Add a short description (20+ characters).").max(5000),
    type: z.enum(schema.eventType.enumValues),
    domainTags: z.array(z.enum(DOMAINS.map((d) => d.value) as [string, ...string[]])).max(5),
    mode: z.enum(schema.eventMode.enumValues),
    venue: optionalText(200),
    startsAt: localDate,
    endsAt: localDate,
    regDeadline: localDate,
    teamMin: z.number().int().min(1).max(10),
    teamMax: z.number().int().min(1).max(10),
    eligibilityScope: z.enum(schema.eligibilityScope.enumValues),
    allowCrossCollege: z.boolean(),
    isFree: z.boolean(),
    feeText: optionalText(100),
    prizeText: optionalText(300),
    rulesMd: optionalText(10000),
    posterUrl: z.url().nullable(),
    externalUrl: z
      .string()
      .trim()
      .transform((v) => v || null)
      .pipe(z.url("Enter a full URL (https://…)").nullable()),
    beginnerFriendly: z.boolean(),
    publish: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.teamMin > v.teamMax) ctx.addIssue({ code: "custom", path: ["teamMax"], message: "Max team size must be ≥ min." });
    if (v.endsAt <= v.startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End must be after start." });
    if (v.regDeadline > v.endsAt) ctx.addIssue({ code: "custom", path: ["regDeadline"], message: "Deadline must be before the event ends." });
    if (v.mode !== "online" && !v.venue) ctx.addIssue({ code: "custom", path: ["venue"], message: "Add a venue for offline/hybrid events." });
    if (!v.isFree && !v.feeText) ctx.addIssue({ code: "custom", path: ["feeText"], message: "Describe the fee." });
  });

export type EventInput = z.input<typeof eventSchema>;

async function orgForEvent(orgId: string, userId: string) {
  if (!(await isOrgAdmin(userId, orgId))) fail("Only admins of this organization can manage its events.");
  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, orgId),
    with: { college: true },
  });
  if (!org) fail("Organization not found.");
  return org;
}

export const createEvent = authedAction(eventSchema, async ({ publish, ...input }, user) => {
  const org = await orgForEvent(input.orgId, user.id);
  await assertWithinLimit("event", user.id);
  if (input.eligibilityScope !== "india" && !org.college) {
    fail("This organization isn't tied to a college, so the event must be open to all India.");
  }
  const [event] = await db
    .insert(schema.events)
    .values({
      ...input,
      collegeId: org.collegeId,
      city: org.college?.city ?? null,
      status: publish ? "published" : "draft",
      createdBy: user.id,
    })
    .returning({ id: schema.events.id });
  if (publish) await notifyFollowersOnFirstPublish(event.id);
  revalidatePath("/");
  return { id: event.id };
});

export const updateEvent = authedAction(
  eventSchema.and(z.object({ eventId: z.uuid() })),
  async ({ eventId, publish, ...input }, user) => {
    const existing = await db.query.events.findFirst({ where: eq(schema.events.id, eventId) });
    if (!existing) fail("Event not found.");
    // Must be admin of the current org (and of the new one, if moved).
    await orgForEvent(existing.orgId, user.id);
    const org = await orgForEvent(input.orgId, user.id);

    // Shrinking team_max below an existing team's size would break the invariant.
    if (input.teamMax < existing.teamMax) {
      const biggest = await db.execute<{ n: number }>(
        sql`select coalesce(max(c), 0)::int as n from (select count(*) c from team_members where event_id = ${eventId} group by team_id) t`,
      );
      if ((biggest[0]?.n ?? 0) > input.teamMax) fail("Some teams already have more members than the new maximum.");
    }
    await db
      .update(schema.events)
      .set({
        ...input,
        collegeId: org.collegeId,
        city: org.college?.city ?? null,
        status: publish ? "published" : existing.status === "closed" ? "closed" : "draft",
        updatedAt: new Date(),
      })
      .where(eq(schema.events.id, eventId));
    if (publish) await notifyFollowersOnFirstPublish(eventId);
    revalidatePath(`/events/${eventId}`);
    revalidatePath("/");
    return { id: eventId };
  },
);

export const setEventStatus = authedAction(
  z.object({
    eventId: z.uuid(),
    status: z.enum(schema.eventStatus.enumValues).optional(),
    registrationsOpen: z.boolean().optional(),
  }),
  async ({ eventId, status, registrationsOpen }, user) => {
    const event = await db.query.events.findFirst({ where: eq(schema.events.id, eventId) });
    if (!event) fail("Event not found.");
    await orgForEvent(event.orgId, user.id);
    await db
      .update(schema.events)
      .set({
        ...(status ? { status } : {}),
        ...(registrationsOpen !== undefined ? { registrationsOpen } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.events.id, eventId));
    if (status === "published") await notifyFollowersOnFirstPublish(eventId);
    revalidatePath(`/events/${eventId}`, "layout");
    revalidatePath("/");
    return null;
  },
);

