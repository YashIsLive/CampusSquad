import type { Metadata, Viewport } from "next";
import { Archivo, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavProgress } from "@/components/layout/nav-progress";
import { ViewTransitionShim } from "@/components/view-transition-shim";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { siteUrl } from "@/lib/format";
import "./globals.css";

// One family at many widths: wide for headlines, condensed for dates and numbers, normal for reading.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });
// Only for codes people read out or type (check-in codes).
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Got Next — hackathons near you, and a team to go with", template: "%s · Got Next" },
  description: "Find hackathons, coding contests and workshops near your college, and the people to build with.",
  openGraph: { siteName: "Got Next", type: "website" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f3f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0d" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <html lang="en-IN" className={`${archivo.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">
        <a
          href="#main"
          className="label-mono fixed top-2 left-2 z-[60] -translate-y-20 rounded-md bg-ink px-3 py-2 text-paper transition-transform focus:translate-y-0"
        >
          Skip to content
        </a>
        <ViewTransitionShim />
        <Suspense>
          <NavProgress />
        </Suspense>
        <SiteHeader user={user} />
        <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          {children}
        </main>
        <SiteFooter />
        {user && <MobileNav />}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
