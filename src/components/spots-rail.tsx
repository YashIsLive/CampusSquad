import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { SpotForYou } from "@/lib/spots";
import { Slots } from "@/components/noticeboard";

/** Home-page rail: open spots on teams that fit your skills — the team-finding side of Got Next, up front. */
export function SpotsRail({ spots, hasSkills }: { spots: SpotForYou[]; hasSkills: boolean }) {
  if (!hasSkills) {
    return (
      <section aria-labelledby="spots-for-you" className="flex flex-col items-start gap-3 rounded-2xl bg-court/45 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="spots-for-you" className="text-xl font-extrabold">
            Teams are looking for people like you
          </h2>
          <p className="text-sm text-foreground/80">Add a few skills and we&apos;ll show you the open spots you fit best.</p>
        </div>
        <Link href="/onboarding" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">
          Add my skills <ArrowRight className="size-4" />
        </Link>
      </section>
    );
  }
  if (spots.length === 0) return null;

  return (
    <section aria-labelledby="spots-for-you" className="-mx-4 sm:mx-0">
      <div className="mb-3 flex items-end justify-between gap-3 px-4 sm:px-0">
        <div>
          <h2 id="spots-for-you" className="text-2xl font-extrabold">
            Teams that need someone like you
          </h2>
          <p className="text-sm text-muted-foreground">Open spots that match your skills. Say you&apos;ve got it.</p>
        </div>
      </div>
      <ul className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:px-0">
        {spots.map((s) => (
          <li key={s.vacancyId} className="snap-start">
            <Link
              href={`/events/${s.event.id}?tab=teams`}
              className="group lift flex h-full w-64 flex-col gap-3 rounded-2xl border border-ink bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="score rounded-md bg-court px-1.5 pt-1 text-3xl text-[#0f0f0e]">
                  {s.score}
                  <span className="text-lg">%</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Slots filled={s.team.size} total={s.event.teamMax} className="dot-pop" />
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">fit for</p>
                <p className="text-lg leading-tight font-bold">{s.roleTitle}</p>
                <p className="mt-1 truncate text-sm">
                  on <strong>{s.team.name}</strong>
                </p>
                <p className="truncate text-sm text-muted-foreground">{s.event.title}</p>
              </div>
              <span className="mt-auto flex items-center gap-1 text-sm font-semibold underline decoration-court decoration-2 underline-offset-4 group-hover:decoration-ink">
                See the spot <ArrowRight className="size-3.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
