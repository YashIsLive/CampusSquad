import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ---------- enums ----------

export const skillCategory = pgEnum("skill_category", [
  "frontend",
  "backend",
  "mobile",
  "ml",
  "data",
  "design",
  "devops",
  "security",
  "web3",
  "iot",
  "other",
]);
export const orgType = pgEnum("org_type", ["club", "department", "community", "company"]);
export const orgRole = pgEnum("org_role", ["owner", "admin", "volunteer"]);
export const eventType = pgEnum("event_type", [
  "hackathon",
  "quiz",
  "coding_contest",
  "workshop",
  "ideathon",
  "ctf",
]);
export const eventMode = pgEnum("event_mode", ["offline", "online", "hybrid"]);
export const eligibilityScope = pgEnum("eligibility_scope", ["college", "city", "india"]);
export const eventStatus = pgEnum("event_status", ["draft", "published", "closed"]);
export const registrationStatus = pgEnum("registration_status", [
  "registered",
  "waitlisted",
  "checked_in",
  "no_show",
  "cancelled",
]);
export const teamScope = pgEnum("team_scope", ["intra", "cross"]);
export const vacancyStatus = pgEnum("vacancy_status", ["open", "filled", "closed"]);
export const applicationStatus = pgEnum("application_status", [
  "pending",
  "shortlisted",
  "accepted",
  "rejected",
  "withdrawn",
]);
export const openClosed = pgEnum("open_closed", ["open", "closed"]);
export const inviteStatus = pgEnum("invite_status", ["pending", "accepted", "declined", "cancelled"]);
export const notificationType = pgEnum("notification_type", [
  "application_new",
  "application_accepted",
  "application_rejected",
  "vacancy_closed",
  "team_invite",
  "invite_response",
  "announcement",
  "event_closing",
  "new_event",
  "team_nudge",
  "event_reminder",
]);
export const reminderKind = pgEnum("reminder_kind", ["h72", "h24", "h2"]);

// ---------- tables ----------

export const colleges = pgTable("colleges", {
  id: id(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  emailDomain: text("email_domain").unique(),
  verified: boolean("verified").notNull().default(false),
  createdAt: createdAt(),
});

/** Blueprint's `users`. `id` equals `auth.users.id`; a DB trigger creates the row on signup. */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    username: text("username").notNull().unique(),
    name: text("name").notNull().default(""),
    email: text("email").notNull(),
    avatarUrl: text("avatar_url"),
    collegeId: uuid("college_id").references(() => colleges.id),
    collegeVerified: boolean("college_verified").notNull().default(false),
    year: smallint("year"),
    branch: text("branch"),
    bio: text("bio"),
    githubUrl: text("github_url"),
    linkedinUrl: text("linkedin_url"),
    openToCrossCollege: boolean("open_to_cross_college").notNull().default(true),
    reliabilityScore: numeric("reliability_score", { precision: 5, scale: 2 }).notNull().default("100"),
    isAdmin: boolean("is_admin").notNull().default(false),
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    /** First-run guide progress: which page tours were seen, and whether the checklist was hidden. */
    guide: jsonb("guide").$type<GuideState>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("profiles_college_idx").on(t.collegeId)],
);

export const skills = pgTable("skills", {
  id: id(),
  name: text("name").notNull().unique(),
  category: skillCategory("category").notNull().default("other"),
});

export const userSkills = pgTable(
  "user_skills",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    level: smallint("level").notNull().default(3),
    evidenceUrl: text("evidence_url"),
    endorsedCount: integer("endorsed_count").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.skillId] }),
    check("user_skills_level_check", sql`${t.level} between 1 and 5`),
  ],
);

export const organizations = pgTable("organizations", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  type: orgType("type").notNull().default("club"),
  collegeId: uuid("college_id").references(() => colleges.id),
  description: text("description"),
  logoUrl: text("logo_url"),
  verified: boolean("verified").notNull().default(false),
  createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const orgMembers = pgTable(
  "org_members",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: orgRole("role").notNull().default("admin"),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })],
);

export const orgFollowers = pgTable(
  "org_followers",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })],
);

