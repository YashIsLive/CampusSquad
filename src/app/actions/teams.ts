"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { authedAction, fail } from "@/lib/actions";
import { assertWithinLimit } from "@/lib/rate-limit";
import type { CurrentUser } from "@/lib/auth";
import { crossCollegeAllowed } from "@/lib/eligibility";
import { matchScore } from "@/lib/match-score";
import { createTeamTx, ensureRegistration } from "@/lib/registration";
import { acceptApplication as acceptApplicationTx, joinTeamTx, openSlots, teamSize } from "@/lib/teams";

// ---------- helpers ----------

async function loadTeam(teamId: string) {
  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.id, teamId),
    with: { event: true, leader: { columns: { id: true, name: true, collegeId: true } } },
  });
  if (!team) fail("Team not found.");
  return team;
}

async function loadTeamAsLeader(teamId: string, user: CurrentUser) {
  const team = await loadTeam(teamId);
  if (team.leaderId !== user.id) fail("Only the team leader can do that.");
  return team;
}

function assertEventNotOver(event: { endsAt: Date }) {
  if (event.endsAt < new Date()) fail("This event has ended.");
}

function revalidateTeam(teamId: string, eventId: string) {
  revalidatePath(`/teams/${teamId}`, "layout");
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/me/applications");
}

const skillIds = z.array(z.uuid()).max(10);

// ---------- teams ----------

export const createTeam = authedAction(
  z.object({
    eventId: z.uuid(),
    name: z.string().trim().min(2, "Team name is too short.").max(40),
    ideaPitch: z.string().trim().max(300).optional(),
  }),
  async ({ eventId, ...input }, user) => {
    const event = await db.query.events.findFirst({ where: eq(schema.events.id, eventId) });
    if (!event) fail("Event not found.");
    const team = await db.transaction((tx) => createTeamTx(tx, event, user, input));
    revalidateTeam(team.id, eventId);
    return { teamId: team.id };
  },
);

export const updateTeam = authedAction(
  z.object({
    teamId: z.uuid(),
    name: z.string().trim().min(2).max(40),
    ideaPitch: z.string().trim().max(300).transform((v) => v || null),
    isOpen: z.boolean(),
  }),
  async ({ teamId, ...input }, user) => {
    const team = await loadTeamAsLeader(teamId, user);
    await db.update(schema.teams).set(input).where(eq(schema.teams.id, teamId));
    revalidateTeam(teamId, team.eventId);
    return null;
  },
);

export const removeMember = authedAction(
  z.object({ teamId: z.uuid(), userId: z.uuid() }),
  async ({ teamId, userId }, user) => {
    const team = await loadTeam(teamId);
    const leaving = userId === user.id;
    if (!leaving && team.leaderId !== user.id) fail("Only the leader can remove members.");
    if (userId === team.leaderId) fail("The leader can't leave. Cancel your registration from the event page to disband.");
    assertEventNotOver(team.event);
    await db.transaction(async (tx) => {
      await tx
        .delete(schema.teamMembers)
        .where(and(eq(schema.teamMembers.teamId, teamId), eq(schema.teamMembers.userId, userId)));
      await tx
        .update(schema.registrations)
        .set({ teamId: null })
        .where(and(eq(schema.registrations.eventId, team.eventId), eq(schema.registrations.userId, userId)));
    });
    revalidateTeam(teamId, team.eventId);
    return null;
  },
);

// ---------- vacancies ----------

const vacancySchema = z
  .object({
    teamId: z.uuid(),
    roleTitle: z.string().trim().min(2, "Say who you need, like \"Backend developer\".").max(60),
    description: z.string().trim().max(500).transform((v) => v || null),
    requiredSkillIds: skillIds,
    niceSkillIds: skillIds,
    commitmentHours: z.number().int().min(1).max(80).nullable(),
    slots: z.number().int().min(1).max(9),
    scope: z.enum(schema.teamScope.enumValues),
    screeningQuestion: z.string().trim().max(200).transform((v) => v || null),
  })
  .refine((v) => v.requiredSkillIds.length > 0, { path: ["requiredSkillIds"], message: "Pick at least one required skill." });

