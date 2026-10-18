/**
 * Pure registration rules, shared by the event page (to show the right state) and the
 * register action (to enforce it). See DECISIONS.md D-008.
 */
export type EligibilityEvent = {
  status: "draft" | "published" | "closed";
  registrationsOpen: boolean;
  regDeadline: Date;
  eligibilityScope: "college" | "city" | "india";
  collegeId: string | null;
  city: string | null;
};

export type EligibilityUser = {
  collegeId: string | null;
  collegeVerified: boolean;
  collegeCity: string | null;
};

export type Eligibility = { ok: true } | { ok: false; reason: string };

export function canRegister(event: EligibilityEvent, user: EligibilityUser, now = new Date()): Eligibility {
  if (event.status !== "published") return { ok: false, reason: "This event isn't open for registration." };
  if (!event.registrationsOpen) return { ok: false, reason: "The organizers have closed registrations." };
  if (now > event.regDeadline) return { ok: false, reason: "The registration deadline has passed." };
  return isEligible(event, user);
}

export function isEligible(
  event: Pick<EligibilityEvent, "eligibilityScope" | "collegeId" | "city">,
  user: EligibilityUser,
): Eligibility {
  switch (event.eligibilityScope) {
    case "india":
      return { ok: true };
    case "college":
      if (user.collegeId !== event.collegeId) {
        return { ok: false, reason: "Only students of the host college can register." };
      }
      if (!user.collegeVerified) {
        return { ok: false, reason: "Verify your campus to register for this campus-only event — college email, student ID or classmate vouches." };
      }
      return { ok: true };
    case "city":
      if (!user.collegeCity || !event.city || user.collegeCity.toLowerCase() !== event.city.toLowerCase()) {
        return { ok: false, reason: `Only students from colleges in ${event.city ?? "the host city"} can register.` };
      }
      return { ok: true };
  }
}

/** Can a team led by `leaderCollegeId` include `memberCollegeId` for this event? */
export function crossCollegeAllowed(
  event: { allowCrossCollege: boolean },
  leaderCollegeId: string | null,
  memberCollegeId: string | null,
) {
  return event.allowCrossCollege || (leaderCollegeId !== null && leaderCollegeId === memberCollegeId);
}
