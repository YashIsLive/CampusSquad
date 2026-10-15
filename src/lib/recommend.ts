import { matchScore, type ApplicantSkill } from "@/lib/match-score";

export type OpenRole = {
  id: string;
  roleTitle: string;
  scope: "intra" | "cross";
  requiredSkillIds: string[];
  niceSkillIds: string[];
};

export type Candidate = {
  userId: string;
  collegeId: string | null;
  openToCrossCollege: boolean;
  skills: ApplicantSkill[];
  /** "looking" = posted a looking-for-a-team card; "solo" = registered without a team. */
  source: "looking" | "solo";
};

export type Suggestion = { candidate: Candidate; roleId: string; roleTitle: string; score: number };

export const MIN_SUGGESTION_SCORE = 40;

/**
 * Rank people a team leader could invite: each candidate's best-matching open role, keeping only
 * pairings the cross-college rules allow. People actively "looking" win ties. Rule-based for now;
 * same interface could later sit on top of embeddings.
 */
export function suggestTeammates({
  roles,
  candidates,
  leaderCollegeId,
  allowCrossCollege,
  limit = 5,
}: {
  roles: OpenRole[];
  candidates: Candidate[];
  leaderCollegeId: string | null;
  allowCrossCollege: boolean;
  limit?: number;
}): Suggestion[] {
  const out: Suggestion[] = [];
  for (const c of candidates) {
    const sameCollege = leaderCollegeId !== null && c.collegeId === leaderCollegeId;
    let best: Suggestion | null = null;
    for (const r of roles) {
      const crossOk = allowCrossCollege && r.scope === "cross" && c.openToCrossCollege;
      if (!sameCollege && !crossOk) continue;
      const score = matchScore({
        requiredSkillIds: r.requiredSkillIds,
        niceToHaveSkillIds: r.niceSkillIds,
        applicantSkills: c.skills,
        sameCollege,
      });
      if (score >= MIN_SUGGESTION_SCORE && (!best || score > best.score)) {
        best = { candidate: c, roleId: r.id, roleTitle: r.roleTitle, score };
      }
    }
    if (best) out.push(best);
  }
  return out
    .sort((a, b) => b.score - a.score || Number(b.candidate.source === "looking") - Number(a.candidate.source === "looking"))
    .slice(0, limit);
}