export const events = pgTable(
  "events",
  {
    id: id(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    type: eventType("type").notNull(),
    domainTags: text("domain_tags").array().notNull().default(sql`'{}'::text[]`),
    mode: eventMode("mode").notNull(),
    venue: text("venue"),
    /** Copied from the org's college at creation; drives the "Nearby" feed. */
    city: text("city"),
    /** Copied from the org at creation; drives "My campus" and college eligibility. */
    collegeId: uuid("college_id").references(() => colleges.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    regDeadline: timestamp("reg_deadline", { withTimezone: true }).notNull(),
    teamMin: smallint("team_min").notNull().default(1),
    teamMax: smallint("team_max").notNull().default(1),
    eligibilityScope: eligibilityScope("eligibility_scope").notNull().default("india"),
    allowCrossCollege: boolean("allow_cross_college").notNull().default(true),
    isFree: boolean("is_free").notNull().default(true),
    feeText: text("fee_text"),
    prizeText: text("prize_text"),
    rulesMd: text("rules_md"),
    posterUrl: text("poster_url"),
    externalUrl: text("external_url"),
    beginnerFriendly: boolean("beginner_friendly").notNull().default(false),
    status: eventStatus("status").notNull().default("draft"),
    registrationsOpen: boolean("registrations_open").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    viewCount: integer("view_count").notNull().default(0),
    /** First time the event went live; followers are notified once, when this is set. */
    publishedAt: timestamp("published_at", { withTimezone: true }),
    soloNudgedAt: timestamp("solo_nudged_at", { withTimezone: true }),
    /** Set when organizers finalize attendance; unchecked registrants become no-shows. */
    attendanceFinalizedAt: timestamp("attendance_finalized_at", { withTimezone: true }),
    search: tsvector("search").generatedAlwaysAs(
      sql`to_tsvector('english'::regconfig, coalesce(title, '') || ' ' || coalesce(description, ''))`,
    ),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("events_team_size_check", sql`${t.teamMin} >= 1 and ${t.teamMin} <= ${t.teamMax}`),
    check(
      "events_dates_check",
      sql`${t.regDeadline} <= ${t.endsAt} and ${t.startsAt} <= ${t.endsAt}`,
    ),
    index("events_search_idx").using("gin", t.search),
    index("events_status_deadline_idx").on(t.status, t.regDeadline),
    index("events_college_idx").on(t.collegeId),
    index("events_city_idx").on(t.city),
  ],
);

export const savedEvents = pgTable(
  "saved_events",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    closingNotifiedAt: timestamp("closing_notified_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.eventId] })],
);

export const shareLinks = pgTable("share_links", {
  id: id(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  channelLabel: text("channel_label").notNull(),
  shortCode: text("short_code").notNull().unique(),
  clicks: integer("clicks").notNull().default(0),
  createdAt: createdAt(),
});

export const shareLinkClicks = pgTable(
  "share_link_clicks",
  {
    id: id(),
    shareLinkId: uuid("share_link_id")
      .notNull()
      .references(() => shareLinks.id, { onDelete: "cascade" }),
    userAgentHash: text("user_agent_hash"),
    clickedAt: timestamp("clicked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("share_link_clicks_link_idx").on(t.shareLinkId)],
);

export const teams = pgTable(
  "teams",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    leaderId: uuid("leader_id")
      .notNull()
      .references(() => profiles.id),
    ideaPitch: text("idea_pitch"),
    isOpen: boolean("is_open").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("teams_event_name_uq").on(t.eventId, sql`lower(${t.name})`)],
);

export const registrations = pgTable(
  "registrations",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    formAnswers: jsonb("form_answers").$type<Record<string, string>>(),
    shareLinkId: uuid("share_link_id").references(() => shareLinks.id, { onDelete: "set null" }),
    status: registrationStatus("status").notNull().default("registered"),
    checkinCode: text("checkin_code").notNull().unique(),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("registrations_event_user_uq").on(t.eventId, t.userId),
    index("registrations_team_idx").on(t.teamId),
  ],
);

export const teamMembers = pgTable(
  "team_members",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /** Denormalized from teams.event_id (set by trigger) so one index enforces one-team-per-event. */
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    roleTitle: text("role_title"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.userId] }),
    uniqueIndex("team_members_event_user_uq").on(t.eventId, t.userId),
  ],
);

export const vacancies = pgTable(
  "vacancies",
  {
    id: id(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    roleTitle: text("role_title").notNull(),
    description: text("description"),
    commitmentHours: smallint("commitment_hours"),
    slotsTotal: smallint("slots_total").notNull().default(1),
    slotsOpen: smallint("slots_open").notNull().default(1),
    scope: teamScope("scope").notNull().default("cross"),
    screeningQuestion: text("screening_question"),
    status: vacancyStatus("status").notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [
    check("vacancies_slots_check", sql`${t.slotsOpen} >= 0 and ${t.slotsOpen} <= ${t.slotsTotal}`),
    index("vacancies_team_idx").on(t.teamId),
  ],
);

export const vacancySkills = pgTable(
  "vacancy_skills",
  {
    vacancyId: uuid("vacancy_id")
      .notNull()
      .references(() => vacancies.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    required: boolean("required").notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.vacancyId, t.skillId] })],
);

export const applications = pgTable(
  "applications",
  {
    id: id(),
    vacancyId: uuid("vacancy_id")
      .notNull()
      .references(() => vacancies.id, { onDelete: "cascade" }),
    applicantId: uuid("applicant_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    message: text("message").notNull().default(""),
    screeningAnswer: text("screening_answer"),
    matchScore: smallint("match_score").notNull().default(0),
    status: applicationStatus("status").notNull().default("pending"),
    createdAt: createdAt(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("applications_vacancy_applicant_uq").on(t.vacancyId, t.applicantId),
    index("applications_applicant_idx").on(t.applicantId),
  ],
);

export const availabilityPosts = pgTable(
  "availability_posts",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    rolesWanted: text("roles_wanted").array().notNull().default(sql`'{}'::text[]`),
    note: text("note"),
    scope: teamScope("scope").notNull().default("cross"),
    hoursPerWeek: smallint("hours_per_week"),
    status: openClosed("status").notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("availability_event_user_uq").on(t.eventId, t.userId)],
);

export const invites = pgTable(
  "invites",
  {
    id: id(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => profiles.id),
    message: text("message"),
    status: inviteStatus("status").notNull().default("pending"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("invites_pending_uq")
      .on(t.teamId, t.userId)
      .where(sql`${t.status} = 'pending'`),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("messages_team_created_idx").on(t.teamId, t.createdAt)],
);

export const teamTasks = pgTable("team_tasks", {
  id: id(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  done: boolean("done").notNull().default(false),
  createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const endorsements = pgTable(
  "endorsements",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    fromUser: uuid("from_user")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    toUser: uuid("to_user")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("endorsements_uq").on(t.eventId, t.fromUser, t.toUser, t.skillId),
    check("endorsements_not_self", sql`${t.fromUser} <> ${t.toUser}`),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    payload: jsonb("payload").$type<NotificationPayload>().notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_created_idx").on(t.userId, t.createdAt)],
);

export type GuideState = {
  tours?: Partial<Record<"feed" | "event" | "team" | "manage", string>>;
  checklistHiddenAt?: string;
  track?: "student" | "organizer";
};

export type NotificationPayload = {
  title: string;
  body?: string;
  href?: string;
};

/** One row per reminder sent, so each 72 h / 24 h / 2 h reminder goes out once per registration. */
export const reminderLog = pgTable(
  "reminder_log",
  {
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    kind: reminderKind("kind").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.registrationId, t.kind] })],
);

export const announcements = pgTable("announcements", {
  id: id(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => profiles.id),
  body: text("body").notNull(),
  createdAt: createdAt(),
});

// ---------- relations (for db.query.* relational reads) ----------

export const collegesRelations = relations(colleges, ({ many }) => ({
  profiles: many(profiles),
  organizations: many(organizations),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  college: one(colleges, { fields: [profiles.collegeId], references: [colleges.id] }),
  skills: many(userSkills),
  teamMemberships: many(teamMembers),
  registrations: many(registrations),
}));

export const skillsRelations = relations(skills, ({ many }) => ({
  users: many(userSkills),
}));

export const userSkillsRelations = relations(userSkills, ({ one }) => ({
  user: one(profiles, { fields: [userSkills.userId], references: [profiles.id] }),
  skill: one(skills, { fields: [userSkills.skillId], references: [skills.id] }),
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  college: one(colleges, { fields: [organizations.collegeId], references: [colleges.id] }),
  members: many(orgMembers),
  followers: many(orgFollowers),
  events: many(events),
}));

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  org: one(organizations, { fields: [orgMembers.orgId], references: [organizations.id] }),
  user: one(profiles, { fields: [orgMembers.userId], references: [profiles.id] }),
}));

