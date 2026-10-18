import { and, count, eq, inArray, ne, sql } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import * as schema from "@/db/schema";
import type { DB, Tx } from "@/db";
import { AppError } from "@/lib/errors";

// NOTE: no "server-only" import here so the accept transaction can be exercised by integration tests.

const newCheckinCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 10);
type Notification = typeof schema.notifications.$inferInsert;

function fail(msg: string): never {
  throw new AppError(msg);
}

/**
 * Adds `userId` to a team, links (or creates) their registration, and tidies up their other
 * open applications / availability post for the event. Caller must hold a transaction.
 * The DB trigger enforces team_max and the cross-college rule; the unique index enforces
 * one team per user per event.
 */
export async function joinTeamTx(
  tx: Tx,
  input: { teamId: string; eventId: string; userId: string; roleTitle: string | null },
) {
  const { teamId, eventId, userId, roleTitle } = input;
  const already = await tx.query.teamMembers.findFirst({
    where: and(eq(schema.teamMembers.eventId, eventId), eq(schema.teamMembers.userId, userId)),
  });
  if (already) fail("Already on a team for this event.");

  await tx.insert(schema.teamMembers).values({ teamId, userId, eventId, roleTitle });

  const reg = await tx.query.registrations.findFirst({
    where: and(eq(schema.registrations.eventId, eventId), eq(schema.registrations.userId, userId)),
  });
  if (reg) {
    await tx.update(schema.registrations).set({ teamId }).where(eq(schema.registrations.id, reg.id));
  } else {
    // They applied while registered but cancelled since; joining a team re-registers them.
    await tx.insert(schema.registrations).values({ eventId, userId, teamId, checkinCode: newCheckinCode() });
  }

  // Withdraw their other open applications for this event — they have a team now.
  const otherVacancies = tx
    .select({ id: schema.vacancies.id })
    .from(schema.vacancies)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.vacancies.teamId))
    .where(and(eq(schema.teams.eventId, eventId), ne(schema.teams.id, teamId)));
  await tx
    .update(schema.applications)
    .set({ status: "withdrawn", decidedAt: new Date() })
    .where(
      and(
        eq(schema.applications.applicantId, userId),
        inArray(schema.applications.status, ["pending", "shortlisted"]),
        inArray(schema.applications.vacancyId, otherVacancies),
      ),
    );
  await tx
    .update(schema.availabilityPosts)
    .set({ status: "closed" })
    .where(and(eq(schema.availabilityPosts.eventId, eventId), eq(schema.availabilityPosts.userId, userId)));
  // Pending invites from other teams are moot now.
  await tx
    .update(schema.invites)
    .set({ status: "cancelled" })
    .where(and(eq(schema.invites.userId, userId), eq(schema.invites.status, "pending"), ne(schema.invites.teamId, teamId)));

  return closeVacanciesIfTeamFull(tx, teamId, eventId);
}

/** When a team reaches team_max, close its open vacancies and reject their pending applicants. */
async function closeVacanciesIfTeamFull(tx: Tx, teamId: string, eventId: string): Promise<Notification[]> {
  const [{ n }] = await tx.select({ n: count() }).from(schema.teamMembers).where(eq(schema.teamMembers.teamId, teamId));
  const event = await tx.query.events.findFirst({ where: eq(schema.events.id, eventId), columns: { teamMax: true } });
  if (!event || n < event.teamMax) return [];

  const open = await tx
    .update(schema.vacancies)
    .set({ status: "closed" })
    .where(and(eq(schema.vacancies.teamId, teamId), eq(schema.vacancies.status, "open")))
    .returning({ id: schema.vacancies.id, roleTitle: schema.vacancies.roleTitle });
  if (open.length === 0) return [];
  return rejectRemaining(tx, open, "the team is now full");
}

async function rejectRemaining(
  tx: Tx,
  vacancies: Array<{ id: string; roleTitle: string }>,
  why: string,
): Promise<Notification[]> {
  const rejected = await tx
    .update(schema.applications)
    .set({ status: "rejected", decidedAt: new Date() })
    .where(
      and(
        inArray(schema.applications.vacancyId, vacancies.map((v) => v.id)),
        inArray(schema.applications.status, ["pending", "shortlisted"]),
      ),
    )
    .returning({ applicantId: schema.applications.applicantId, vacancyId: schema.applications.vacancyId });
  return rejected.map((r) => ({
    userId: r.applicantId,
    type: "vacancy_closed" as const,
    payload: {
      title: `"${vacancies.find((v) => v.id === r.vacancyId)?.roleTitle}" is no longer open`,
      body: `Thanks for applying — ${why}. Keep looking, there are more teams on the board.`,
      href: "/me/applications",
    },
  }));
}

