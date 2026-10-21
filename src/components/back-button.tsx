"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { canGoBackInApp } from "@/components/layout/nav-history";

/**
 * "← Back". Goes back to where you came from on Got Next; if you arrived from outside (a shared
 * link, a new tab), it goes to `fallback` instead of leaving the site. It's a real link, so it
 * still works before JavaScript loads.
 */
export function BackButton({ fallback, label = "Back", className }: { fallback: string; label?: string; className?: string }) {
  const router = useRouter();
  return (
    <Link
      href={fallback}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // let "open in new tab" work
        if (canGoBackInApp()) {
          e.preventDefault();
          router.back();
        }
      }}
      className={cn(
        "group inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-rule bg-card py-1.5 pr-3.5 pl-2.5 text-sm font-semibold",
        "transition-[border-color,background-color] duration-150 hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        className,
      )}
    >
      <ArrowLeft aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
      {label}
    </Link>
  );
}
