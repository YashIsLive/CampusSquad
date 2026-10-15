import { TIME_ZONE } from "@/lib/format";

const IST_OFFSET_MS = 5.5 * 3600 * 1000;
const DAY = 86_400_000;

/** Midnight IST on the Monday of the week containing `d`, as a UTC instant. */
export function istWeekStart(d: Date) {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const dayIndex = (ist.getUTCDay() + 6) % 7; // Monday = 0
  const midnightIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - dayIndex * DAY;
  return new Date(midnightIst - IST_OFFSET_MS);
}

const monthFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, month: "long", year: "numeric" });

export type EventGroup<T> = { key: string; label: string; items: T[] };

/**
 * Timeline buckets for the feed, in display order:
 * "Happening now" → "This week" → "Next week" → one bucket per later month.
 */
export function groupByWhen<T extends { startsAt: Date; endsAt: Date }>(events: T[], now = new Date()): EventGroup<T>[] {
  const week = istWeekStart(now).getTime();
  const nextWeek = week + 7 * DAY;
  const after = week + 14 * DAY;
  const groups = new Map<string, EventGroup<T>>();
  const add = (key: string, label: string, item: T) => {
    if (!groups.has(key)) groups.set(key, { key, label, items: [] });
    groups.get(key)!.items.push(item);
  };
  const sorted = [...events].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  for (const e of sorted) {
    const t = e.startsAt.getTime();
    if (t <= now.getTime() && e.endsAt.getTime() >= now.getTime()) add("0-now", "Happening now", e);
    else if (t < nextWeek) add("1-this-week", "This week", e);
    else if (t < after) add("2-next-week", "Next week", e);
    else {
      const label = monthFmt.format(e.startsAt);
      add(`3-${new Date(t + IST_OFFSET_MS).toISOString().slice(0, 7)}`, label, e);
    }
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}
