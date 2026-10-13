/** All dates render in IST: the product is India-first and server/client must agree. */
export const TIME_ZONE = "Asia/Kolkata";

const dateFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIME_ZONE, day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
});
const shortFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, day: "numeric", month: "short" });

export const formatDate = (d: Date) => dateFmt.format(d);
export const formatDateTime = (d: Date) => dateTimeFmt.format(d);
export const formatShort = (d: Date) => shortFmt.format(d);

/** "in 3 days", "in 5 hours", "2 days ago" */
export function relative(d: Date, now = new Date()) {
  const diff = d.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86_400_000], ["hour", 3_600_000], ["minute", 60_000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === "minute") return rtf.format(Math.round(diff / ms), unit);
  }
  return "";
}

/** Value for <input type="datetime-local"> in IST. */
export function toLocalInput(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

/** Parse a datetime-local value entered in IST. */
export function fromLocalInput(value: string) {
  return new Date(`${value}:00+05:30`);
}

export const EVENT_TYPE_LABEL = {
  hackathon: "Hackathon",
  quiz: "Quiz",
  coding_contest: "Coding contest",
  workshop: "Workshop",
  ideathon: "Ideathon",
  ctf: "CTF",
} as const;

export const MODE_LABEL = { offline: "Offline", online: "Online", hybrid: "Hybrid" } as const;

export const DOMAINS = [
  { value: "ai-ml", label: "AI / ML" },
  { value: "web", label: "Web" },
  { value: "app", label: "App" },
  { value: "cybersecurity", label: "Cybersecurity" },
  { value: "dsa", label: "DSA" },
  { value: "web3", label: "Web3" },
  { value: "iot", label: "IoT" },
  { value: "design", label: "Design" },
] as const;

export const domainLabel = (v: string) => DOMAINS.find((d) => d.value === v)?.label ?? v;

export const SCOPE_LABEL = { college: "Own college only", city: "Same city", india: "All India" } as const;

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
