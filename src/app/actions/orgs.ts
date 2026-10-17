"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { authedAction, fail } from "@/lib/actions";
import { assertWithinLimit } from "@/lib/rate-limit";
import { isOrgAdmin } from "@/lib/auth";

const orgSchema = z.object({
  name: z.string().trim().min(3, "Name is too short.").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "URL: lowercase letters, numbers and dashes.")
    .min(3)
    .max(40),
  type: z.enum(schema.orgType.enumValues),
  description: z.string().trim().max(1000).transform((v) => v || null),
  logoUrl: z.url().nullable(),
});

export const createOrganization = authedAction(orgSchema, async (input, user) => {
  if (!user.collegeVerified || !user.collegeId) {
    fail("Only verified students can create an organization. Sign in with your college email to get verified.");
  }
  await assertWithinLimit("org", user.id);
  const taken = await db.query.organizations.findFirst({ where: eq(schema.organizations.slug, input.slug) });
  if (taken) fail("That URL is taken. Try another.");

  const org = await db.transaction(async (tx) => {
    const [org] = await tx
      .insert(schema.organizations)
      .values({ ...input, collegeId: user.collegeId, createdBy: user.id })
      .returning();
    await tx.insert(schema.orgMembers).values({ orgId: org.id, userId: user.id, role: "owner" });
    return org;
  });
  revalidatePath("/", "layout");
  return { slug: org.slug };
});

export const updateOrganization = authedAction(
  orgSchema.omit({ slug: true }).extend({ orgId: z.uuid() }),
  async ({ orgId, ...input }, user) => {
    if (!(await isOrgAdmin(user.id, orgId))) fail("Only org admins can edit this organization.");
    const [org] = await db
      .update(schema.organizations)
      .set(input)
      .where(eq(schema.organizations.id, orgId))
      .returning({ slug: schema.organizations.slug });
    revalidatePath(`/orgs/${org.slug}`);
    return null;
  },
);

export const addOrgAdmin = authedAction(
  z.object({ orgId: z.uuid(), email: z.email("Enter a valid email.") }),
  async ({ orgId, email }, user) => {
    const me = await db.query.orgMembers.findFirst({
      where: and(eq(schema.orgMembers.orgId, orgId), eq(schema.orgMembers.userId, user.id)),
    });
    if (me?.role !== "owner") fail("Only the owner can add admins.");
    const target = await db.query.profiles.findFirst({ where: eq(schema.profiles.email, email.toLowerCase()) });
    if (!target) fail("No CampusSquad account with that email. Ask them to sign up first.");
    await db
      .insert(schema.orgMembers)
      .values({ orgId, userId: target.id, role: "admin" })
      .onConflictDoUpdate({
        target: [schema.orgMembers.orgId, schema.orgMembers.userId],
        set: { role: "admin" },
        setWhere: sql`${schema.orgMembers.role} <> 'owner'`,
      });
    revalidatePath("/orgs", "layout");
    return { name: target.name };
  },
);

export const removeOrgMember = authedAction(
  z.object({ orgId: z.uuid(), userId: z.uuid() }),
  async ({ orgId, userId }, user) => {
    const me = await db.query.orgMembers.findFirst({
      where: and(eq(schema.orgMembers.orgId, orgId), eq(schema.orgMembers.userId, user.id)),
    });
    if (me?.role !== "owner") fail("Only the owner can remove admins.");
    if (userId === user.id) fail("The owner can't remove themselves.");
    await db
      .delete(schema.orgMembers)
      .where(and(eq(schema.orgMembers.orgId, orgId), eq(schema.orgMembers.userId, userId)));
    revalidatePath("/orgs", "layout");
    return null;
  },
);

export const toggleFollowOrg = authedAction(
  z.object({ orgId: z.uuid(), follow: z.boolean() }),
  async ({ orgId, follow }, user) => {
    if (follow) {
      await db.insert(schema.orgFollowers).values({ orgId, userId: user.id }).onConflictDoNothing();
    } else {
      await db
        .delete(schema.orgFollowers)
        .where(and(eq(schema.orgFollowers.orgId, orgId), eq(schema.orgFollowers.userId, user.id)));
    }
    revalidatePath("/orgs", "layout");
    return { following: follow };
  },
);

