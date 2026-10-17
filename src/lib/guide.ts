import "server-only";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CurrentUser } from "@/lib/auth";

export type GuideTrack = "student" | "organizer";

export type ChecklistItem = {
  id: string;
  title: string;
  why: string;
  done: boolean;
  href: string;
  cta: string;
};

/**
 * The getting-started checklist, computed from what the user has actually done — not from
 * clicks on the checklist. Each item links to the exact place (often with a tour step).
 */
export async function getChecklist(user: CurrentUser): Promise<{ track: GuideTrack; items: ChecklistItem[]; hidden: boolean }> {
  const [[skillCount], [follows], [saves], [regs], [teamOrApp], adminOrgs] = await Promise.all([
    db.select({ n: count() }).from(schema.userSkills).where(eq(schema.userSkills.userId, user.id)),
    db.select({ n: count() }).from(schema.orgFollowers).where(eq(schema.orgFollowers.userId, user.id)),
    db.select({ n: count() }).from(schema.savedEvents).where(eq(schema.savedEvents.userId, user.id)),
    db.select({ n: count() }).from(schema.registrations).where(eq(schema.registrations.userId, user.id)),
    db
      .select({
        n: sql<number>`(select count(*)::int from team_members where user_id = ${user.id})
          + (select count(*)::int from applications where applicant_id = ${user.id})
          + (select count(*)::int from availability_posts where user_id = ${user.id} and status = 'open')`,
      })
      .from(sql`(select 1) as _`),
    db
      .select({ id: schema.organizations.id, slug: schema.organizations.slug })
      .from(schema.orgMembers)
      .innerJoin(schema.organizations, eq(schema.organizations.id, schema.orgMembers.orgId))
      .where(and(eq(schema.orgMembers.userId, user.id), inArray(schema.orgMembers.role, ["owner", "admin"]))),
  ]);

  const track: GuideTrack = user.guide.track ?? (adminOrgs.length > 0 ? "organizer" : "student");
  const hidden = Boolean(user.guide.checklistHiddenAt);

  // A sensible "first club to follow": one on their campus, else any.
  const suggestedOrg = await db.query.organizations.findFirst({
    where: user.collegeId ? eq(schema.organizations.collegeId, user.collegeId) : undefined,
    columns: { slug: true },
    orderBy: asc(schema.organizations.createdAt),
  });
  // A team event to try the team board on.
  const teamEvent = await db.query.events.findFirst({
    where: and(eq(schema.events.status, "published"), sql`${schema.events.teamMax} > 1`, sql`${schema.events.regDeadline} > now()`),
    columns: { id: true },
    orderBy: asc(schema.events.regDeadline),
  });

  if (track === "organizer") {
    const orgIds = adminOrgs.map((o) => o.id);
    const [[events], [links]] = await Promise.all([
      orgIds.length ? db.select({ n: count() }).from(schema.events).where(inArray(schema.events.orgId, orgIds)) : [{ n: 0 }],
      orgIds.length
        ? db
            .select({ n: count() })
            .from(schema.shareLinks)
            .innerJoin(schema.events, eq(schema.events.id, schema.shareLinks.eventId))
            .where(inArray(schema.events.orgId, orgIds))
        : [{ n: 0 }],
    ]);
    const firstEvent = orgIds.length
      ? await db.query.events.findFirst({ where: inArray(schema.events.orgId, orgIds), columns: { id: true }, orderBy: asc(schema.events.createdAt) })
      : undefined;
    return {
      track,
      hidden,
      items: [
        {
          id: "profile",
          title: "Finish your profile",
          why: "Verified organizers get a badge on every event they post.",
          done: Boolean(user.onboardedAt && user.collegeId),
          href: "/onboarding",
          cta: "Edit profile",
        },
        {
          id: "org",
          title: "Create your club page",
          why: user.collegeVerified ? "Events are posted by a club, department or community." : "Needs a verified college email first.",
          done: adminOrgs.length > 0,
          href: adminOrgs[0] ? `/orgs/${adminOrgs[0].slug}` : "/orgs/new",
          cta: "Create club",
        },
        {
          id: "event",
          title: "Post your first event",
          why: "Takes about five minutes. Drafts stay private until you publish.",
          done: events.n > 0,
          href: "/events/new",
          cta: "Post event",
        },
        {
          id: "share",
          title: "Make a tracked share link",
          why: "One link per WhatsApp group shows which channel actually brings people in.",
          done: links.n > 0,
          href: firstEvent ? `/events/${firstEvent.id}/manage?section=share` : "/events/new",
          cta: "Open share kit",
        },
        {
          id: "checkin",
          title: "Try check-in from your phone",
          why: "Scan attendees' QR tickets at the door — no spreadsheets.",
          done: false,
          href: firstEvent ? `/events/${firstEvent.id}/manage?section=checkin&tour=manage&step=manage-tabs` : "/events/new",
          cta: "See check-in",
        },
      ].filter((i) => i.id !== "checkin" || events.n > 0),
    };
  }

  return {
    track,
    hidden,
    items: [
      {
        id: "profile",
        title: "Add your skills",
        why: "Leaders see them when you apply — and your match score depends on them.",
        done: Boolean(user.onboardedAt && user.collegeId && skillCount.n >= 3),
        href: "/onboarding",
        cta: skillCount.n ? "Add more skills" : "Add skills",
      },
      {
        id: "follow",
        title: "Follow a club",
        why: "You'll be notified the moment they post something new.",
        done: follows.n > 0,
        href: suggestedOrg ? `/orgs/${suggestedOrg.slug}` : "/",
        cta: "Find a club",
      },
      {
        id: "save",
        title: "Save an event",
        why: "We remind you 24 hours before registration closes.",
        done: saves.n > 0,
        href: "/?tour=feed&step=save",
        cta: "Show me",
      },
      {
        id: "register",
        title: "Register for something",
        why: "Your ticket and check-in code live on the event page.",
        done: regs.n > 0,
        href: "/?tour=feed&step=event-card",
        cta: "Browse events",
      },
      {
        id: "team",
        title: "Find a team",
        why: "Apply to an open role, or post that you're looking — leaders can invite you.",
        done: teamOrApp.n > 0,
        href: teamEvent ? `/events/${teamEvent.id}?tab=teams&tour=event&step=roles` : "/",
        cta: "Open a team board",
      },
    ],
  };
}
