"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { authedAction, fail } from "@/lib/actions";
import type { CurrentUser } from "@/lib/auth";
import { emailMatchesDomain } from "@/lib/college";

function assertAdmin(user: CurrentUser) {
  if (!user.isAdmin) fail("Admins only.");
}

const domain = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, "Enter a domain like coeptech.ac.in (no @).");

/** Approve a student-requested college: set its email domain and verify matching students. */
export const verifyCollege = authedAction(
  z.object({
    collegeId: z.uuid(),
    name: z.string().trim().min(3).max(120),
    city: z.string().trim().min(2).max(60),
    state: z.string().trim().min(2).max(60),
    emailDomain: domain,
  }),
  async ({ collegeId, emailDomain, ...rest }, user) => {
    assertAdmin(user);
    const clash = await db.query.colleges.findFirst({
      where: and(eq(schema.colleges.emailDomain, emailDomain), ne(schema.colleges.id, collegeId)),
    });
    if (clash) fail(`${clash.name} already uses @${emailDomain}. Reject this request and ask students to pick it instead.`);

    const verified = await db.transaction(async (tx) => {
      await tx.update(schema.colleges).set({ ...rest, emailDomain, verified: true }).where(eq(schema.colleges.id, collegeId));
      const members = await tx
        .select({ id: schema.profiles.id, email: schema.profiles.email })
        .from(schema.profiles)
        // Only addresses the student has proven they own (not instant password sign-ups).
        .where(and(eq(schema.profiles.collegeId, collegeId), eq(schema.profiles.emailVerified, true)));
      const matching = members.filter((m) => emailMatchesDomain(m.email, emailDomain));
      for (const m of matching) {
        await tx.update(schema.profiles).set({ collegeVerified: true }).where(eq(schema.profiles.id, m.id));
      }
      return matching.length;
    });
    revalidatePath("/admin");
    return { studentsVerified: verified };
  },
);

/** Reject a requested college: unlink its students (they can pick another) and delete it. */
export const rejectCollege = authedAction(z.object({ collegeId: z.uuid() }), async ({ collegeId }, user) => {
  assertAdmin(user);
  const college = await db.query.colleges.findFirst({ where: eq(schema.colleges.id, collegeId) });
  if (!college) fail("College not found.");
  if (college.verified) fail("Verified colleges can't be rejected here.");
  const inUse = await db.query.organizations.findFirst({ where: eq(schema.organizations.collegeId, collegeId) });
  if (inUse) fail("A club is linked to this college.");
  await db.transaction(async (tx) => {
    await tx.update(schema.profiles).set({ collegeId: null, collegeVerified: false }).where(eq(schema.profiles.collegeId, collegeId));
    await tx.delete(schema.colleges).where(eq(schema.colleges.id, collegeId));
  });
  revalidatePath("/admin");
  return null;
});

export const setOrgVerified = authedAction(
  z.object({ orgId: z.uuid(), verified: z.boolean() }),
  async ({ orgId, verified }, user) => {
    assertAdmin(user);
    await db.update(schema.organizations).set({ verified }).where(eq(schema.organizations.id, orgId));
    revalidatePath("/admin");
    revalidatePath("/orgs", "layout");
    return null;
  },
);

/** Grant or remove platform admin. You can't remove your own (ask another admin). */
export const setAdmin = authedAction(z.object({ userId: z.uuid(), admin: z.boolean() }), async ({ userId, admin }, user) => {
  assertAdmin(user);
  if (userId === user.id && !admin) fail("You can't remove your own admin access. Ask another admin.");
  await db.update(schema.profiles).set({ isAdmin: admin }).where(eq(schema.profiles.id, userId));
  revalidatePath("/admin");
  return null;
});

/** Verify (or un-verify) a student's college by hand, e.g. after checking with the college. */
export const setStudentVerified = authedAction(
  z.object({ userId: z.uuid(), verified: z.boolean() }),
  async ({ userId, verified }, user) => {
    assertAdmin(user);
    const profile = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, userId), columns: { collegeId: true } });
    if (!profile) fail("Student not found.");
    if (verified && !profile.collegeId) fail("They haven't picked a college yet.");
    await db
      .update(schema.profiles)
      .set(verified ? { collegeVerified: true, collegeVerifiedVia: "admin" } : { collegeVerified: false })
      .where(eq(schema.profiles.id, userId));
    revalidatePath("/admin");
    return null;
  },
);

/** Take an event off the public site (back to draft), e.g. spam or a duplicate. Its organizers can still see it. */
export const takeDownEvent = authedAction(z.object({ eventId: z.uuid() }), async ({ eventId }, user) => {
  assertAdmin(user);
  await db.update(schema.events).set({ status: "draft" }).where(eq(schema.events.id, eventId));
  revalidatePath("/admin");
  revalidatePath("/", "layout");
  return null;
});
