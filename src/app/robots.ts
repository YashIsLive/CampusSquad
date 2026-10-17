import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/format";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/events/", "/orgs/", "/u/"],
        // Private or per-user pages, and auth plumbing.
        disallow: ["/me/", "/teams/", "/notifications", "/onboarding", "/admin", "/auth/", "/api/", "/s/", "/events/*/manage", "/events/*/edit"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