export const postVacancy = authedAction(vacancySchema, async (input, user) => {
  const team = await loadTeamAsLeader(input.teamId, user);
  assertEventNotOver(team.event);
  if (input.scope === "cross" && !team.event.allowCrossCollege) {
    fail("This event requires same-college teams — use 'Same college only'.");
  }
  const capacity = team.event.teamMax - (await teamSize(db, team.id)) - (await openSlots(db, team.id));
  if (input.slots > capacity) {
    fail(capacity <= 0 ? "Your open spots already fill the team." : `Only ${capacity} more slot(s) fit within the max team size.`);
  }
  const nice = input.niceSkillIds.filter((id) => !input.requiredSkillIds.includes(id));
  await db.transaction(async (tx) => {
    const [v] = await tx
      .insert(schema.vacancies)
      .values({
        teamId: team.id,
        roleTitle: input.roleTitle,
        description: input.description,
        commitmentHours: input.commitmentHours,
        slotsTotal: input.slots,
        slotsOpen: input.slots,
        scope: input.scope,
        screeningQuestion: input.screeningQuestion,
      })
      .returning({ id: schema.vacancies.id });
    await tx.insert(schema.vacancySkills).values([
      ...input.requiredSkillIds.map((skillId) => ({ vacancyId: v.id, skillId, required: true })),
      ...nice.map((skillId) => ({ vacancyId: v.id, skillId, required: false })),
    ]);
  });
  revalidateTeam(team.id, team.eventId);
  return null;
});

export const closeVacancy = authedAction(z.object({ vacancyId: z.uuid() }), async ({ vacancyId }, user) => {
  const vacancy = await db.query.vacancies.findFirst({ where: eq(schema.vacancies.id, vacancyId) });
  if (!vacancy) fail("That spot doesn't exist anymore.");
  const team = await loadTeamAsLeader(vacancy.teamId, user);
  await db.transaction(async (tx) => {
    await tx.update(schema.vacancies).set({ status: "closed" }).where(eq(schema.vacancies.id, vacancyId));
    const rejected = await tx
      .update(schema.applications)
      .set({ status: "rejected", decidedAt: new Date() })
      .where(and(eq(schema.applications.vacancyId, vacancyId), inArray(schema.applications.status, ["pending", "shortlisted"])))
      .returning({ applicantId: schema.applications.applicantId });
    if (rejected.length) {
      await tx.insert(schema.notifications).values(
        rejected.map((r) => ({
          userId: r.applicantId,
          type: "vacancy_closed" as const,
          payload: { title: `"${vacancy.roleTitle}" at ${team.name} was closed`, href: "/me/applications" },
        })),
      );
    }
  });
  revalidateTeam(team.id, team.eventId);
  return null;
});

// ---------- applications ----------

export const applyToVacancy = authedAction(
  z.object({
    vacancyId: z.uuid(),
    message: z.string().trim().min(10, "Write a short pitch (10+ characters).").max(600),
    screeningAnswer: z.string().trim().max(600).optional(),
  }),
  async ({ vacancyId, message, screeningAnswer }, user) => {
    const vacancy = await db.query.vacancies.findFirst({
      where: eq(schema.vacancies.id, vacancyId),
      with: { skills: true },
    });
    if (!vacancy || vacancy.status !== "open") fail("This spot has been filled or closed.");
    const team = await loadTeam(vacancy.teamId);
    assertEventNotOver(team.event);
    if (team.leaderId === user.id) fail("You can't apply to your own team.");
    await assertWithinLimit("apply", user.id);
    if (vacancy.screeningQuestion && !screeningAnswer) fail("Answer the leader's question.");

    const onTeam = await db.query.teamMembers.findFirst({
      where: and(eq(schema.teamMembers.eventId, team.eventId), eq(schema.teamMembers.userId, user.id)),
    });
    if (onTeam) fail("You're already on a team for this event.");

    const sameCollege = user.collegeId !== null && user.collegeId === team.leader.collegeId;
    if (vacancy.scope === "intra" && !sameCollege) fail("This spot is only for students from the team's college.");
    if (!crossCollegeAllowed(team.event, team.leader.collegeId, user.collegeId)) {
      fail("This event requires all team members to be from the same college.");
    }

    const mySkills = await db.query.userSkills.findMany({ where: eq(schema.userSkills.userId, user.id) });
    const score = matchScore({
      requiredSkillIds: vacancy.skills.filter((s) => s.required).map((s) => s.skillId),
      niceToHaveSkillIds: vacancy.skills.filter((s) => !s.required).map((s) => s.skillId),
      applicantSkills: mySkills.map((s) => ({ skillId: s.skillId, level: s.level })),
      sameCollege,
    });

    const previous = await db.query.applications.findFirst({
      where: and(eq(schema.applications.vacancyId, vacancyId), eq(schema.applications.applicantId, user.id)),
      columns: { id: true, status: true },
    });
    if (previous && previous.status !== "withdrawn") {
      fail(previous.status === "rejected" ? "The team lead already decided on your application for this spot." : "You've already applied for this spot.");
    }

    await db.transaction(async (tx) => {
      // Applying registers you for the event (enforces deadline + eligibility).
      await ensureRegistration(tx, team.event, user);
      const fields = { message, screeningAnswer: screeningAnswer || null, matchScore: score };
      if (previous) {
        // Re-applying after a withdrawal reopens the same application (one per role).
        await tx
          .update(schema.applications)
          .set({ ...fields, status: "pending", decidedAt: null, createdAt: new Date() })
          .where(eq(schema.applications.id, previous.id));
      } else {
        await tx.insert(schema.applications).values({ vacancyId, applicantId: user.id, ...fields });
      }
      await tx.insert(schema.notifications).values({
        userId: team.leaderId,
        type: "application_new",
        payload: {
          title: `${user.name} applied for ${vacancy.roleTitle}`,
          body: `${score}% match · ${team.name}`,
          href: `/teams/${team.id}/applications`,
        },
      });
    });
    revalidateTeam(team.id, team.eventId);
    return { matchScore: score };
  },
);

