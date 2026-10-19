import type { NextConfig } from "next";
import { assertProductionEnv } from "./src/env";

assertProductionEnv();

const isDev = process.env.NODE_ENV !== "production";
// Only force HTTPS when the site is actually served over HTTPS. A production build tried on a
// phone over plain http://192.168.x.x would otherwise have every script upgraded to https and break.
const httpsSite = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;
const supabase = supabaseHost ? `https://${supabaseHost}` : "https://*.supabase.co";
const supabaseWs = supabaseHost ? `wss://${supabaseHost}` : "wss://*.supabase.co";

/**
 * Content Security Policy. Next.js inlines its bootstrap scripts, so script-src needs
 * 'unsafe-inline' without a nonce setup; everything else is tightly scoped. form-action includes
 * the OAuth hops because Chrome applies it to redirects after a form (server action) submit.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase} https://avatars.githubusercontent.com https://lh3.googleusercontent.com`,
  "font-src 'self' data:",
  // Dev: the HMR socket lives on whatever host you opened (localhost, or your LAN IP from a phone).
  `connect-src 'self' ${supabase} ${supabaseWs}${isDev ? " ws: http:" : ""}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  `form-action 'self' ${supabase} https://accounts.google.com`,
  "object-src 'none'",
  ...(httpsSite ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  ...(httpsSite ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera is needed for QR check-in on our own pages only.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  // Cache Components is off on purpose: almost every page is per-user and auth-dependent.
  // See DECISIONS.md (D-002).
  poweredByHeader: false,
  // Let phones and laptops on the same Wi-Fi use the dev server (http://192.168.x.x:3000).
  // Without this, Next blocks the page's scripts from other hosts and buttons do nothing.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      // Friendly URL for "sign up" links; the login page handles both (query params pass through).
      { source: "/signup", destination: "/login?mode=signup", permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      ...(supabaseHost ? [{ protocol: "https" as const, hostname: supabaseHost }] : []),
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
