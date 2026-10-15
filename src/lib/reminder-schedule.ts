export type ReminderKind = "h72" | "h24" | "h2";

const WINDOWS: Array<[ReminderKind, number]> = [
  ["h2", 2],
  ["h24", 24],
  ["h72", 72],
];

/**
 * Which reminder is due for an event starting at `startsAt`: the tightest window we're inside
 * (≤2 h → "h2", ≤24 h → "h24", ≤72 h → "h72"), or null if it's further out or already started.
 */
export function dueReminder(startsAt: Date, now: Date): ReminderKind | null {
  const hours = (startsAt.getTime() - now.getTime()) / 3_600_000;
  if (hours <= 0) return null;
  return WINDOWS.find(([, h]) => hours <= h)?.[0] ?? null;
}

/**
 * Sending `kind` also covers every looser reminder, so someone who registers 10 h before the
 * start gets one "tomorrow" reminder rather than a 72 h one followed by a 24 h one.
 */
export function remindersCoveredBy(kind: ReminderKind): ReminderKind[] {
  const i = WINDOWS.findIndex(([k]) => k === kind);
  return WINDOWS.slice(i).map(([k]) => k);
}

export const REMINDER_LABEL: Record<ReminderKind, string> = {
  h72: "in 3 days",
  h24: "tomorrow",
  h2: "in 2 hours",
};
