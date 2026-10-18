import { describe, expect, it } from "vitest";
import { normalizeGithubUrl, normalizeLinkedinUrl, normalizeWebUrl, optionalWebUrl } from "@/lib/links";

describe("normalizeWebUrl", () => {
  it("adds https:// to what people paste", () => {
    expect(normalizeWebUrl("unstop.com/hackathon/x")).toBe("https://unstop.com/hackathon/x");
    expect(normalizeWebUrl("www.devfolio.co")).toBe("https://www.devfolio.co/");
    expect(normalizeWebUrl("  https://a.dev/x?y=1 ")).toBe("https://a.dev/x?y=1");
  });
  it("rejects non-web schemes and junk", () => {
    expect(normalizeWebUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeWebUrl("JaVaScRiPt:alert(1)")).toBeNull();
    expect(normalizeWebUrl("data:text/html,<script>")).toBeNull();
    expect(normalizeWebUrl("hello")).toBeNull();
    expect(normalizeWebUrl("")).toBeNull();
  });
  it("works as a zod field", () => {
    expect(optionalWebUrl().parse("")).toBeNull();
    expect(optionalWebUrl().parse("unstop.com/x")).toBe("https://unstop.com/x");
    expect(optionalWebUrl().safeParse("javascript:alert(1)").success).toBe(false);
  });
});

describe("normalizeGithubUrl", () => {
  it.each([
    ["octocat", "https://github.com/octocat"],
    ["@octocat", "https://github.com/octocat"],
    ["github.com/octocat", "https://github.com/octocat"],
    ["https://www.github.com/octocat/", "https://github.com/octocat"],
    ["https://github.com/octocat/hello-world", "https://github.com/octocat"],
  ])("%s", (input, out) => expect(normalizeGithubUrl(input)).toBe(out));
  it("rejects other sites", () => {
    expect(normalizeGithubUrl("gitlab.com/octocat")).toBeNull();
    expect(normalizeGithubUrl("https://github.com/")).toBeNull();
  });
});

describe("normalizeLinkedinUrl", () => {
  it.each([
    ["linkedin.com/in/riya-k", "https://www.linkedin.com/in/riya-k"],
    ["in/riya-k", "https://www.linkedin.com/in/riya-k"],
    ["https://in.linkedin.com/in/riya-k/?trk=abc", "https://www.linkedin.com/in/riya-k"],
    ["www.linkedin.com/company/coep", "https://www.linkedin.com/company/coep"],
  ])("%s", (input, out) => expect(normalizeLinkedinUrl(input)).toBe(out));
  it("rejects other sites and bare domains", () => {
    expect(normalizeLinkedinUrl("linkedin.com")).toBeNull();
    expect(normalizeLinkedinUrl("evil-linkedin.com/in/x")).toBeNull();
  });
});
