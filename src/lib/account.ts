import "server-only";
import { and, asc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Clubs that would be left with nobody to run their upcoming events if this person left.
 * Deleting is blocked until they add another admin (or the events are over).
 */
export async function deletionBlockers(userId: string) {
  const mine = await db
    .select({ orgId: schema.orgMembers.orgId, name: schema.organizations.name, slug: schema.organizations.slug })
    .from(schema.orgMembers)
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.orgMembers.orgId))
    .where(and(eq(schema.orgMembers.userId, userId), inArray(schema.orgMembers.role, ["owner", "admin"])));
  const blockers: Array<{ name: string; slug: string }> = [];
  for (const org of mine) {
    const otherAdmin = await db.query.orgMembers.findFirst({
      where: and(
        eq(schema.orgMembers.orgId, org.orgId),
        ne(schema.orgMembers.userId, userId),
        inArray(schema.orgMembers.role, ["owner", "admin"]),
      ),
    });
    if (otherAdmin) continue;
    const upcoming = await db.query.events.findFirst({
      where: and(eq(schema.events.orgId, org.orgId), eq(schema.events.status, "published"), gt(schema.events.endsAt, new Date())),
      columns: { id: true },
    });
    if (upcoming) blockers.push({ name: org.name, slug: org.slug });
  }
  return blockers;
}

/**
 * Permanently deletes an account. Teams they lead pass to the longest-standing teammate (or are
 * removed if nobody else is on them); everything else that belongs to the person — profile,
 * skills, registrations, applications, messages, verification requests, photos — goes with them.
 * Announcements they posted stay on the event without a name.
 */
export async function deleteAccount(userId: string) {
  await db.transaction(async (tx) => {
    const led = await tx.query.teams.findMany({
      where: eq(schema.teams.leaderId, userId),
      with: { members: { orderBy: asc(schema.teamMembers.joinedAt) } },
    });
    for (const team of led) {
      const successor = team.members.find((m) => m.userId !== userId);
      if (!successor) {
        await tx.delete(schema.teams).where(eq(schema.teams.id, team.id));
        continue;
      }
      await tx.update(schema.teams).set({ leaderId: successor.userId }).where(eq(schema.teams.id, team.id));
      await tx.insert(schema.notifications).values({
        userId: successor.userId,
        type: "invite_response",
        payload: { title: `You now lead ${team.name}`, body: "The previous team lead deleted their account.", href: `/teams/${team.id}` },
      });
    }
  });

  // Their own uploads: profile photo and any ID card still waiting for review.
  const admin = createSupabaseAdminClient();
  for (const bucket of ["avatars", "id-cards"]) {
    const { data } = await admin.storage.from(bucket).list(userId, { limit: 100 });
    if (data?.length) await admin.storage.from(bucket).remove(data.map((f) => `${userId}/${f.name}`));
  }

  // Removing the auth user cascades to the profile and everything that references it.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
}

/** Everything we hold about a person, as plain JSON they can download. */
export async function exportAccountData(userId: string) {
  const [profile, skills, registrations, teams, applications, messages, threadMessages, saved, follows, verification] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(schema.profiles.id, userId), with: { college: { columns: { name: true } } } }),
    db.query.userSkills.findMany({ where: eq(schema.userSkills.userId, userId), with: { skill: { columns: { name: true } } } }),
    db.query.registrations.findMany({ where: eq(schema.registrations.userId, userId), with: { event: { columns: { title: true, startsAt: true } } } }),
    db.query.teamMembers.findMany({ where: eq(schema.teamMembers.userId, userId), with: { team: { columns: { name: true } } } }),
    db.query.applications.findMany({ where: eq(schema.applications.applicantId, userId), with: { vacancy: { columns: { roleTitle: true } } } }),
    db.query.messages.findMany({ where: eq(schema.messages.senderId, userId), columns: { body: true, createdAt: true, teamId: true } }),
    db.query.applicationMessages.findMany({ where: eq(schema.applicationMessages.senderId, userId), columns: { body: true, createdAt: true, applicationId: true } }),
    db.query.savedEvents.findMany({ where: eq(schema.savedEvents.userId, userId) }),
    db.query.orgFollowers.findMany({ where: eq(schema.orgFollowers.userId, userId), with: { org: { columns: { name: true } } } }),
    db.query.verificationRequests.findMany({ where: eq(schema.verificationRequests.userId, userId), columns: { idCardPath: false } }),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    profile,
    skills: skills.map((s) => ({ skill: s.skill.name, level: s.level, endorsements: s.endorsedCount })),
    registrations: registrations.map((r) => ({ event: r.event.title, startsAt: r.event.startsAt, status: r.status, registeredAt: r.createdAt })),
    teams: teams.map((t) => ({ team: t.team.name, role: t.roleTitle, joinedAt: t.joinedAt })),
    applications: applications.map((a) => ({ spot: a.vacancy.roleTitle, status: a.status, message: a.message, appliedAt: a.createdAt })),
    teamChatMessages: messages,
    applicationMessages: threadMessages,
    savedEvents: saved.map((s) => s.eventId),
    followedClubs: follows.map((f) => f.org.name),
    verificationRequests: verification,
  };
}

/** Whether the account has a password at all (Google and email-link accounts may not). */
export async function accountHasPassword(userId: string) {
  const rows = await db.execute<{ has: boolean }>(
    sql`select coalesce(encrypted_password, '') <> '' as has from auth.users where id = ${userId}`,
  );
  return rows[0]?.has === true;
}
