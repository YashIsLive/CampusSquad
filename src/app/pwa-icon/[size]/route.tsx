import { brandIcon } from "@/lib/brand-icon";

const SIZES = new Set([192, 512]);

/** PWA manifest icons: /pwa-icon/192, /pwa-icon/512, and /pwa-icon/512?maskable=1. */
export async function GET(request: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const size = Number((await ctx.params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  const res = brandIcon(size, { maskable: new URL(request.url).searchParams.has("maskable") });
  res.headers.set("Cache-Control", "public, max-age=604800, immutable");
  return res;
}
