import { describe, expect, it } from "vitest";
import { canRegister, crossCollegeAllowed } from "@/lib/eligibility";

const now = new Date("2026-10-14T10:00:00Z");
const base = {
  status: "published" as const,
  registrationsOpen: true,
  regDeadline: new Date("2026-10-20T10:00:00Z"),
  eligibilityScope: "india" as const,
  collegeId: "coep",
  city: "Pune",
};
const coepVerified = { collegeId: "coep", collegeVerified: true, collegeCity: "Pune" };
const pict = { collegeId: "pict", collegeVerified: true, collegeCity: "Pune" };
const vjti = { collegeId: "vjti", collegeVerified: true, collegeCity: "Mumbai" };

describe("canRegister", () => {
  it("allows anyone for all-India events", () => {
    expect(canRegister(base, vjti, now).ok).toBe(true);
    expect(canRegister(base, { collegeId: null, collegeVerified: false, collegeCity: null }, now).ok).toBe(true);
  });

  it("blocks after the deadline, when closed, or unpublished", () => {
    expect(canRegister({ ...base, regDeadline: new Date("2026-10-13T00:00:00Z") }, coepVerified, now).ok).toBe(false);
    expect(canRegister({ ...base, registrationsOpen: false }, coepVerified, now).ok).toBe(false);
    expect(canRegister({ ...base, status: "draft" }, coepVerified, now).ok).toBe(false);
  });

  it("college scope requires the same college and verification", () => {
    const ev = { ...base, eligibilityScope: "college" as const };
    expect(canRegister(ev, coepVerified, now).ok).toBe(true);
    expect(canRegister(ev, pict, now).ok).toBe(false);
    expect(canRegister(ev, { ...coepVerified, collegeVerified: false }, now).ok).toBe(false);
  });

  it("city scope matches the college's city", () => {
    const ev = { ...base, eligibilityScope: "city" as const };
    expect(canRegister(ev, pict, now).ok).toBe(true);
    expect(canRegister(ev, vjti, now).ok).toBe(false);
  });
});

describe("crossCollegeAllowed", () => {
  it("allows any pairing when the event allows cross-college teams", () => {
    expect(crossCollegeAllowed({ allowCrossCollege: true }, "coep", "pict")).toBe(true);
  });
  it("requires the same college otherwise", () => {
    expect(crossCollegeAllowed({ allowCrossCollege: false }, "coep", "coep")).toBe(true);
    expect(crossCollegeAllowed({ allowCrossCollege: false }, "coep", "pict")).toBe(false);
    expect(crossCollegeAllowed({ allowCrossCollege: false }, null, null)).toBe(false);
  });
});
