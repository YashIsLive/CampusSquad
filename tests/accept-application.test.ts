/**
 * Integration tests for the accept-application transaction and the DB integrity rules it relies on.
 * Runs against a real Supabase Postgres (TEST_DATABASE_URL, else DIRECT_URL from .env.local) with
 * migrations applied. Every test runs inside a transaction that is rolled back, so no data persists.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import type { Tx } from "@/db";
import { acceptApplication } from "@/lib/teams";

const url = process.env.TEST_DATABASE_URL ?? process.env.DIRECT_URL;
const client = url ? postgres(url, { prepare: false, max: 2 }) : null;
const db = client ? drizzle(client, { schema }) : null;

afterAll(async () => {
  await client?.end();
});

class Rollback extends Error {}

/** Drizzle wraps driver errors ("Failed query: …") and keeps the Postgres error in `cause`. */
async function expectDbError(promise: Promise<unknown>, pattern: RegExp) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e as { message?: string; cause?: { message?: string } },
  );
  expect(err, "expected the query to fail").not.toBeNull();
  expect(`${err?.message ?? ""} ${err?.cause?.message ?? ""}`).toMatch(pattern);
}

/** Run `fn` in a transaction that is always rolled back. */
async function inRollback(fn: (tx: Tx) => Promise<void>) {
  await expect(
    db!.transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    }),
  ).rejects.toBeInstanceOf(Rollback);
}

async function makeUser(tx: Tx, collegeId: string, handle: string) {
  const id = randomUUID();
  // The on_auth_user_created trigger creates the profile row.
  await tx.execute(sql`insert into auth.users (id, email, raw_user_meta_data) values (${id}, ${`${handle}-${id.slice(0, 6)}@test.seed.test`}, ${JSON.stringify({ full_name: handle })}::jsonb)`);
  await tx.update(schema.profiles).set({ collegeId, collegeVerified: true, onboardedAt: new Date() }).where(eq(schema.profiles.id, id));
  return id;
}

async function fixture(tx: Tx, opts: { teamMax?: number; slots?: number; allowCross?: boolean } = {}) {
  const [coep, pict] = await tx
    .insert(schema.colleges)
    .values([
      { name: `Test COEP ${randomUUID()}`, city: "Pune", state: "MH" },
      { name: `Test PICT ${randomUUID()}`, city: "Pune", state: "MH" },
    ])
    .returning();
  const leader = await makeUser(tx, coep.id, "leader");
  const a1 = await makeUser(tx, coep.id, "applicant1");
  const a2 = await makeUser(tx, pict.id, "applicant2");
  const outsider = await makeUser(tx, coep.id, "outsider");

  const [org] = await tx.insert(schema.organizations).values({ slug: `org-${randomUUID().slice(0, 8)}`, name: "Org", collegeId: coep.id }).returning();
  const day = 86_400_000;
  const [event] = await tx
    .insert(schema.events)
    .values({
      orgId: org.id,
      title: "Test hack",
      type: "hackathon",
      mode: "offline",
      startsAt: new Date(Date.now() + 10 * day),
      endsAt: new Date(Date.now() + 11 * day),
      regDeadline: new Date(Date.now() + 5 * day),
      teamMin: 1,
      teamMax: opts.teamMax ?? 4,
      allowCrossCollege: opts.allowCross ?? true,
      status: "published",
      collegeId: coep.id,
      city: "Pune",
    })
    .returning();
  const [team] = await tx.insert(schema.teams).values({ eventId: event.id, name: "Testers", leaderId: leader }).returning();
  await tx.insert(schema.teamMembers).values({ teamId: team.id, userId: leader, eventId: event.id, roleTitle: "Leader" });
  const [vacancy] = await tx
    .insert(schema.vacancies)
    .values({ teamId: team.id, roleTitle: "Backend dev", slotsTotal: opts.slots ?? 1, slotsOpen: opts.slots ?? 1, scope: "cross" })
    .returning();
  for (const [i, u] of [a1, a2].entries()) {
    await tx.insert(schema.registrations).values({ eventId: event.id, userId: u, checkinCode: `T${randomUUID().slice(0, 9)}${i}` });
  }
  const [app1, app2] = await tx
    .insert(schema.applications)
    .values([
      { vacancyId: vacancy.id, applicantId: a1, message: "pick me", matchScore: 90 },
      { vacancyId: vacancy.id, applicantId: a2, message: "or me", matchScore: 60 },
    ])
    .returning();
  return { coep, pict, leader, a1, a2, outsider, event, team, vacancy, app1, app2 };
}

