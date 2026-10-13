/** Mirrors the SQL `college_for_email`: exact domain or any subdomain of it. */
export function emailMatchesDomain(email: string, domain: string) {
  const host = email.split("@")[1]?.toLowerCase() ?? "";
  const d = domain.toLowerCase();
  return host === d || host.endsWith(`.${d}`);
}
