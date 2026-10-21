import { siteUrl } from "@/lib/format";

/** RFC 9116: tells security researchers where to report vulnerabilities. */
export function GET() {
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "privacy@gotnext.example";
  const expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
  const body = [
    `Contact: mailto:${contact}`,
    `Expires: ${expires}`,
    "Preferred-Languages: en",
    `Policy: ${siteUrl()}/privacy`,
    `Canonical: ${siteUrl()}/.well-known/security.txt`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
