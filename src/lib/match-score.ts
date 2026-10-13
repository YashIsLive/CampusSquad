/**
 * Rule-based applicant ↔ vacancy match score (0–100).
 *
 * Kept as a pure function so it can be swapped for an embedding/AI ranker later
 * without touching callers.
 *
 *   80 × (required skills held / required count)      — 80 if the vacancy lists none
 * + 15 × (nice-to-have skills held / nice-to-have count) — 0 if it lists none
 * +  5 if applicant and team leader are from the same college
 *
 * A skill counts as "held" at level ≥ MIN_LEVEL_HELD.
 */
export const MIN_LEVEL_HELD = 2;

export type ApplicantSkill = { skillId: string; level: number };

export type MatchInput = {
  requiredSkillIds: string[];
  niceToHaveSkillIds: string[];
  applicantSkills: ApplicantSkill[];
  sameCollege: boolean;
};

export function matchScore({
  requiredSkillIds,
  niceToHaveSkillIds,
  applicantSkills,
  sameCollege,
}: MatchInput): number {
  const held = new Set(
    applicantSkills.filter((s) => s.level >= MIN_LEVEL_HELD).map((s) => s.skillId),
  );
  const required = unique(requiredSkillIds);
  const nice = unique(niceToHaveSkillIds).filter((id) => !required.includes(id));

  const requiredPart = required.length === 0 ? 80 : (80 * countHeld(required, held)) / required.length;
  const nicePart = nice.length === 0 ? 0 : (15 * countHeld(nice, held)) / nice.length;
  const collegePart = sameCollege ? 5 : 0;

  return Math.max(0, Math.min(100, Math.round(requiredPart + nicePart + collegePart)));
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

function countHeld(ids: string[], held: Set<string>): number {
  return ids.filter((id) => held.has(id)).length;
}