describe.skipIf(!db)("acceptApplication (transaction)", () => {
  it("adds the member, links registration, fills the vacancy and rejects the rest", async () => {
    await inRollback(async (tx) => {
      const f = await fixture(tx, { slots: 1 });
      const result = await acceptApplication(tx, { applicationId: f.app1.id, actorId: f.leader });

      expect(result).toMatchObject({ teamId: f.team.id, slotsOpen: 0, vacancyStatus: "filled" });

      const member = await tx.query.teamMembers.findFirst({
        where: and(eq(schema.teamMembers.teamId, f.team.id), eq(schema.teamMembers.userId, f.a1)),
      });
      expect(member?.roleTitle).toBe("Backend dev");

      const reg = await tx.query.registrations.findFirst({
        where: and(eq(schema.registrations.eventId, f.event.id), eq(schema.registrations.userId, f.a1)),
      });
      expect(reg?.teamId).toBe(f.team.id);

      const vacancy = await tx.query.vacancies.findFirst({ where: eq(schema.vacancies.id, f.vacancy.id) });
      expect(vacancy).toMatchObject({ slotsOpen: 0, status: "filled" });

      const app1 = await tx.query.applications.findFirst({ where: eq(schema.applications.id, f.app1.id) });
      const app2 = await tx.query.applications.findFirst({ where: eq(schema.applications.id, f.app2.id) });
      expect(app1?.status).toBe("accepted");
      expect(app2?.status).toBe("rejected");

      const notes = await tx.query.notifications.findMany({
        where: sql`${schema.notifications.userId} in (${f.a1}, ${f.a2})`,
      });
      expect(notes.map((n) => [n.userId, n.type]).sort()).toEqual(
        [
          [f.a1, "application_accepted"],
          [f.a2, "vacancy_closed"],
        ].sort(),
      );
    });
  });

  it("keeps the vacancy open while slots remain", async () => {
    await inRollback(async (tx) => {
      const f = await fixture(tx, { slots: 2 });
      const result = await acceptApplication(tx, { applicationId: f.app1.id, actorId: f.leader });
      expect(result).toMatchObject({ slotsOpen: 1, vacancyStatus: "open" });
      const app2 = await tx.query.applications.findFirst({ where: eq(schema.applications.id, f.app2.id) });
      expect(app2?.status).toBe("pending");
    });
  });

  it("only lets the team leader accept", async () => {
    await inRollback(async (tx) => {
      const f = await fixture(tx);
      await expect(acceptApplication(tx, { applicationId: f.app1.id, actorId: f.outsider })).rejects.toThrow(/only the team leader/i);
    });
  });

  it("refuses to accept into a filled vacancy", async () => {
    await inRollback(async (tx) => {
      const f = await fixture(tx, { slots: 2 });
      await acceptApplication(tx, { applicationId: f.app1.id, actorId: f.leader });
      await tx.update(schema.vacancies).set({ slotsOpen: 0, status: "filled" }).where(eq(schema.vacancies.id, f.vacancy.id));
      await expect(acceptApplication(tx, { applicationId: f.app2.id, actorId: f.leader })).rejects.toThrow(/already filled/i);
    });
  });

  it("enforces team_max in the database", async () => {
    await inRollback(async (tx) => {
      // team_max 2 with the leader already in → one more fits, a second doesn't.
      const f = await fixture(tx, { teamMax: 2, slots: 2 });
      await acceptApplication(tx, { applicationId: f.app1.id, actorId: f.leader });
      await expectDbError(
        tx.transaction((sp) => sp.insert(schema.teamMembers).values({ teamId: f.team.id, userId: f.a2, eventId: f.event.id })),
        /CS:TEAM_FULL/,
      );
    });
  });

  it("enforces same-college teams when the event disallows cross-college", async () => {
    await inRollback(async (tx) => {
      const f = await fixture(tx, { allowCross: true });
      await tx.update(schema.events).set({ allowCrossCollege: false }).where(eq(schema.events.id, f.event.id));
      // a2 is from a different college than the leader.
      await expectDbError(acceptApplication(tx, { applicationId: f.app2.id, actorId: f.leader }), /CS:CROSS_COLLEGE_NOT_ALLOWED/);
    });
  });

  it("enforces one team per user per event", async () => {
    await inRollback(async (tx) => {
      const f = await fixture(tx);
      const [other] = await tx.insert(schema.teams).values({ eventId: f.event.id, name: "Other", leaderId: f.a1 }).returning();
      await tx.insert(schema.teamMembers).values({ teamId: other.id, userId: f.a1, eventId: f.event.id });
      await expect(acceptApplication(tx, { applicationId: f.app1.id, actorId: f.leader })).rejects.toThrow(/already on a team/i);
    });
  });

  it("enforces one application per user per vacancy", async () => {
    await inRollback(async (tx) => {
      const f = await fixture(tx);
      await expect(
        tx.transaction((sp) => sp.insert(schema.applications).values({ vacancyId: f.vacancy.id, applicantId: f.a1, message: "again" })),
      ).rejects.toThrow();
    });
  });
});