/**
 * Leader accepts an application. One transaction:
 * lock vacancy → validate → add member (+registration) → mark accepted → decrement slots →
 * auto-close a full vacancy (rejecting the rest) → notify everyone affected.
 */
export async function acceptApplication(database: DB | Tx, input: { applicationId: string; actorId: string }) {
  return database.transaction(async (tx) => {
    const app = await tx.query.applications.findFirst({
      where: eq(schema.applications.id, input.applicationId),
    });
    if (!app) fail("Application not found.");

    // Row-lock the vacancy so two simultaneous accepts can't oversubscribe its slots.
    const [vacancy] = await tx
      .select()
      .from(schema.vacancies)
      .where(eq(schema.vacancies.id, app.vacancyId))
      .for("update");
    const team = await tx.query.teams.findFirst({
      where: eq(schema.teams.id, vacancy.teamId),
      with: { event: true, leader: { columns: { collegeId: true } } },
    });
    if (!team) fail("Team not found.");
    if (team.leaderId !== input.actorId) fail("Only the team leader can accept applications.");
    if (!["pending", "shortlisted"].includes(app.status)) fail(`This application is already ${app.status}.`);
    if (vacancy.status !== "open" || vacancy.slotsOpen < 1) fail("This role is already filled.");
    if (team.event.endsAt < new Date()) fail("This event has ended.");

    if (vacancy.scope === "intra") {
      const applicant = await tx.query.profiles.findFirst({
        where: eq(schema.profiles.id, app.applicantId),
        columns: { collegeId: true },
      });
      if (!applicant?.collegeId || applicant.collegeId !== team.leader.collegeId) {
        fail("This role is open to same-college students only.");
      }
    }

    const notifications: Notification[] = await joinTeamTx(tx, {
      teamId: team.id,
      eventId: team.eventId,
      userId: app.applicantId,
      roleTitle: vacancy.roleTitle,
    });

    await tx
      .update(schema.applications)
      .set({ status: "accepted", decidedAt: new Date() })
      .where(eq(schema.applications.id, app.id));

    const slotsOpen = vacancy.slotsOpen - 1;
    await tx
      .update(schema.vacancies)
      .set({ slotsOpen, ...(slotsOpen === 0 && vacancy.status === "open" ? { status: "filled" as const } : {}) })
      .where(eq(schema.vacancies.id, vacancy.id));
    if (slotsOpen === 0) {
      notifications.push(...(await rejectRemaining(tx, [vacancy], "the role has been filled")));
    }

    notifications.push({
      userId: app.applicantId,
      type: "application_accepted",
      payload: {
        title: `You're in! ${team.name} accepted you as ${vacancy.roleTitle}`,
        body: team.event.title,
        href: `/teams/${team.id}`,
      },
    });
    // De-duplicate in case the team-full sweep and the slot sweep both hit the same applicant.
    const seen = new Set<string>();
    const unique = notifications.filter((n) => {
      const key = `${n.userId}:${n.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (unique.length) await tx.insert(schema.notifications).values(unique);

    return { teamId: team.id, slotsOpen, vacancyStatus: slotsOpen === 0 ? "filled" : "open" };
  });
}

export async function teamSize(tx: Tx | DB, teamId: string) {
  const [{ n }] = await tx.select({ n: count() }).from(schema.teamMembers).where(eq(schema.teamMembers.teamId, teamId));
  return n;
}

/** Open slots across a team's open vacancies — used to cap new vacancies at team_max. */
export async function openSlots(tx: Tx | DB, teamId: string) {
  const [row] = await tx
    .select({ n: sql<number>`coalesce(sum(${schema.vacancies.slotsOpen}), 0)::int` })
    .from(schema.vacancies)
    .where(and(eq(schema.vacancies.teamId, teamId), eq(schema.vacancies.status, "open")));
  return row?.n ?? 0;
}
