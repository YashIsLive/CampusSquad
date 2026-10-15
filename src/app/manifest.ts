import type { MetadataRoute } from "next";

/** Installable PWA: students add CampusSquad to their home screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CampusSquad — campus tech events & teammates",
    short_name: "CampusSquad",
    description: "Hackathons, quizzes and coding contests on your campus — and teammates who fit.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f1ea",
    theme_color: "#1a1714",
    categories: ["education", "social"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My events", url: "/me/events" },
      { name: "Teams & applications", url: "/me/applications" },
    ],
  };
}
