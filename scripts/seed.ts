/**
 * Seed demo data. Usage: `npm run db:seed` (add `-- --reset` to wipe app data first).
 *
 * Seed users live at `*.seed.test` addresses so no real inbox can ever receive mail for them.
 * Sign in as any of them locally through the dev-only demo login (see README).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { customAlphabet } from "nanoid";
import * as s from "../src/db/schema";
import { matchScore } from "../src/lib/match-score";

const SEED_DOMAIN_SUFFIX = ".seed.test";
const code = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 10);
const shortCode = customAlphabet("abcdefghijkmnpqrstuvwxyz23456789", 7);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url || !serviceKey || !dbUrl) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DIRECT_URL in .env.local");
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const client = postgres(dbUrl, { prepare: false, max: 1 });
const db = drizzle(client, { schema: s });

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const now = Date.now();
const at = (ms: number) => new Date(now + ms);

// ---------------- static data ----------------

const SKILLS: Array<[string, (typeof s.skillCategory.enumValues)[number]]> = [
  ["React", "frontend"], ["Next.js", "frontend"], ["TypeScript", "frontend"], ["JavaScript", "frontend"],
  ["HTML/CSS", "frontend"], ["Tailwind CSS", "frontend"], ["Vue", "frontend"],
  ["Node.js", "backend"], ["Python", "backend"], ["Django", "backend"], ["FastAPI", "backend"],
  ["Java", "backend"], ["Spring Boot", "backend"], ["Go", "backend"], ["PostgreSQL", "backend"], ["MongoDB", "backend"],
  ["React Native", "mobile"], ["Flutter", "mobile"], ["Kotlin", "mobile"], ["Swift", "mobile"],
  ["Machine Learning", "ml"], ["Deep Learning", "ml"], ["PyTorch", "ml"], ["TensorFlow", "ml"], ["NLP", "ml"],
  ["Computer Vision", "ml"], ["LLM / GenAI", "ml"],
  ["Data Analysis", "data"], ["SQL", "data"], ["Pandas", "data"],
  ["UI/UX Design", "design"], ["Figma", "design"], ["Graphic Design", "design"],
  ["Docker", "devops"], ["AWS", "devops"], ["Linux", "devops"],
  ["Cybersecurity", "security"], ["Reverse Engineering", "security"], ["Web Security", "security"],
  ["Solidity", "web3"], ["Blockchain", "web3"],
  ["Arduino", "iot"], ["Embedded C", "iot"], ["Raspberry Pi", "iot"],
  ["C++", "other"], ["DSA", "other"], ["Public Speaking", "other"], ["Product Management", "other"],
];

const COLLEGES = [
  { key: "coep", name: "COEP Technological University", city: "Pune", state: "Maharashtra", emailDomain: "coeptech.ac.in" },
  { key: "pict", name: "Pune Institute of Computer Technology", city: "Pune", state: "Maharashtra", emailDomain: "pict.edu" },
  { key: "mitwpu", name: "MIT World Peace University", city: "Pune", state: "Maharashtra", emailDomain: "mitwpu.edu.in" },
  // Out-of-city college so "Nearby" vs "All India" is demoable.
  { key: "vjti", name: "Veermata Jijabai Technological Institute", city: "Mumbai", state: "Maharashtra", emailDomain: "vjti.ac.in" },
] as const;
type CollegeKey = (typeof COLLEGES)[number]["key"];

type SeedUser = {
  handle: string;
  name: string;
  college: CollegeKey;
  year: number;
  branch: string;
  skills: Array<[string, number]>;
  cross?: boolean;
  bio?: string;
  github?: string;
};

const USERS: SeedUser[] = [
  // COEP
  { handle: "riya", name: "Riya Kulkarni", college: "coep", year: 3, branch: "Computer Engineering", skills: [["React", 4], ["Node.js", 4], ["Product Management", 3], ["Public Speaking", 4]], bio: "Tech lead, COEP AI Club. I run hackathons.", github: "https://github.com/riyak" },
  { handle: "aarav", name: "Aarav Deshmukh", college: "coep", year: 2, branch: "Computer Engineering", skills: [["Python", 3], ["Machine Learning", 2], ["Pandas", 3]], bio: "Learning ML. Looking for my first hackathon team!" },
  { handle: "neha", name: "Neha Joshi", college: "coep", year: 3, branch: "Electrical Engineering", skills: [["Python", 4], ["Arduino", 4], ["Embedded C", 3], ["Product Management", 3]], bio: "EV charging nerd." },
  { handle: "kabir", name: "Kabir Patil", college: "coep", year: 4, branch: "Computer Engineering", skills: [["Go", 4], ["PostgreSQL", 4], ["Docker", 4], ["AWS", 3]] },
  { handle: "ananya", name: "Ananya Rao", college: "coep", year: 2, branch: "Information Technology", skills: [["Figma", 4], ["UI/UX Design", 4], ["HTML/CSS", 3]] },
  { handle: "vihaan", name: "Vihaan Shah", college: "coep", year: 3, branch: "Computer Engineering", skills: [["Flutter", 4], ["Kotlin", 3], ["Python", 2]] },
  { handle: "isha", name: "Isha Bhosale", college: "coep", year: 1, branch: "Mechanical Engineering", skills: [["Python", 2], ["DSA", 2]] },
  { handle: "arjun", name: "Arjun Mehta", college: "coep", year: 3, branch: "Computer Engineering", skills: [["Cybersecurity", 4], ["Web Security", 4], ["Linux", 4], ["Reverse Engineering", 3]] },
  // PICT
  { handle: "sanya", name: "Sanya Gupta", college: "pict", year: 3, branch: "Computer Engineering", skills: [["React Native", 4], ["React", 4], ["TypeScript", 3]], bio: "Mobile dev. Shipped 2 apps on Play Store." },
  { handle: "rohan", name: "Rohan Iyer", college: "pict", year: 2, branch: "Information Technology", skills: [["Java", 4], ["Spring Boot", 3], ["SQL", 3]] },
  { handle: "meera", name: "Meera Nair", college: "pict", year: 3, branch: "Electronics & Telecom", skills: [["Deep Learning", 4], ["PyTorch", 4], ["Computer Vision", 4], ["Python", 5]] },
  { handle: "dev", name: "Dev Agarwal", college: "pict", year: 4, branch: "Computer Engineering", skills: [["Next.js", 5], ["TypeScript", 5], ["PostgreSQL", 3], ["Tailwind CSS", 4]], github: "https://github.com/devag" },
  { handle: "tanvi", name: "Tanvi Kale", college: "pict", year: 2, branch: "Computer Engineering", skills: [["Figma", 3], ["Graphic Design", 4], ["UI/UX Design", 3]] },
  { handle: "yash", name: "Yash Pawar", college: "pict", year: 1, branch: "Information Technology", skills: [["C++", 3], ["DSA", 4]] },
  { handle: "aditi", name: "Aditi Sinha", college: "pict", year: 3, branch: "Computer Engineering", skills: [["NLP", 4], ["LLM / GenAI", 4], ["FastAPI", 3], ["Python", 4]] },
  { handle: "omkar", name: "Omkar Jadhav", college: "pict", year: 3, branch: "Electronics & Telecom", skills: [["Raspberry Pi", 4], ["Arduino", 4], ["Python", 3]], cross: false },
  { handle: "pooja", name: "Pooja Reddy", college: "pict", year: 2, branch: "Computer Engineering", skills: [["Data Analysis", 4], ["SQL", 4], ["Pandas", 4]] },
  // MIT-WPU
  { handle: "karan", name: "Karan Malhotra", college: "mitwpu", year: 3, branch: "Computer Science", skills: [["Solidity", 4], ["Blockchain", 4], ["JavaScript", 4]] },
  { handle: "zara", name: "Zara Khan", college: "mitwpu", year: 2, branch: "Computer Science", skills: [["React", 3], ["JavaScript", 3], ["HTML/CSS", 4]] },
  { handle: "nikhil", name: "Nikhil Verma", college: "mitwpu", year: 4, branch: "AI & Data Science", skills: [["Machine Learning", 5], ["TensorFlow", 4], ["Python", 5], ["Data Analysis", 4]] },
  { handle: "shreya", name: "Shreya Banerjee", college: "mitwpu", year: 3, branch: "Computer Science", skills: [["Flutter", 4], ["Figma", 3]] },
  { handle: "aniket", name: "Aniket More", college: "mitwpu", year: 2, branch: "Computer Science", skills: [["Node.js", 3], ["MongoDB", 3], ["JavaScript", 3]] },
  { handle: "priya", name: "Priya Saxena", college: "mitwpu", year: 3, branch: "AI & Data Science", skills: [["LLM / GenAI", 3], ["Python", 4], ["Public Speaking", 4]] },
  { handle: "harsh", name: "Harsh Thakur", college: "mitwpu", year: 1, branch: "Computer Science", skills: [["Python", 2], ["HTML/CSS", 2]] },
  { handle: "ira", name: "Ira Kapoor", college: "mitwpu", year: 4, branch: "Computer Science", skills: [["Swift", 4], ["Kotlin", 3], ["UI/UX Design", 3]] },
  { handle: "sahil", name: "Sahil Chavan", college: "mitwpu", year: 2, branch: "Mechanical", skills: [["Arduino", 3], ["Embedded C", 3]] },
  // VJTI (Mumbai)
  { handle: "rahul", name: "Rahul Menon", college: "vjti", year: 3, branch: "Computer Engineering", skills: [["React", 4], ["Node.js", 4], ["AWS", 3]] },
  { handle: "fatima", name: "Fatima Shaikh", college: "vjti", year: 3, branch: "Information Technology", skills: [["Machine Learning", 4], ["NLP", 3], ["Python", 4]] },
  { handle: "siddharth", name: "Siddharth Rane", college: "vjti", year: 2, branch: "Electronics", skills: [["Cybersecurity", 3], ["Linux", 3]] },
  { handle: "kavya", name: "Kavya Pillai", college: "vjti", year: 4, branch: "Computer Engineering", skills: [["UI/UX Design", 5], ["Figma", 5], ["Product Management", 3]] },
];

// ---------------- helpers ----------------

/** Auth deletes from --reset can lag briefly, so retry a few times before giving up. */
async function createAuthUser(email: string, fullName: string) {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (!error) return data.user.id;
    if (attempt >= 4) throw new Error(`createUser ${email}: ${error.message}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

async function reset() {
  console.log("Resetting app data…");
  // Clear app data first so no foreign key blocks deleting seed accounts.
  await db.execute(sql`
    TRUNCATE public.announcements, public.notifications, public.endorsements, public.team_tasks,
      public.messages, public.invites, public.availability_posts, public.applications,
      public.vacancy_skills, public.vacancies, public.team_members, public.registrations,
      public.teams, public.share_link_clicks, public.share_links, public.saved_events,
      public.events, public.org_followers, public.org_members, public.organizations,
      public.user_skills, public.skills
    CASCADE`);
  // Collect first, then delete: deleting while paging shifts pages and skips users.
  const seedIds: string[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    seedIds.push(...data.users.filter((u) => u.email?.endsWith(SEED_DOMAIN_SUFFIX)).map((u) => u.id));
    if (data.users.length < 200) break;
  }
  for (const id of seedIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new Error(`deleteUser ${id}: ${error.message}`);
  }
  // Real (non-seed) users keep their profiles but lose their college link before colleges are rebuilt.
  await db.execute(sql`UPDATE public.profiles SET college_id = NULL, college_verified = false`);
  await db.execute(sql`DELETE FROM public.colleges`);
}

async function main() {
  if (process.argv.includes("--reset")) await reset();

  const existing = await db.select({ id: s.colleges.id }).from(s.colleges).limit(1);
  if (existing.length > 0) {
    console.log("Database already has data. Run `npm run db:seed -- --reset` to wipe and reseed.");
    return;
  }

  console.log("Seeding skills and colleges…");
  const skillRows = await db
    .insert(s.skills)
    .values(SKILLS.map(([name, category]) => ({ name, category })))
    .returning();
  const skill = (name: string) => {
    const row = skillRows.find((r) => r.name === name);
    if (!row) throw new Error(`Unknown skill ${name}`);
    return row.id;
  };

  const collegeRows = await db
    .insert(s.colleges)
    .values(COLLEGES.map(({ key: _key, ...c }) => ({ ...c, verified: true })))
    .returning();
  const collegeByKey = Object.fromEntries(
    COLLEGES.map((c) => [c.key, collegeRows.find((r) => r.name === c.name)!]),
  ) as Record<CollegeKey, (typeof collegeRows)[number]>;

  // Re-link any real users whose email matches a seeded college domain.
  await db.execute(sql`
    UPDATE public.profiles p SET college_id = public.college_for_email(p.email), college_verified = true
    WHERE public.college_for_email(p.email) IS NOT NULL`);

  console.log("Creating 30 seed users…");
  const userIds: Record<string, string> = {};
  for (const u of USERS) {
    const email = `${u.handle}@${u.college}${SEED_DOMAIN_SUFFIX}`;
    const id = await createAuthUser(email, u.name);
    userIds[u.handle] = id;
    await db
      .update(s.profiles)
      .set({
        username: u.handle,
        name: u.name,
        collegeId: collegeByKey[u.college].id,
        // Seed users are treated as verified so every flow is demoable.
        collegeVerified: true,
        year: u.year,
        branch: u.branch,
        bio: u.bio ?? null,
        githubUrl: u.github ?? null,
        openToCrossCollege: u.cross ?? true,
        onboardedAt: new Date(),
      })
      .where(sql`${s.profiles.id} = ${id}`);
    await db.insert(s.userSkills).values(
      u.skills.map(([name, level]) => ({ userId: id, skillId: skill(name), level })),
    );
  }
  const uid = (h: string) => {
    const id = userIds[h];
    if (!id) throw new Error(`Unknown user ${h}`);
    return id;
  };
  const collegeOf = (h: string) => collegeByKey[USERS.find((u) => u.handle === h)!.college].id;

  console.log("Creating organizations…");
  const orgs = await db
    .insert(s.organizations)
    .values([
      { slug: "coep-ai-club", name: "COEP AI Club", type: "club", collegeId: collegeByKey.coep.id, verified: true, createdBy: uid("riya"), description: "Workshops, paper-reading groups and the annual COEP AI Hackathon." },
      { slug: "pict-csi", name: "PICT CSI Student Chapter", type: "club", collegeId: collegeByKey.pict.id, verified: true, createdBy: uid("dev"), description: "Computer Society of India student chapter at PICT. Coding contests every month." },
      { slug: "mitwpu-gdg", name: "GDG on Campus MIT-WPU", type: "community", collegeId: collegeByKey.mitwpu.id, verified: true, createdBy: uid("karan"), description: "Google Developer Group on campus. Build, learn, share." },
    ])
    .returning();
  const [aiClub, csi, gdg] = orgs;
  await db.insert(s.orgMembers).values([
    { orgId: aiClub.id, userId: uid("riya"), role: "owner" },
    { orgId: aiClub.id, userId: uid("kabir"), role: "admin" },
    { orgId: csi.id, userId: uid("dev"), role: "owner" },
    { orgId: csi.id, userId: uid("yash"), role: "volunteer" },
    { orgId: gdg.id, userId: uid("karan"), role: "owner" },
    { orgId: gdg.id, userId: uid("priya"), role: "admin" },
  ]);
  await db.insert(s.orgFollowers).values(
    ["aarav", "isha", "ananya", "vihaan", "meera", "zara"].map((h) => ({ orgId: aiClub.id, userId: uid(h) })),
  );

  console.log("Creating 8 events…");
  const ev = (o: typeof aiClub, college: CollegeKey) => ({
    orgId: o.id,
    collegeId: collegeByKey[college].id,
    city: collegeByKey[college].city,
    status: "published" as const,
  });
  const eventRows = await db
    .insert(s.events)
    .values([
      {
        ...ev(aiClub, "coep"),
        title: "COEP AI Hackathon 2026",
        description: "A 24-hour hackathon on applied AI for Pune's civic problems: traffic, water, waste and public health. Beginners welcome — mentors on the floor all night.",
        type: "hackathon", domainTags: ["ai-ml", "web"], mode: "offline", venue: "COEP Main Auditorium, Shivajinagar",
        startsAt: at(14 * DAY), endsAt: at(15 * DAY), regDeadline: at(10 * DAY),
        teamMin: 2, teamMax: 4, eligibilityScope: "city", allowCrossCollege: true,
        isFree: true, prizeText: "₹50,000 pool + internships with partner startups", beginnerFriendly: true,
        rulesMd: "## Rules\n- Teams of 2–4\n- All code must be written during the event\n- Bring your college ID",
        createdBy: uid("riya"),
      },
      {
        ...ev(aiClub, "coep"),
        title: "Intro to LLM Apps — Hands-on Workshop",
        description: "Build a retrieval-augmented chatbot in 3 hours. Laptops required.",
        type: "workshop", domainTags: ["ai-ml"], mode: "offline", venue: "CSE Lab 3, COEP",
        startsAt: at(3 * DAY), endsAt: at(3 * DAY + 3 * HOUR), regDeadline: at(36 * HOUR),
        teamMin: 1, teamMax: 1, eligibilityScope: "college", allowCrossCollege: false,
        isFree: true, beginnerFriendly: true, createdBy: uid("riya"),
      },
      {
        ...ev(aiClub, "coep"),
        title: "COEP CTF Night",
        description: "Jeopardy-style capture the flag: web, crypto, forensics, pwn.",
        type: "ctf", domainTags: ["cybersecurity"], mode: "hybrid", venue: "COEP Cyber Lab / online",
        startsAt: at(20 * DAY), endsAt: at(20 * DAY + 8 * HOUR), regDeadline: at(18 * DAY),
        teamMin: 1, teamMax: 3, eligibilityScope: "college", allowCrossCollege: false,
        isFree: true, prizeText: "Swag + bragging rights", createdBy: uid("kabir"),
      },
      {
        ...ev(csi, "pict"),
        title: "PICT CodeSprint #12",
        description: "2-hour competitive programming contest. 6 problems, ICPC scoring.",
        type: "coding_contest", domainTags: ["dsa"], mode: "online",
        startsAt: at(5 * DAY), endsAt: at(5 * DAY + 2 * HOUR), regDeadline: at(30 * HOUR),
        teamMin: 1, teamMax: 1, eligibilityScope: "india", allowCrossCollege: true,
        isFree: true, prizeText: "Top 3 get ₹3,000 / ₹2,000 / ₹1,000", beginnerFriendly: false, createdBy: uid("dev"),
      },
      {
        ...ev(csi, "pict"),
        title: "Impetus Ideathon: Smart Mobility",
        description: "Pitch a solution for last-mile mobility in Pune. Teams of 2–3, slide deck + 5-minute pitch.",
        type: "ideathon", domainTags: ["iot", "app"], mode: "offline", venue: "PICT Seminar Hall",
        startsAt: at(9 * DAY), endsAt: at(9 * DAY + 6 * HOUR), regDeadline: at(7 * DAY),
        teamMin: 2, teamMax: 3, eligibilityScope: "city", allowCrossCollege: true,
        isFree: false, feeText: "₹100 per team", prizeText: "₹15,000", createdBy: uid("dev"),
      },
      {
        ...ev(gdg, "mitwpu"),
        title: "Build with AI — GDG Hackathon",
        description: "Build anything with Google's AI APIs. Official registration on Unstop; find your team here.",
        type: "hackathon", domainTags: ["ai-ml", "app", "web"], mode: "hybrid", venue: "MIT-WPU Kothrud",
        startsAt: at(25 * DAY), endsAt: at(26 * DAY), regDeadline: at(21 * DAY),
        teamMin: 2, teamMax: 4, eligibilityScope: "india", allowCrossCollege: true,
        isFree: true, prizeText: "Google swag + ₹1,00,000 pool",
        externalUrl: "https://unstop.com/", createdBy: uid("karan"),
      },
      {
        ...ev(gdg, "mitwpu"),
        title: "Flutter Forward Quiz",
        description: "Fun quiz on Flutter, Dart and mobile UX. Solo entries.",
        type: "quiz", domainTags: ["app"], mode: "online",
        startsAt: at(2 * DAY), endsAt: at(2 * DAY + 1 * HOUR), regDeadline: at(20 * HOUR),
        teamMin: 1, teamMax: 1, eligibilityScope: "india", allowCrossCollege: true,
        isFree: true, beginnerFriendly: true, createdBy: uid("priya"),
      },
      {
        // Past event — used to demo endorsements.
        ...ev(gdg, "mitwpu"),
        title: "Web3 Weekend Hack (Sept)",
        description: "48-hour Web3 hackathon. Results announced!",
        type: "hackathon", domainTags: ["web3"], mode: "offline", venue: "MIT-WPU Innovation Centre",
        startsAt: at(-30 * DAY), endsAt: at(-28 * DAY), regDeadline: at(-33 * DAY),
        teamMin: 2, teamMax: 4, eligibilityScope: "city", allowCrossCollege: true,
        isFree: true, prizeText: "₹30,000", status: "closed", registrationsOpen: false, createdBy: uid("karan"),
      },
    ])
    .returning();
  const [aiHack, llmWorkshop, , codeSprint, ideathon, gdgHack, , web3Past] = eventRows;

  await db.insert(s.shareLinks).values([
    { eventId: aiHack.id, channelLabel: "CSE 2nd-yr WhatsApp", shortCode: shortCode(), clicks: 0 },
    { eventId: aiHack.id, channelLabel: "Notice board QR", shortCode: shortCode(), clicks: 0 },
    { eventId: aiHack.id, channelLabel: "Instagram bio", shortCode: shortCode(), clicks: 0 },
  ]);
  const aiHackLinks = await db.query.shareLinks.findMany({ where: (l, { eq }) => eq(l.eventId, aiHack.id) });

  console.log("Creating teams, vacancies, applications…");
  type TeamSpec = { event: typeof aiHack; name: string; leader: string; members: string[]; pitch: string };
  const teamSpecs: TeamSpec[] = [
    { event: aiHack, name: "Signal Shifters", leader: "neha", members: ["kabir"], pitch: "Adaptive traffic-signal timing from CCTV feeds." },
    { event: aiHack, name: "AquaSense", leader: "meera", members: ["pooja"], pitch: "Predict water-pipe leaks from pressure sensor data." },
    { event: aiHack, name: "Kachra Kart", leader: "dev", members: [], pitch: "Route optimisation for ward-level waste pickup." },
    { event: ideathon, name: "LastMile Labs", leader: "omkar", members: ["rohan"], pitch: "Shared e-cycle docks at metro stations." },
    { event: gdgHack, name: "Gemini Grads", leader: "nikhil", members: ["priya"], pitch: "AI tutor for vernacular-medium engineering students." },
    { event: web3Past, name: "ChainGang", leader: "karan", members: ["zara", "aniket"], pitch: "On-chain certificates for college events." },
  ];
  const teamIds: Record<string, string> = {};
  for (const t of teamSpecs) {
    const [team] = await db
      .insert(s.teams)
      .values({ eventId: t.event.id, name: t.name, leaderId: uid(t.leader), ideaPitch: t.pitch })
      .returning();
    teamIds[t.name] = team.id;
    for (const [i, h] of [t.leader, ...t.members].entries()) {
      await db.insert(s.teamMembers).values({
        teamId: team.id,
        userId: uid(h),
        eventId: t.event.id,
        roleTitle: i === 0 ? "Leader" : null,
      });
      await db.insert(s.registrations).values({
        eventId: t.event.id,
        userId: uid(h),
        teamId: team.id,
        checkinCode: code(),
        shareLinkId: t.event.id === aiHack.id ? aiHackLinks[i % aiHackLinks.length].id : null,
        status: t.event.id === web3Past.id ? "checked_in" : "registered",
        checkedInAt: t.event.id === web3Past.id ? t.event.startsAt : null,
      });
    }
  }

  // Solo registrants for the AI hackathon and other events.
  const solo: Array<[typeof aiHack, string]> = [
    [aiHack, "aarav"], [aiHack, "isha"], [aiHack, "ananya"], [aiHack, "aditi"],
    [llmWorkshop, "aarav"], [llmWorkshop, "isha"], [llmWorkshop, "vihaan"],
    [codeSprint, "yash"], [codeSprint, "rohan"], [codeSprint, "harsh"], [codeSprint, "rahul"],
    [ideathon, "sahil"], [gdgHack, "fatima"], [gdgHack, "shreya"],
  ];
  for (const [e, h] of solo) {
    await db.insert(s.registrations).values({
      eventId: e.id,
      userId: uid(h),
      checkinCode: code(),
      shareLinkId: e.id === aiHack.id ? aiHackLinks[0].id : null,
    });
  }

  type VacancySpec = {
    team: string;
    role: string;
    required: string[];
    nice: string[];
    hours: number;
    slots: number;
    scope: "intra" | "cross";
    question?: string;
    description: string;
    applicants: Array<[string, string]>;
  };
  const vacancySpecs: VacancySpec[] = [
    {
      team: "Signal Shifters", role: "Computer Vision engineer", required: ["Python", "Computer Vision"], nice: ["PyTorch"],
      hours: 10, slots: 1, scope: "cross", question: "Link one CV project you've built.",
      description: "Detect vehicle density from intersection CCTV frames.",
      applicants: [["meera", "I've built vehicle counting with YOLO for a college project."], ["aarav", "Beginner, but I learn fast and know Python well!"]],
    },
    {
      team: "Signal Shifters", role: "UI/UX designer", required: ["Figma"], nice: ["UI/UX Design"],
      hours: 6, slots: 1, scope: "intra", description: "Design the traffic-police dashboard.",
      applicants: [["ananya", "Would love to design the dashboard — portfolio on my profile."]],
    },
    {
      team: "Kachra Kart", role: "ML / optimisation", required: ["Python", "Machine Learning"], nice: ["Data Analysis"],
      hours: 8, slots: 1, scope: "cross", description: "Vehicle-routing heuristics + demand forecasting.",
      applicants: [["aditi", "Did route optimisation in my internship."], ["nikhil", "Happy to help with forecasting."]],
    },
    {
      team: "Kachra Kart", role: "Mobile developer", required: ["React Native"], nice: ["TypeScript"],
      hours: 8, slots: 1, scope: "cross", question: "Have you published an app?",
      description: "Driver-side app for pickup routes.",
      applicants: [["sanya", "Two apps on the Play Store, both React Native."]],
    },
    {
      team: "AquaSense", role: "Hardware / IoT", required: ["Arduino"], nice: ["Embedded C", "Raspberry Pi"],
      hours: 6, slots: 1, scope: "cross", description: "Prototype a pressure-sensor node.",
      applicants: [["sahil", "Built a soil-moisture node last semester."]],
    },
    {
      team: "Gemini Grads", role: "Flutter developer", required: ["Flutter"], nice: ["Figma"],
      hours: 10, slots: 2, scope: "cross", description: "Student-facing mobile app.",
      applicants: [["shreya", "Flutter + design, can do both."], ["vihaan", "Flutter dev, COEP."]],
    },
    {
      team: "LastMile Labs", role: "Pitch & design", required: ["Public Speaking"], nice: ["Graphic Design"],
      hours: 4, slots: 1, scope: "cross", description: "Own the deck and the 5-minute pitch.",
      applicants: [],
    },
  ];

  for (const v of vacancySpecs) {
    const teamId = teamIds[v.team];
    const team = teamSpecs.find((t) => t.name === v.team)!;
    const [vac] = await db
      .insert(s.vacancies)
      .values({
        teamId, roleTitle: v.role, description: v.description, commitmentHours: v.hours,
        slotsTotal: v.slots, slotsOpen: v.slots, scope: v.scope, screeningQuestion: v.question ?? null,
      })
      .returning();
    await db.insert(s.vacancySkills).values([
      ...v.required.map((n) => ({ vacancyId: vac.id, skillId: skill(n), required: true })),
      ...v.nice.map((n) => ({ vacancyId: vac.id, skillId: skill(n), required: false })),
    ]);
    for (const [h, message] of v.applicants) {
      const user = USERS.find((u) => u.handle === h)!;
      const score = matchScore({
        requiredSkillIds: v.required.map(skill),
        niceToHaveSkillIds: v.nice.map(skill),
        applicantSkills: user.skills.map(([n, level]) => ({ skillId: skill(n), level })),
        sameCollege: collegeOf(h) === collegeOf(team.leader),
      });
      await db.insert(s.applications).values({
        vacancyId: vac.id, applicantId: uid(h), message,
        screeningAnswer: v.question ? "https://github.com/" + h : null, matchScore: score,
      });
      await db.insert(s.notifications).values({
        userId: uid(team.leader),
        type: "application_new",
        payload: { title: `${user.name} applied for ${v.role}`, href: `/teams/${teamId}/applications` },
      });
    }
  }

  await db.insert(s.availabilityPosts).values([
    { eventId: aiHack.id, userId: uid("isha"), rolesWanted: ["Python developer", "Research"], note: "First-year, eager to learn. Free on weekends.", scope: "cross", hoursPerWeek: 8 },
    { eventId: aiHack.id, userId: uid("aarav"), rolesWanted: ["ML engineer"], note: "Python + pandas, learning ML. Open to any team!", scope: "cross", hoursPerWeek: 10 },
    { eventId: gdgHack.id, userId: uid("fatima"), rolesWanted: ["ML engineer", "NLP"], note: "From VJTI Mumbai, happy to work remotely.", scope: "cross", hoursPerWeek: 12 },
    { eventId: ideathon.id, userId: uid("sahil"), rolesWanted: ["Hardware"], note: "Arduino and sensors.", scope: "cross", hoursPerWeek: 5 },
  ]);

  await db.insert(s.savedEvents).values([
    { userId: uid("aarav"), eventId: aiHack.id },
    { userId: uid("aarav"), eventId: gdgHack.id },
    { userId: uid("isha"), eventId: llmWorkshop.id },
  ]);

  await db.insert(s.messages).values([
    { teamId: teamIds["Signal Shifters"], senderId: uid("neha"), body: "Welcome Kabir! Let's sync on the data pipeline tonight." },
    { teamId: teamIds["Signal Shifters"], senderId: uid("kabir"), body: "Sounds good. I'll set up the Postgres + ingestion repo." },
  ]);
  await db.insert(s.teamTasks).values([
    { teamId: teamIds["Signal Shifters"], title: "Collect sample CCTV frames", createdBy: uid("neha") },
    { teamId: teamIds["Signal Shifters"], title: "Set up repo + CI", done: true, createdBy: uid("kabir") },
  ]);

  // Endorsements on the past event (the trigger also bumps user_skills.endorsed_count).
  await db.insert(s.endorsements).values([
    { eventId: web3Past.id, teamId: teamIds.ChainGang, fromUser: uid("zara"), toUser: uid("karan"), skillId: skill("Solidity"), note: "Wrote all the contracts." },
    { eventId: web3Past.id, teamId: teamIds.ChainGang, fromUser: uid("karan"), toUser: uid("zara"), skillId: skill("React"), note: "Clean frontend under pressure." },
  ]);

  await db.update(s.events).set({ viewCount: 342 }).where(sql`${s.events.id} = ${aiHack.id}`);
  await db.update(s.shareLinks).set({ clicks: sql`floor(random() * 80 + 20)::int` }).where(sql`${s.shareLinks.eventId} = ${aiHack.id}`);

  console.log("Done. Seed users:", USERS.map((u) => u.handle).join(", "));
}

main()
  .then(() => client.end())
  .catch(async (err) => {
    console.error(err);
    await client.end();
    process.exit(1);
  });
