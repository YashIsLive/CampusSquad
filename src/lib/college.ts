/** Mirrors the SQL `college_for_email`: exact domain or any subdomain of it. */
export function emailMatchesDomain(email: string, domain: string) {
  const host = email.split("@")[1]?.toLowerCase() ?? "";
  const d = domain.toLowerCase();
  return host === d || host.endsWith(`.${d}`);
}

/**
 * Free/personal email providers. A college's student domain must never be one of these, or
 * everyone with (say) a Gmail address would be "verified" at that college. Mirrored by a database
 * check (migration 0013).
 */
export const FREE_EMAIL_DOMAINS = [
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "yahoo.in", "ymail.com", "rocketmail.com",
  "outlook.com", "hotmail.com", "hotmail.co.in", "live.com", "live.in", "msn.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "pm.me",
  "zoho.com", "zohomail.in", "rediffmail.com", "gmx.com", "gmx.net", "mail.com", "yandex.com", "tutanota.com",
] as const;

export function isFreeEmailDomain(domain: string) {
  const d = domain.trim().toLowerCase();
  return (FREE_EMAIL_DOMAINS as readonly string[]).some((f) => d === f || d.endsWith(`.${f}`));
}
