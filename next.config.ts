import type { NextConfig } from "next";
import { assertProductionEnv } from "./src/env";

assertProductionEnv();

const isDev = process.env.NODE_ENV !== "production";
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
  `connect-src 'self' ${supabase} ${supabaseWs}${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  `form-action 'self' ${supabase} https://accounts.google.com`,
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
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
