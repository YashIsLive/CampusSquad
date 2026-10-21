import "server-only";
import { and, count, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Campus verification, for students whose college email can't prove it:
 *  - Email domain (automatic, when the college has one) — unchanged.
 *  - Student ID card: a photo reviewed by a platform admin or an owner/admin of a verified club at
 *    the same college. The image sits in a private bucket and is deleted once decided.
 *  - Vouches: VOUCHES_NEEDED already-verified students from the same college say they know you.
 */
export const VOUCHES_NEEDED = 2;
export const ID_CARD_BUCKET = "id-cards";

/** Colleges this user may review ID cards for; "all" for platform admins. */
export async function reviewableColleges(user: { id: string; isAdmin: boolean }): Promise<"all" | string[]> {
  if (user.isAdmin) return "all";
  const rows = await db
    .selectDistinct({ collegeId: schema.organizations.collegeId })
    .from(schema.orgMembers)
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.orgMembers.orgId))
    .where(
      and(
        eq(schema.orgMembers.userId, user.id),
        inArray(schema.orgMembers.role, ["owner", "admin"]),
        eq(schema.organizations.verified, true),
        sql`${schema.organizations.collegeId} is not null`,
      ),
    );
  return rows.map((r) => r.collegeId!).filter(Boolean);
}

export async function canReviewCollege(user: { id: string; isAdmin: boolean }, collegeId: string) {
  const colleges = await reviewableColleges(user);
  return colleges === "all" || colleges.includes(collegeId);
}

/** Vouches that still count: from students who are verified at the same college right now. */
export async function countValidVouches(userId: string, collegeId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(schema.vouches)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.vouches.voucherId))
    .where(
      and(
        eq(schema.vouches.userId, userId),
        eq(schema.vouches.collegeId, collegeId),
        eq(schema.profiles.collegeId, collegeId),
        eq(schema.profiles.collegeVerified, true),
      ),
    );
  return row?.n ?? 0;
}

/** Marks the student verified at `collegeId` — only if that is still their college. */
export async function grantCampusVerification(userId: string, collegeId: string, via: "id_card" | "vouch" | "admin") {
  const updated = await db
    .update(schema.profiles)
    .set({ collegeVerified: true, collegeVerifiedVia: via })
    .where(and(eq(schema.profiles.id, userId), eq(schema.profiles.collegeId, collegeId)))
    .returning({ id: schema.profiles.id });
  return updated.length > 0;
}

export async function deleteIdCard(path: string | null) {
  if (!path) return;
  await createSupabaseAdminClient().storage.from(ID_CARD_BUCKET).remove([path]);
}

/** Short-lived link a reviewer can open; null if the file is gone. */
export async function idCardViewUrl(path: string | null) {
  if (!path) return null;
  const { data } = await createSupabaseAdminClient().storage.from(ID_CARD_BUCKET).createSignedUrl(path, 10 * 60);
  return data?.signedUrl ?? null;
}

/**
 * Tells everyone who can review this college's IDs that the queue has work: one unread
 * notification per reviewer, refreshed with the current count rather than one per student.
 */
export async function notifyReviewers(collegeId: string, exceptUserId: string) {
  const reviewers = await db
    .selectDistinct({ id: schema.profiles.id })
    .from(schema.profiles)
    .leftJoin(schema.orgMembers, eq(schema.orgMembers.userId, schema.profiles.id))
    .leftJoin(schema.organizations, eq(schema.organizations.id, schema.orgMembers.orgId))
    .where(
      or(
        eq(schema.profiles.isAdmin, true),
        and(
          inArray(schema.orgMembers.role, ["owner", "admin"]),
          eq(schema.organizations.verified, true),
          eq(schema.organizations.collegeId, collegeId),
        ),
      ),
    );
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.verificationRequests)
    .where(and(eq(schema.verificationRequests.collegeId, collegeId), eq(schema.verificationRequests.status, "pending")));
  const payload = {
    title: n === 1 ? "A student ID is waiting for review" : `${n} student IDs are waiting for review`,
    body: "Check the name and college, then approve or reject.",
    href: "/verify/review",
  };
  for (const r of reviewers) {
    if (r.id === exceptUserId) continue;
    const updated = await db
      .update(schema.notifications)
      .set({ payload, createdAt: new Date() })
      .where(
        and(
          eq(schema.notifications.userId, r.id),
          eq(schema.notifications.type, "verification"),
          isNull(schema.notifications.readAt),
          sql`${schema.notifications.payload}->>'href' = '/verify/review'`,
        ),
      )
      .returning({ id: schema.notifications.id });
    if (updated.length === 0) await db.insert(schema.notifications).values({ userId: r.id, type: "verification", payload });
  }
}

/**
 * Deletes student ID photos that no pending request points to: replaced uploads, uploads whose
 * request never got filed, requests cancelled because the student got verified another way.
 * Files younger than an hour are left alone, so an upload in progress isn't caught.
 * `userId` limits the sweep to one student's folder (used right after they submit).
 */
export async function sweepIdCards(userId?: string) {
  const storage = createSupabaseAdminClient().storage.from(ID_CARD_BUCKET);
  const pending = await db
    .select({ path: schema.verificationRequests.idCardPath })
    .from(schema.verificationRequests)
    .where(and(eq(schema.verificationRequests.status, "pending"), sql`${schema.verificationRequests.idCardPath} is not null`));
  const keep = new Set(pending.map((p) => p.path));
  const folders = userId ? [userId] : ((await storage.list("", { limit: 1000 })).data ?? []).map((f) => f.name);
  const hourAgo = Date.now() - 3600 * 1000;
  let removed = 0;
  for (const folder of folders) {
    const { data: files } = await storage.list(folder, { limit: 100 });
    const stale = (files ?? [])
      .map((f) => ({ path: `${folder}/${f.name}`, created: f.created_at ? Date.parse(f.created_at) : 0 }))
      .filter((f) => !keep.has(f.path) && (userId || f.created < hourAgo))
      .map((f) => f.path);
    if (stale.length) {
      await storage.remove(stale);
      removed += stale.length;
    }
  }
  return removed;
}
