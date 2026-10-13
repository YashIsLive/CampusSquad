import { describe, expect, it } from "vitest";
import { matchScore } from "@/lib/match-score";

const s = (skillId: string, level = 3) => ({ skillId, level });

describe("matchScore", () => {
  it("gives 100 for all required + all nice-to-have + same college", () => {
    expect(
      matchScore({
        requiredSkillIds: ["react", "node"],
        niceToHaveSkillIds: ["figma"],
        applicantSkills: [s("react"), s("node"), s("figma")],
        sameCollege: true,
      }),
    ).toBe(100);
  });

  it("weights required skills at 80 points, proportionally", () => {
    expect(
      matchScore({
        requiredSkillIds: ["react", "node"],
        niceToHaveSkillIds: [],
        applicantSkills: [s("react")],
        sameCollege: false,
      }),
    ).toBe(40);
  });

  it("adds up to 15 for nice-to-haves and 5 for same college", () => {
    expect(
      matchScore({
        requiredSkillIds: ["py"],
        niceToHaveSkillIds: ["torch", "cv"],
        applicantSkills: [s("py"), s("torch")],
        sameCollege: true,
      }),
    ).toBe(80 + 8 + 5); // 7.5 rounds with the total
  });

  it("ignores skills below the minimum level", () => {
    expect(
      matchScore({
        requiredSkillIds: ["react"],
        niceToHaveSkillIds: [],
        applicantSkills: [s("react", 1)],
        sameCollege: false,
      }),
    ).toBe(0);
  });

  it("treats no required skills as a full required score", () => {
    expect(matchScore({ requiredSkillIds: [], niceToHaveSkillIds: [], applicantSkills: [], sameCollege: false })).toBe(80);
  });

  it("does not double count a skill listed as both required and nice-to-have", () => {
    expect(
      matchScore({
        requiredSkillIds: ["react"],
        niceToHaveSkillIds: ["react"],
        applicantSkills: [s("react")],
        sameCollege: false,
      }),
    ).toBe(80);
  });

  it("ignores duplicate ids and unrelated applicant skills", () => {
    expect(
      matchScore({
        requiredSkillIds: ["a", "a", "b"],
        niceToHaveSkillIds: [],
        applicantSkills: [s("a"), s("zzz", 5)],
        sameCollege: false,
      }),
    ).toBe(40);
  });

  it("is always within 0–100", () => {
    const score = matchScore({
      requiredSkillIds: ["a"],
      niceToHaveSkillIds: ["b"],
      applicantSkills: [s("a", 5), s("b", 5)],
      sameCollege: true,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
