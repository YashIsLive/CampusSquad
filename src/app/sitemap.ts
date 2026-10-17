import type { MetadataRoute } from "next";
import { and, eq, gte, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { siteUrl } from "@/lib/format";

/** Public, upcoming events and club pages — the URLs worth finding from search engines. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const home = { url: `${base}/`, changeFrequency: "hourly" as const, priority: 1 };
  try {
    const [events, orgs] = await Promise.all([
      db
        .select({ id: schema.events.id, updatedAt: schema.events.updatedAt })
        .from(schema.events)
        .where(and(eq(schema.events.status, "published"), gte(schema.events.endsAt, new Date())))
        .limit(5000),
      db.select({ slug: schema.organizations.slug }).from(schema.organizations).where(ne(schema.organizations.slug, "")).limit(5000),
    ]);
    return [
      home,
      ...events.map((e) => ({ url: `${base}/events/${e.id}`, lastModified: e.updatedAt, changeFrequency: "daily" as const, priority: 0.8 })),
      ...orgs.map((o) => ({ url: `${base}/orgs/${o.slug}`, changeFrequency: "weekly" as const, priority: 0.5 })),
    ];
  } catch (err) {
    // No database at build time (e.g. CI): ship the home page now; it refreshes hourly.
    console.warn("sitemap: database unavailable, serving minimal sitemap", err instanceof Error ? err.message : err);
    return [home];
  }
}

export const revalidate = 3600;
