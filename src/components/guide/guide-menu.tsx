"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { toast } from "sonner";
import { resetGuide, setChecklistHidden } from "@/app/actions/guide";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { START_TOUR_EVENT } from "./page-tour";
import type { TourKey } from "./tours";

/** Which page tour applies to the current route. */
export function tourForPath(pathname: string): TourKey | null {
  if (pathname === "/") return "feed";
  if (/^\/events\/[^/]+\/manage/.test(pathname)) return "manage";
  if (/^\/events\/[0-9a-f-]{36}$/.test(pathname)) return "event";
  if (/^\/teams\/[0-9a-f-]{36}$/.test(pathname)) return "team";
  return null;
}

export function GuideMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const tour = tourForPath(pathname);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-tour="guide"
        aria-label="Help and guided tours"
        className="grid size-10 place-items-center rounded-full outline-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ink sm:size-9"
      >
        <CircleHelp className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="label-mono">Guide</DropdownMenuLabel>
          <DropdownMenuItem
            disabled={!tour}
            onClick={() => tour && window.dispatchEvent(new CustomEvent(START_TOUR_EVENT, { detail: { tour } }))}
          >
            {tour ? "Tour this page" : "No tour for this page"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              startTransition(async () => {
                await setChecklistHidden({ hidden: false });
                router.push("/");
                router.refresh();
              })
            }
          >
            Show getting-started checklist
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              startTransition(async () => {
                await resetGuide({});
                toast.success("Tours will play again as you visit each page");
                router.refresh();
              })
            }
          >
            Replay all tours
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="label-mono">Shortcuts</DropdownMenuLabel>
          <p className="flex items-center justify-between px-2 py-1.5 text-sm">
            Search events <kbd className="label-mono rounded-sm border border-rule px-1.5">/</kbd>
          </p>
          <p className="flex items-center justify-between px-2 py-1.5 text-sm">
            Close tour or dialog <kbd className="label-mono rounded-sm border border-rule px-1.5">Esc</kbd>
          </p>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