export const orgFollowersRelations = relations(orgFollowers, ({ one }) => ({
  org: one(organizations, { fields: [orgFollowers.orgId], references: [organizations.id] }),
  user: one(profiles, { fields: [orgFollowers.userId], references: [profiles.id] }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  org: one(organizations, { fields: [events.orgId], references: [organizations.id] }),
  college: one(colleges, { fields: [events.collegeId], references: [colleges.id] }),
  registrations: many(registrations),
  teams: many(teams),
  shareLinks: many(shareLinks),
  availabilityPosts: many(availabilityPosts),
}));

export const savedEventsRelations = relations(savedEvents, ({ one }) => ({
  event: one(events, { fields: [savedEvents.eventId], references: [events.id] }),
  user: one(profiles, { fields: [savedEvents.userId], references: [profiles.id] }),
}));

export const registrationsRelations = relations(registrations, ({ one }) => ({
  event: one(events, { fields: [registrations.eventId], references: [events.id] }),
  user: one(profiles, { fields: [registrations.userId], references: [profiles.id] }),
  team: one(teams, { fields: [registrations.teamId], references: [teams.id] }),
  shareLink: one(shareLinks, { fields: [registrations.shareLinkId], references: [shareLinks.id] }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  event: one(events, { fields: [teams.eventId], references: [events.id] }),
  leader: one(profiles, { fields: [teams.leaderId], references: [profiles.id] }),
  members: many(teamMembers),
  vacancies: many(vacancies),
  tasks: many(teamTasks),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(profiles, { fields: [teamMembers.userId], references: [profiles.id] }),
}));

export const vacanciesRelations = relations(vacancies, ({ one, many }) => ({
  team: one(teams, { fields: [vacancies.teamId], references: [teams.id] }),
  skills: many(vacancySkills),
  applications: many(applications),
}));

export const vacancySkillsRelations = relations(vacancySkills, ({ one }) => ({
  vacancy: one(vacancies, { fields: [vacancySkills.vacancyId], references: [vacancies.id] }),
  skill: one(skills, { fields: [vacancySkills.skillId], references: [skills.id] }),
}));

export const applicationsRelations = relations(applications, ({ one }) => ({
  vacancy: one(vacancies, { fields: [applications.vacancyId], references: [vacancies.id] }),
  applicant: one(profiles, { fields: [applications.applicantId], references: [profiles.id] }),
}));

export const availabilityPostsRelations = relations(availabilityPosts, ({ one }) => ({
  event: one(events, { fields: [availabilityPosts.eventId], references: [events.id] }),
  user: one(profiles, { fields: [availabilityPosts.userId], references: [profiles.id] }),
}));

export const invitesRelations = relations(invites, ({ one }) => ({
  team: one(teams, { fields: [invites.teamId], references: [teams.id] }),
  user: one(profiles, { fields: [invites.userId], references: [profiles.id] }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  team: one(teams, { fields: [messages.teamId], references: [teams.id] }),
  sender: one(profiles, { fields: [messages.senderId], references: [profiles.id] }),
}));

export const teamTasksRelations = relations(teamTasks, ({ one }) => ({
  team: one(teams, { fields: [teamTasks.teamId], references: [teams.id] }),
}));

export const shareLinksRelations = relations(shareLinks, ({ one, many }) => ({
  event: one(events, { fields: [shareLinks.eventId], references: [events.id] }),
  clicksLog: many(shareLinkClicks),
}));

export const shareLinkClicksRelations = relations(shareLinkClicks, ({ one }) => ({
  shareLink: one(shareLinks, { fields: [shareLinkClicks.shareLinkId], references: [shareLinks.id] }),
}));

export const endorsementsRelations = relations(endorsements, ({ one }) => ({
  skill: one(skills, { fields: [endorsements.skillId], references: [skills.id] }),
  from: one(profiles, { fields: [endorsements.fromUser], references: [profiles.id] }),
  to: one(profiles, { fields: [endorsements.toUser], references: [profiles.id] }),
}));

export const announcementsRelations = relations(announcements, ({ one }) => ({
  event: one(events, { fields: [announcements.eventId], references: [events.id] }),
}));