export const withdrawApplication = authedAction(z.object({ applicationId: z.uuid() }), async ({ applicationId }, user) => {
  const app = await db.query.applications.findFirst({
    where: and(eq(schema.applications.id, applicationId), eq(schema.applications.applicantId, user.id)),
    with: { vacancy: { with: { team: true } } },
  });
  if (!app) fail("Application not found.");
  if (!["pending", "shortlisted"].includes(app.status)) fail("This application has already been decided.");
  await db
    .update(schema.applications)
    .set({ status: "withdrawn", decidedAt: new Date() })
    .where(eq(schema.applications.id, applicationId));
  revalidateTeam(app.vacancy.teamId, app.vacancy.team.eventId);
  return null;
});

async function loadApplicationAsLeader(applicationId: string, user: CurrentUser) {
  const app = await db.query.applications.findFirst({
    where: eq(schema.applications.id, applicationId),
    with: { vacancy: { with: { team: { with: { event: { columns: { title: true } } } } } } },
  });
  if (!app) fail("Application not found.");
  if (app.vacancy.team.leaderId !== user.id) fail("Only the team leader can review applications.");
  return app;
}

export const reviewApplication = authedAction(
  z.object({ applicationId: z.uuid(), decision: z.enum(["shortlist", "reject"]) }),
  async ({ applicationId, decision }, user) => {
    const app = await loadApplicationAsLeader(applicationId, user);
    if (!["pending", "shortlisted"].includes(app.status)) fail(`This application is already ${app.status}.`);
    await db.transaction(async (tx) => {
      await tx
        .update(schema.applications)
        .set(decision === "shortlist" ? { status: "shortlisted" } : { status: "rejected", decidedAt: new Date() })
        .where(eq(schema.applications.id, applicationId));
      if (decision === "reject") {
        await tx.insert(schema.notifications).values({
          userId: app.applicantId,
          type: "application_rejected",
          payload: {
            title: `${app.vacancy.team.name} went with someone else for ${app.vacancy.roleTitle}`,
            body: "Don't stop here — other teams are still looking.",
            href: `/events/${app.vacancy.team.eventId}?tab=teams`,
          },
        });
      }
    });
    revalidateTeam(app.vacancy.teamId, app.vacancy.team.eventId);
    return null;
  },
);

export const acceptApplication = authedAction(z.object({ applicationId: z.uuid() }), async ({ applicationId }, user) => {
  const result = await acceptApplicationTx(db, { applicationId, actorId: user.id });
  revalidatePath(`/teams/${result.teamId}`, "layout");
  revalidatePath("/me/applications");
  revalidatePath("/events", "layout");
  return result;
});

// ---------- availability ("looking for a team") ----------

