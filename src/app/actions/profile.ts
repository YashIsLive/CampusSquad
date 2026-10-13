"use server";

import { revalidatePath } from "next/cache";
import { and, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { authedAction, fail } from "@/lib/actions";
import { emailMatchesDomain } from "@/lib/college";

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .transform((v) => v || null)
  .pipe(z.url("Enter a full URL starting with https://").nullable());

const profileSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name.").max(80),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9_]{3,24}$/, "Username: 3–24 characters, letters, numbers or _."),
    collegeId: z.uuid().nullable(),
    newCollege: z
      .object({
        name: z.string().trim().min(3, "Enter the college name.").max(120),
        city: z.string().trim().min(2, "Enter the city.").max(60),
        state: z.string().trim().min(2, "Enter the state.").max(60),
      })
      .nullable(),
    year: z.coerce.number().int().min(1).max(6).nullable(),
    branch: z.string().trim().max(80).transform((v) => v || null),
    bio: z.string().trim().max(500).transform((v) => v || null),
    githubUrl: optionalUrl,
    linkedinUrl: optionalUrl,
    openToCrossCollege: z.boolean(),
    skills: z
      .array(z.object({ skillId: z.uuid(), level: z.number().int().min(1).max(5) }))
      .max(25, "Pick up to 25 skills."),
    avatarUrl: z.url().nullable().optional(),
  })
  .refine((v) => !(v.collegeId && v.newCollege), { message: "Pick a college or request a new one, not both." });

export type ProfileInput = z.input<typeof profileSchema>;

export const saveProfile = authedAction(
  profileSchema,
  async (input, user) => {
    const clash = await db.query.profiles.findFirst({
      where: (p, { and, eq, ne }) => and(eq(p.username, input.username), ne(p.id, user.id)),
      columns: { id: true },
    });
    if (clash) fail("That username is taken.");

    await db.transaction(async (tx) => {
      let collegeId = input.collegeId;
      let verified = false;

      if (input.newCollege) {
        // Requested colleges start unverified and without an email domain, so nobody gets a badge
        // until an admin confirms the domain.
        const [c] = await tx
          .insert(schema.colleges)
          .values({ ...input.newCollege, verified: false })
          .returning({ id: schema.colleges.id });
        collegeId = c.id;
      } else if (collegeId) {
        const college = await tx.query.colleges.findFirst({ where: eq(schema.colleges.id, collegeId) });
        if (!college) fail("That college doesn't exist.");
        verified = Boolean(college.emailDomain && emailMatchesDomain(user.email, college.emailDomain));
      }

      await tx
        .update(schema.profiles)
        .set({
          name: input.name,
          username: input.username,
          collegeId,
          collegeVerified: verified,
          year: input.year,
          branch: input.branch,
          bio: input.bio,
          githubUrl: input.githubUrl,
          linkedinUrl: input.linkedinUrl,
          openToCrossCollege: input.openToCrossCollege,
          ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
          onboardedAt: user.onboardedAt ?? new Date(),
        })
        .where(eq(schema.profiles.id, user.id));

      // Upsert skills, keeping endorsement counts for skills the user keeps.
      const keep = input.skills.map((s) => s.skillId);
      await tx
        .delete(schema.userSkills)
        .where(
          keep.length
            ? and(eq(schema.userSkills.userId, user.id), notInArray(schema.userSkills.skillId, keep))
            : eq(schema.userSkills.userId, user.id),
        );
      for (const s of input.skills) {
        await tx
          .insert(schema.userSkills)
          .values({ userId: user.id, skillId: s.skillId, level: s.level })
          .onConflictDoUpdate({
            target: [schema.userSkills.userId, schema.userSkills.skillId],
            set: { level: s.level },
          });
      }
    });

    revalidatePath("/", "layout");
    return { username: input.username };
  },
  { allowUnonboarded: true },
);
