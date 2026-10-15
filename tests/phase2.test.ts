import { describe, expect, it } from "vitest";
import { githubUsername, levelFromRepoCount, skillsFromRepos } from "@/lib/github";
import { reliabilityScore } from "@/lib/reliability";
import { dueReminder, remindersCoveredBy } from "@/lib/reminder-schedule";
import { suggestTeammates, type Candidate, type OpenRole } from "@/lib/recommend";

describe("reliabilityScore", () => {
  it("starts newcomers at 100", () => expect(reliabilityScore(0, 0)).toBe(100));
  it("doesn't zero someone out for one no-show", () => expect(reliabilityScore(0, 1)).toBe(50));
  it("rewards a track record", () => {
    expect(reliabilityScore(4, 1)).toBe(83);
    expect(reliabilityScore(9, 0)).toBe(100);
  });
  it("rejects negative counts", () => expect(() => reliabilityScore(-1, 0)).toThrow(RangeError));
});

describe("event reminders", () => {
  const start = new Date("2026-10-20T10:00:00Z");
  const hoursBefore = (h: number) => new Date(start.getTime() - h * 3_600_000);

  it("picks the tightest window", () => {
    expect(dueReminder(start, hoursBefore(100))).toBeNull();
    expect(dueReminder(start, hoursBefore(72))).toBe("h72");
    expect(dueReminder(start, hoursBefore(30))).toBe("h72");
    expect(dueReminder(start, hoursBefore(24))).toBe("h24");
    expect(dueReminder(start, hoursBefore(3))).toBe("h24");
    expect(dueReminder(start, hoursBefore(1.5))).toBe("h2");
  });

  it("sends nothing once the event has started", () => {
    expect(dueReminder(start, hoursBefore(0))).toBeNull();
    expect(dueReminder(start, hoursBefore(-1))).toBeNull();
  });

  it("a tighter reminder covers the looser ones", () => {
    expect(remindersCoveredBy("h2")).toEqual(["h2", "h24", "h72"]);
    expect(remindersCoveredBy("h24")).toEqual(["h24", "h72"]);
    expect(remindersCoveredBy("h72")).toEqual(["h72"]);
  });
});

describe("GitHub skill import", () => {
  it("parses profile URLs", () => {
    expect(githubUsername("https://github.com/octo-cat")).toBe("octo-cat");
    expect(githubUsername("https://www.github.com/octocat/hello-world")).toBe("octocat");
    expect(githubUsername("https://gitlab.com/octocat")).toBeNull();
    expect(githubUsername("not a url")).toBeNull();
  });

  it("maps languages to skills, ignoring forks, most-used first", () => {
    const repos = [
      { language: "TypeScript", fork: false },
      { language: "TypeScript", fork: false },
      { language: "Jupyter Notebook", fork: false },
      { language: "Python", fork: false },
      { language: "Rust", fork: false }, // no matching skill
      { language: "Go", fork: true }, // forks don't count
      { language: null, fork: false },
    ];
    expect(skillsFromRepos(repos)).toEqual([
      { skill: "Python", repos: 2, level: 3 },
      { skill: "TypeScript", repos: 2, level: 3 },
      { skill: "Data Analysis", repos: 1, level: 2 },
    ]);
  });

  it("scales level with repo count", () => {
    expect([1, 2, 4, 5, 20].map(levelFromRepoCount)).toEqual([2, 3, 3, 4, 4]);
  });
});

describe("suggestTeammates", () => {
  const roles: OpenRole[] = [
    { id: "ml", roleTitle: "ML engineer", scope: "cross", requiredSkillIds: ["py", "ml"], niceSkillIds: ["cv"] },
    { id: "ui", roleTitle: "Designer", scope: "intra", requiredSkillIds: ["figma"], niceSkillIds: [] },
  ];
  const person = (userId: string, collegeId: string, skills: string[], extra: Partial<Candidate> = {}): Candidate => ({
    userId,
    collegeId,
    openToCrossCollege: true,
    skills: skills.map((skillId) => ({ skillId, level: 3 })),
    source: "solo",
    ...extra,
  });

  it("ranks by best role fit and drops weak matches", () => {
    const out = suggestTeammates({
      roles,
      leaderCollegeId: "coep",
      allowCrossCollege: true,
      candidates: [
        person("strong", "pict", ["py", "ml", "cv"]),
        person("half", "pict", ["py"]),
        person("none", "pict", ["java"]),
      ],
    });
    expect(out.map((s) => [s.candidate.userId, s.roleId, s.score])).toEqual([
      ["strong", "ml", 95],
      ["half", "ml", 40],
    ]);
  });

  it("respects same-college roles, event rules and opt-outs", () => {
    const designerElsewhere = person("d1", "pict", ["figma"]);
    const designerSameCollege = person("d2", "coep", ["figma"]);
    const mlNotOpen = person("m1", "pict", ["py", "ml"], { openToCrossCollege: false });
    const out = suggestTeammates({
      roles,
      leaderCollegeId: "coep",
      allowCrossCollege: true,
      candidates: [designerElsewhere, designerSameCollege, mlNotOpen],
    });
    expect(out.map((s) => s.candidate.userId)).toEqual(["d2"]);

    const sameCollegeOnly = suggestTeammates({
      roles,
      leaderCollegeId: "coep",
      allowCrossCollege: false,
      candidates: [person("x", "pict", ["py", "ml"]), person("y", "coep", ["py", "ml"])],
    });
    expect(sameCollegeOnly.map((s) => s.candidate.userId)).toEqual(["y"]);
  });

  it("prefers people actively looking when scores tie", () => {
    const out = suggestTeammates({
      roles,
      leaderCollegeId: "coep",
      allowCrossCollege: true,
      candidates: [person("solo", "pict", ["py", "ml"]), person("looking", "pict", ["py", "ml"], { source: "looking" })],
    });
    expect(out.map((s) => s.candidate.userId)).toEqual(["looking", "solo"]);
  });
});
