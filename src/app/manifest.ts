import type { MetadataRoute } from "next";

/** Installable PWA: students add Got Next to their home screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Got Next — hackathons near you, and a team to go with",
    short_name: "Got Next",
    description: "Find hackathons, coding contests and workshops near your college, and the people to build with.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3f3f0",
    theme_color: "#0f0f0e",
    categories: ["education", "social"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My events", url: "/me/events" },
      { name: "My teams", url: "/me/applications" },
    ],
  };
}
