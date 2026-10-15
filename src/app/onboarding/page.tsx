import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Your profile" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const user = await requireUser({ allowUnonboarded: true, next: "/onboarding" });
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : null;

  const [colleges, skills, mySkills] = await Promise.all([
    db.select().from(schema.colleges).orderBy(asc(schema.colleges.name)),
    db.select().from(schema.skills).orderBy(asc(schema.skills.name)),
    db.select().from(schema.userSkills).where(eq(schema.userSkills.userId, user.id)),
  ]);

  const firstTime = !user.onboardedAt;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      <h1 className="text-3xl font-extrabold sm:text-4xl">{firstTime ? "Set up your profile" : "Edit profile"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {firstTime
          ? "Teams use this to decide who to invite. Takes about a minute."
          : "Your skills and links are visible to team leaders when you apply."}
      </p>
      <ProfileForm
        userId={user.id}
        email={user.email}
        next={next}
        colleges={colleges.map((c) => ({ id: c.id, name: c.name, city: c.city, emailDomain: c.emailDomain }))}
        skills={skills.map((s) => ({ id: s.id, name: s.name, category: s.category }))}
        initial={{
          name: user.name,
          username: user.username,
          collegeId: user.collegeId,
          year: user.year,
          branch: user.branch ?? "",
          bio: user.bio ?? "",
          githubUrl: user.githubUrl ?? "",
          linkedinUrl: user.linkedinUrl ?? "",
          openToCrossCollege: user.openToCrossCollege,
          skills: mySkills.map((s) => ({ skillId: s.skillId, level: s.level })),
          avatarUrl: user.avatarUrl,
        }}
      />
    </div>
  );
}
