import "server-only";
import { and, asc, eq, gte, ilike, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { CurrentUser } from "@/lib/auth";
import { DOMAINS } from "@/lib/format";

export const FEED_SCOPES = ["campus", "nearby", "india"] as const;
export type FeedScope = (typeof FEED_SCOPES)[number];

/** Search params → validated filters. Invalid values are dropped rather than erroring. */
export const feedFiltersSchema = z.object({
  scope: z.enum(FEED_SCOPES).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  type: z.enum(schema.eventType.enumValues).optional().catch(undefined),
  domain: z.enum(DOMAINS.map((d) => d.value) as [string, ...string[]]).optional().catch(undefined),
  mode: z.enum(schema.eventMode.enumValues).optional().catch(undefined),
  fee: z.enum(["free", "paid"]).optional().catch(undefined),
  within: z.coerce.number().int().min(1).max(90).optional().catch(undefined),
  size: z.enum(["solo", "team"]).optional().catch(undefined),
  beginner: z.literal("1").optional().catch(undefined),
});
export type FeedFilters = z.infer<typeof feedFiltersSchema>;

export function parseFeedFilters(sp: Record<string, string | string[] | undefined>): FeedFilters {
  const flat = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  return feedFiltersSchema.parse(flat);
}

export function defaultScope(user: CurrentUser | null): FeedScope {
  return user?.collegeId ? "campus" : "india";
}

function scopeCondition(scope: FeedScope, user: CurrentUser | null): SQL | undefined {
  const e = schema.events;
  const collegeId = user?.collegeId ?? null;
  const city = user?.college?.city ?? null;

  // Hide events the viewer isn't eligible for (other campuses' campus-only events, other cities' city-only events).
  const eligible = user
    ? or(
        eq(e.eligibilityScope, "india"),
        and(eq(e.eligibilityScope, "college"), collegeId ? eq(e.collegeId, collegeId) : sql`false`),
        and(eq(e.eligibilityScope, "city"), city ? sql`lower(${e.city}) = lower(${city})` : sql`false`),
      )
    : undefined;

  switch (scope) {
    case "campus":
      return collegeId ? and(eq(e.collegeId, collegeId), eligible) : sql`false`;
    case "nearby":
      return city ? and(sql`lower(${e.city}) = lower(${city})`, eligible) : sql`false`;
    case "india":
      return eligible;
  }
}

export async function getFeed(user: CurrentUser | null, filters: FeedFilters, now = new Date()) {
  const scope = filters.scope ?? defaultScope(user);
  const e = schema.events;
  const conditions: Array<SQL | undefined> = [
    eq(e.status, "published"),
    gte(e.endsAt, now),
    scopeCondition(scope, user),
    filters.type && eq(e.type, filters.type),
    filters.domain ? sql`${filters.domain} = any(${e.domainTags})` : undefined,
    filters.mode && eq(e.mode, filters.mode),
    filters.fee && eq(e.isFree, filters.fee === "free"),
    filters.size === "solo" ? eq(e.teamMax, 1) : filters.size === "team" ? ne(e.teamMax, 1) : undefined,
    filters.beginner && eq(e.beginnerFriendly, true),
    filters.within
      ? and(gte(e.regDeadline, now), lte(e.regDeadline, new Date(now.getTime() + filters.within * 86_400_000)))
      : undefined,
  ];

  if (filters.q) {
    const like = `%${filters.q.replace(/[%_\\]/g, "\\$&")}%`;
    conditions.push(
      or(
        sql`${e.search} @@ websearch_to_tsquery('english', ${filters.q})`,
        ilike(e.title, like),
        ilike(schema.organizations.name, like),
      ),
    );
  }

  const rows = await db
    .select({ event: e, org: { name: schema.organizations.name, slug: schema.organizations.slug } })
    .from(e)
    .innerJoin(schema.organizations, eq(schema.organizations.id, e.orgId))
    .where(and(...conditions.filter((c): c is SQL => Boolean(c))))
    // Open registrations first (soonest deadline first), then closed-but-upcoming events.
    .orderBy(sql`(${e.regDeadline} < ${now} or not ${e.registrationsOpen})`, asc(e.regDeadline))
    .limit(60);

  const events = rows.map((r) => ({ ...r.event, org: r.org }));
  const closingSoon = events.filter(
    (ev) => ev.registrationsOpen && ev.regDeadline >= now && ev.regDeadline.getTime() - now.getTime() <= 48 * 3600e3,
  );
  return { scope, events, closingSoon };
}
