import Link from "next/link";
import { BrandMark } from "@/components/brand";

export function SiteFooter() {
  return (
    <footer className="mt-16 hidden border-t border-rule sm:block">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-4 py-6">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <BrandMark className="size-5" />
          The campus noticeboard for tech events and teammates.
        </p>
        <nav aria-label="Footer" className="label-mono flex gap-4 text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Explore
          </Link>
          <Link href="/events/new" className="hover:text-foreground">
            Host an event
          </Link>
          <Link href="/orgs/new" className="hover:text-foreground">
            Start a club page
          </Link>
        </nav>
      </div>
    </footer>
  );
}
