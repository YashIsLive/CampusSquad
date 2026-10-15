/** GitHub repo language → CampusSquad skill name(s). Unknown languages are ignored. */
const LANGUAGE_TO_SKILLS: Record<string, string[]> = {
  TypeScript: ["TypeScript"],
  JavaScript: ["JavaScript"],
  Python: ["Python"],
  "Jupyter Notebook": ["Python", "Data Analysis"],
  Java: ["Java"],
  Go: ["Go"],
  Kotlin: ["Kotlin"],
  Swift: ["Swift"],
  "C++": ["C++"],
  C: ["Embedded C"],
  Solidity: ["Solidity"],
  HTML: ["HTML/CSS"],
  CSS: ["HTML/CSS"],
  SCSS: ["HTML/CSS"],
  Vue: ["Vue"],
  Dart: ["Flutter"],
  Dockerfile: ["Docker"],
  Shell: ["Linux"],
};

/** "https://github.com/octocat/" → "octocat"; null if it isn't a GitHub profile URL. */
export function githubUsername(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/^(www\.)?github\.com$/i.test(u.hostname)) return null;
    const name = u.pathname.split("/").filter(Boolean)[0];
    return name && /^[a-z\d](?:[a-z\d-]{0,38})$/i.test(name) ? name : null;
  } catch {
    return null;
  }
}

/** Suggested level from how many of their own repos use the language. */
export function levelFromRepoCount(repos: number) {
  return repos >= 5 ? 4 : repos >= 2 ? 3 : 2;
}

/**
 * Turn repo languages into skill suggestions: [{ skill, repos, level }], most-used first.
 * Forks are ignored — they don't show the person's own work.
 */
export function skillsFromRepos(repos: Array<{ language: string | null; fork: boolean }>) {
  const counts = new Map<string, number>();
  for (const r of repos) {
    if (r.fork || !r.language) continue;
    for (const skill of LANGUAGE_TO_SKILLS[r.language] ?? []) counts.set(skill, (counts.get(skill) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([skill, n]) => ({ skill, repos: n, level: levelFromRepoCount(n) }))
    .sort((a, b) => b.repos - a.repos || a.skill.localeCompare(b.skill));
}
