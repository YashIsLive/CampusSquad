"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { authedAction, fail } from "@/lib/actions";
import { assertWithinLimit } from "@/lib/rate-limit";
import { requireAdminAal } from "@/lib/mfa";
import {
  VOUCHES_NEEDED,
  canReviewCollege,
  countValidVouches,
  deleteIdCard,
  grantCampusVerification,
  notifyReviewers,
} from "@/lib/verification";

/** Student submits the ID card they just uploaded to `id-cards/<their id>/…`. */
export const submitIdCard = authedAction(
  z.object({ path: z.string().trim().min(1).max(300) }),
  async ({ path }, user) => {
    if (user.collegeVerified) fail("You're already verified.");
    if (!user.collegeId) fail("Pick your college in your profile first.");
    // The storage policy already confines uploads to the user's own folder; check the claim too.
    if (!path.startsWith(`${user.id}/`) || path.includes("..")) fail("Upload the photo again.");
    await assertWithinLimit("verificationRequest", user.id);

    const previous = await db.query.verificationRequests.findFirst({
      where: and(eq(schema.verificationRequests.userId, user.id), eq(schema.verificationRequests.status, "pending")),
    });
    await db.transaction(async (tx) => {
      if (previous) {
        await tx
          .update(schema.verificationRequests)
          .set({ status: "cancelled", idCardPath: null, decidedAt: new Date() })
          .where(eq(schema.verificationRequests.id, previous.id));
      }
      await tx.insert(schema.verificationRequests).values({ userId: user.id, collegeId: user.collegeId!, idCardPath: path });
    });
    await deleteIdCard(previous?.idCardPath ?? null);
    await notifyReviewers(user.collegeId!, user.id);
    revalidatePath("/verify");
    return null;
  },
);

export const cancelIdCardRequest = authedAction(z.object({}), async (_input, user) => {
  const pending = await db.query.verificationRequests.findFirst({
    where: and(eq(schema.verificationRequests.userId, user.id), eq(schema.verificationRequests.status, "pending")),
  });
  if (!pending) return null;
  await db
    .update(schema.verificationRequests)
    .set({ status: "cancelled", idCardPath: null, decidedAt: new Date() })
    .where(eq(schema.verificationRequests.id, pending.id));
  await deleteIdCard(pending.idCardPath);
  revalidatePath("/verify");
  return null;
});

/** A platform admin, or an owner/admin of a verified club at the student's college, decides. */
export const reviewIdCard = authedAction(
  z.object({
    requestId: z.uuid(),
    approve: z.boolean(),
    note: z.string().trim().max(300).transform((v) => v || null),
  }),
  async ({ requestId, approve, note }, user) => {
    const req = await db.query.verificationRequests.findFirst({
      where: eq(schema.verificationRequests.id, requestId),
      with: { college: { columns: { name: true } } },
    });
    if (!req || !(await canReviewCollege(user, req.collegeId))) fail("Request not found.");
    // ID photos are sensitive: reviewers confirm with their authenticator app (in production).
    await requireAdminAal(user, { adminOnly: false });
    if (req.status !== "pending") fail(`This request was already ${req.status}.`);
    if (req.userId === user.id) fail("You can't review your own request.");
    if (!approve && !note) fail("Tell the student what to fix (e.g. \"photo is blurry\").");

    let granted = false;
    await db.transaction(async (tx) => {
      await tx
        .update(schema.verificationRequests)
        .set({ status: approve ? "approved" : "rejected", note, reviewerId: user.id, idCardPath: null, decidedAt: new Date() })
        .where(eq(schema.verificationRequests.id, requestId));
      if (approve) {
        const rows = await tx
          .update(schema.profiles)
          .set({ collegeVerified: true, collegeVerifiedVia: "id_card" })
          .where(and(eq(schema.profiles.id, req.userId), eq(schema.profiles.collegeId, req.collegeId)))
          .returning({ id: schema.profiles.id });
        granted = rows.length > 0;
      }
      await tx.insert(schema.notifications).values({
        userId: req.userId,
        type: "verification",
        payload: approve
          ? { title: `You're verified at ${req.college.name}`, body: "Your student ID was approved. The campus badge is on your profile.", href: "/verify" }
          : { title: "Your student ID couldn't be verified", body: note ?? undefined, href: "/verify" },
      });
    });
    await deleteIdCard(req.idCardPath);
    revalidatePath("/verify/review");
    return { granted };
  },
);

/** A verified student vouches that a classmate (same college, unverified) studies there. */
export const vouchFor = authedAction(z.object({ userId: z.uuid() }), async ({ userId }, user) => {
  if (userId === user.id) fail("You can't vouch for yourself.");
  if (!user.collegeVerified || !user.collegeId) fail("Only verified students can vouch.");
  const target = await db.query.profiles.findFirst({
    where: eq(schema.profiles.id, userId),
    columns: { id: true, name: true, username: true, collegeId: true, collegeVerified: true },
    with: { college: { columns: { name: true } } },
  });
  if (!target) fail("Student not found.");
  if (target.collegeVerified) fail(`${target.name} is already verified.`);
  if (target.collegeId !== user.collegeId) fail("You can only vouch for students at your own college.");
  await assertWithinLimit("vouch", user.id);

  await db
    .insert(schema.vouches)
    .values({ voucherId: user.id, userId, collegeId: user.collegeId })
    .onConflictDoNothing();

  const vouches = await countValidVouches(userId, user.collegeId);
  let verified = false;
  if (vouches >= VOUCHES_NEEDED) {
    verified = await grantCampusVerification(userId, user.collegeId, "vouch");
    if (verified) {
      await db.insert(schema.notifications).values({
        userId,
        type: "verification",
        payload: {
          title: `You're verified at ${target.college?.name ?? "your college"}`,
          body: `${VOUCHES_NEEDED} classmates vouched for you.`,
          href: "/verify",
        },
      });
    }
  } else {
    await db.insert(schema.notifications).values({
      userId,
      type: "verification",
      payload: {
        title: `${user.name} vouched for you`,
        body: `${VOUCHES_NEEDED - vouches} more vouch from a verified classmate and you're verified.`,
        href: "/verify",
      },
    });
  }
  revalidatePath(`/u/${target.username}`);
  return { vouches, verified };
});
