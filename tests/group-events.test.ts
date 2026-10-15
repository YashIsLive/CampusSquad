import { describe, expect, it } from "vitest";
import { groupByWhen, istWeekStart } from "@/lib/group-events";

// Friday 16 Oct 2026, 15:00 IST.
const now = new Date("2026-10-16T09:30:00Z");
const ev = (id: string, startIso: string, hours = 4) => ({
  id,
  startsAt: new Date(startIso),
  endsAt: new Date(new Date(startIso).getTime() + hours * 3_600_000),
});

describe("istWeekStart", () => {
  it("returns Monday 00:00 IST", () => {
    expect(istWeekStart(now).toISOString()).toBe("2026-10-11T18:30:00.000Z"); // Mon 12 Oct 00:00 IST
  });
  it("treats Sunday night IST as the same week", () => {
    expect(istWeekStart(new Date("2026-10-18T17:00:00Z")).toISOString()).toBe("2026-10-11T18:30:00.000Z"); // Sun 22:30 IST
  });
});

describe("groupByWhen", () => {
  it("buckets into now / this week / next week / months, in order", () => {
    const groups = groupByWhen(
      [
        ev("later", "2026-11-20T04:30:00Z"),
        ev("next", "2026-10-21T04:30:00Z"),
        ev("live", "2026-10-16T08:00:00Z"),
        ev("week", "2026-10-18T04:30:00Z"),
        ev("dec", "2026-12-02T04:30:00Z"),
      ],
      now,
    );
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ["Happening now", ["live"]],
      ["This week", ["week"]],
      ["Next week", ["next"]],
      ["November 2026", ["later"]],
      ["December 2026", ["dec"]],
    ]);
  });

  it("sorts events within a bucket by start time", () => {
    const [g] = groupByWhen([ev("b", "2026-11-25T04:30:00Z"), ev("a", "2026-11-03T04:30:00Z")], now);
    expect(g.items.map((i) => i.id)).toEqual(["a", "b"]);
  });
});
