/**
 * Deleting an account against the real database and auth: a team the person leads passes to their
 * longest-standing teammate (who is told), a team that's only them disappears, and the profile is gone.
 * Uses throwaway *.seed.test accounts, cleaned up afterwards. Skipped without Supabase credentials.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";

const enabled = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.DATABASE_URL);
const created: string[] = [];

const supabase = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function makeUser(label: string) {
  const { data, error } = await supabase().auth.admin.createUser({
    email: `${label}-${randomUUID().slice(0, 8)}@personal.seed.test`,
    password: `Pw-${randomUUID()}`,
    email_confirm: true,
  });
  if (error) throw error;
  created.push(data.user.id);
  return data.user.id;
}

afterAll(async () => {
  for (const id of created) await supabase().auth.admin.deleteUser(id).catch(() => {});
});

describe.skipIf(!enabled)("account deletion", () => {
  it("hands teams to the next teammate, removes solo teams, and deletes the profile", async () => {
    const { db, schema } = await import("@/db");
    const { deleteAccount } = await import("@/lib/account");

    // Two team events (size 2+): one for a shared team, one for a team that's only the leader.
    const teamEvents = await db.query.events.findMany({
      where: (e, { and, eq, gte }) => and(eq(e.status, "published"), gte(e.teamMax, 2)),
      columns: { id: true },
      limit: 2,
    });
    expect(teamEvents.length, "needs two published team events (run the seed)").toBe(2);
    const [event, other] = teamEvents;

    const leader = await makeUser("leader");
    const mate = await makeUser("mate");
    // Same college, so the team rules (cross-college limits) don't get in the way.
    const college = await db.query.colleges.findFirst({ where: eq(schema.colleges.verified, true), columns: { id: true } });
    for (const id of [leader, mate]) await db.update(schema.profiles).set({ collegeId: college!.id }).where(eq(schema.profiles.id, id));

    const [shared] = await db.insert(schema.teams).values({ eventId: event.id, name: `Shared ${randomUUID().slice(0, 4)}`, leaderId: leader }).returning();
    await db.insert(schema.teamMembers).values({ teamId: shared.id, eventId: event.id, userId: leader });
    await db.insert(schema.teamMembers).values({ teamId: shared.id, eventId: event.id, userId: mate });
    const [solo] = await db.insert(schema.teams).values({ eventId: other.id, name: `Solo ${randomUUID().slice(0, 4)}`, leaderId: leader }).returning();
    await db.insert(schema.teamMembers).values({ teamId: solo.id, eventId: other.id, userId: leader });

    await deleteAccount(leader);

    const sharedAfter = await db.query.teams.findFirst({ where: eq(schema.teams.id, shared.id) });
    expect(sharedAfter?.leaderId).toBe(mate);
    const told = await db.query.notifications.findFirst({ where: eq(schema.notifications.userId, mate) });
    expect(told?.payload.title).toMatch(/You now lead/);
    expect(await db.query.teams.findFirst({ where: eq(schema.teams.id, solo.id) })).toBeUndefined();
    expect(await db.query.profiles.findFirst({ where: eq(schema.profiles.id, leader) })).toBeUndefined();
    const { data } = await supabase().auth.admin.getUserById(leader);
    expect(data.user).toBeNull();

    await db.delete(schema.teams).where(eq(schema.teams.id, shared.id));
  });
});
