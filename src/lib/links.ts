import { z } from "zod";

/**
 * Turns what people actually paste ("github.com/you", "www.unstop.com/x", "https://…") into an
 * https URL. Only http(s) is allowed, so a saved link can never be `javascript:` or `data:`.
 * Returns null for anything that isn't a web address.
 */
export function normalizeWebUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    // Needs a real-looking host: "localhost" or something with a dot.
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    return u.toString();
  } catch {
    return null;
  }
}

const HANDLE = /^@?([a-z\d](?:[a-z\d-]{0,38}))$/i;

/** "you", "@you", "github.com/you", "https://github.com/you/" → "https://github.com/you". */
export function normalizeGithubUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const bare = HANDLE.exec(v);
  if (bare) return `https://github.com/${bare[1]}`;
  const url = normalizeWebUrl(v);
  if (!url) return null;
  const u = new URL(url);
  if (!/^(www\.)?github\.com$/i.test(u.hostname)) return null;
  const name = u.pathname.split("/").filter(Boolean)[0];
  return name && HANDLE.test(name) ? `https://github.com/${name}` : null;
}

/** "linkedin.com/in/you", "in/you", "https://in.linkedin.com/in/you?trk=…" → "https://www.linkedin.com/in/you". */
export function normalizeLinkedinUrl(raw: string): string | null {
  const v = raw.trim().replace(/^\/?(in\/)/i, "linkedin.com/in/");
  if (!v) return null;
  const url = normalizeWebUrl(v);
  if (!url) return null;
  const u = new URL(url);
  if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
  const [kind, slug] = u.pathname.split("/").filter(Boolean);
  if (!slug || !["in", "company", "school"].includes(kind?.toLowerCase())) return null;
  return `https://www.linkedin.com/${kind.toLowerCase()}/${slug}`;
}

/** Zod field: optional web link, normalized; empty → null. */
export const optionalWebUrl = (message = "Enter a web address, like unstop.com/your-event.") =>
  z
    .string()
    .trim()
    .max(500)
    .transform((v, ctx) => {
      if (!v) return null;
      const url = normalizeWebUrl(v);
      if (!url) ctx.addIssue({ code: "custom", message });
      return url ?? z.NEVER;
    });

export const optionalGithubUrl = z
  .string()
  .trim()
  .max(300)
  .transform((v, ctx) => {
    if (!v) return null;
    const url = normalizeGithubUrl(v);
    if (!url) ctx.addIssue({ code: "custom", message: "Enter your GitHub username or profile link (github.com/you)." });
    return url ?? z.NEVER;
  });

export const optionalLinkedinUrl = z
  .string()
  .trim()
  .max(300)
  .transform((v, ctx) => {
    if (!v) return null;
    const url = normalizeLinkedinUrl(v);
    if (!url) ctx.addIssue({ code: "custom", message: "Enter your LinkedIn profile link (linkedin.com/in/you)." });
    return url ?? z.NEVER;
  });

/** Uploaded image (poster, avatar, logo): must be an http(s) URL. */
export const imageUrl = z.url({ protocol: /^https?$/, message: "Upload the image again." });