export const postAvailability = authedAction(
  z.object({
    eventId: z.uuid(),
    rolesWanted: z.array(z.string().trim().min(2).max(40)).min(1, "Add at least one thing you can do.").max(5),
    note: z.string().trim().max(400).transform((v) => v || null),
    scope: z.enum(schema.teamScope.enumValues),
    hoursPerWeek: z.number().int().min(1).max(80).nullable(),
  }),
  async ({ eventId, ...input }, user) => {
    const event = await db.query.events.findFirst({ where: eq(schema.events.id, eventId) });
    if (!event) fail("Event not found.");
    assertEventNotOver(event);
    const onTeam = await db.query.teamMembers.findFirst({
      where: and(eq(schema.teamMembers.eventId, eventId), eq(schema.teamMembers.userId, user.id)),
    });
    if (onTeam) fail("You're already on a team for this event.");
    await db.transaction(async (tx) => {
      await ensureRegistration(tx, event, user);
      await tx
        .insert(schema.availabilityPosts)
        .values({ eventId, userId: user.id, ...input, status: "open" })
        .onConflictDoUpdate({
          target: [schema.availabilityPosts.eventId, schema.availabilityPosts.userId],
          set: { ...input, status: "open" },
        });
    });
    revalidatePath(`/events/${eventId}`);
    return null;
  },
);

export const closeAvailability = authedAction(z.object({ eventId: z.uuid() }), async ({ eventId }, user) => {
  await db
    .update(schema.availabilityPosts)
    .set({ status: "closed" })
    .where(and(eq(schema.availabilityPosts.eventId, eventId), eq(schema.availabilityPosts.userId, user.id)));
  revalidatePath(`/events/${eventId}`);
  return null;
});

// ---------- invites ----------

export const inviteToTeam = authedAction(
  z.object({ teamId: z.uuid(), userId: z.uuid(), message: z.string().trim().max(400).optional() }),
  async ({ teamId, userId, message }, user) => {
    const team = await loadTeamAsLeader(teamId, user);
    assertEventNotOver(team.event);
    if (userId === user.id) fail("You're already on this team.");
    await assertWithinLimit("invite", user.id);
    const target = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, userId) });
    if (!target) fail("User not found.");
    const onTeam = await db.query.teamMembers.findFirst({
      where: and(eq(schema.teamMembers.eventId, team.eventId), eq(schema.teamMembers.userId, userId)),
    });
    if (onTeam) fail(`${target.name} is already on a team for this event.`);
    if (!crossCollegeAllowed(team.event, team.leader.collegeId, target.collegeId)) {
      fail("This event requires same-college teams.");
    }
    if (target.collegeId !== team.leader.collegeId && !target.openToCrossCollege) {
      fail(`${target.name} isn't open to cross-college teams.`);
    }
    if ((await teamSize(db, teamId)) >= team.event.teamMax) fail("Your team is already full.");

    await db.transaction(async (tx) => {
      await tx.insert(schema.invites).values({ teamId, userId, invitedBy: user.id, message: message || null });
      await tx.insert(schema.notifications).values({
        userId,
        type: "team_invite",
        payload: {
          title: `${user.name} invited you to join ${team.name}`,
          body: message || team.event.title,
          href: "/me/applications",
        },
      });
    });
    revalidatePath(`/events/${team.eventId}`);
    revalidatePath("/me/applications");
    return { name: target.name };
  },
);

export const respondToInvite = authedAction(
  z.object({ inviteId: z.uuid(), accept: z.boolean() }),
  async ({ inviteId, accept }, user) => {
    const invite = await db.query.invites.findFirst({
      where: and(eq(schema.invites.id, inviteId), eq(schema.invites.userId, user.id)),
    });
    if (!invite || invite.status !== "pending") fail("This invite is no longer valid.");
    const team = await loadTeam(invite.teamId);
    assertEventNotOver(team.event);

    await db.transaction(async (tx) => {
      await tx
        .update(schema.invites)
        .set({ status: accept ? "accepted" : "declined" })
        .where(eq(schema.invites.id, inviteId));
      const notes: Array<typeof schema.notifications.$inferInsert> = [];
      if (accept) {
        // Joining requires being eligible to register for the event.
        await ensureRegistration(tx, team.event, user);
        notes.push(...(await joinTeamTx(tx, { teamId: team.id, eventId: team.eventId, userId: user.id, roleTitle: null })));
      }
      notes.push({
        userId: team.leaderId,
        type: "invite_response",
        payload: {
          title: `${user.name} ${accept ? "joined" : "declined to join"} ${team.name}`,
          href: `/teams/${team.id}`,
        },
      });
      await tx.insert(schema.notifications).values(notes);
    });
    revalidateTeam(team.id, team.eventId);
    return { teamId: accept ? team.id : null };
  },
);
