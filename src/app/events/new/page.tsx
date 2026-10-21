import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAdminOrgs } from "@/lib/queries";
import { toLocalInput } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { EventForm } from "@/components/event-form";
import { BackButton } from "@/components/back-button";

export const metadata: Metadata = { title: "Post an event" };

export default async function NewEventPage({ searchParams }: PageProps<"/events/new">) {
  const user = await requireUser({ next: "/events/new" });
  const orgs = await getAdminOrgs(user.id);
  const sp = await searchParams;
  const preferred = typeof sp.org === "string" ? sp.org : undefined;

  if (orgs.length === 0) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-10">
        <EmptyState
          title="Add your club first"
          description="Events are posted by a club, department or community. Create one (you'll be its owner), or ask an existing club's owner to add you as an admin."
          action={<Button render={<Link href="/orgs/new" />}>Add your club</Button>}
        />
      </div>
    );
  }

  const start = defaultStart();
  const org = orgs.find((o) => o.id === preferred) ?? orgs[0];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      <BackButton fallback="/" className="mb-5" />
      <h1 className="text-4xl leading-[0.95] font-black sm:text-5xl">Post an event</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Takes about 5 minutes. You&apos;ll get a share kit (links + QR) once it&apos;s published.
      </p>
      <EventForm
        userId={user.id}
        orgs={orgs}
        initial={{
          orgId: org.id,
          title: "",
          description: "",
          type: "hackathon",
          domainTags: [],
          mode: "offline",
          venue: "",
          startsAt: toLocalInput(start),
          endsAt: toLocalInput(new Date(start.getTime() + 8 * 3600 * 1000)),
          regDeadline: toLocalInput(new Date(start.getTime() - 3 * DAY_MS)),
          teamMin: 1,
          teamMax: 4,
          eligibilityScope: org.hasCollege ? "city" : "india",
          allowCrossCollege: true,
          isFree: true,
          feeText: "",
          prizeText: "",
          rulesMd: "",
          posterUrl: null,
          externalUrl: "",
          beginnerFriendly: false,
        }}
      />
    </div>
  );
}

const DAY_MS = 24 * 3600 * 1000;

/** Two weeks out, 10:00 IST. */
function defaultStart() {
  const start = new Date(Date.now() + 14 * DAY_MS);
  start.setUTCHours(4, 30, 0, 0);
  return start;
}
