import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isOrgAdmin, requireUser } from "@/lib/auth";
import { getAdminOrgs, getEventWithOrg } from "@/lib/queries";
import { toLocalInput } from "@/lib/format";
import { EventForm } from "@/components/event-form";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEventPage({ params }: PageProps<"/events/[id]/edit">) {
  const { id } = await params;
  const user = await requireUser({ next: `/events/${id}/edit` });
  const event = await getEventWithOrg(id);
  if (!event || !(await isOrgAdmin(user.id, event.orgId))) notFound();
  const orgs = await getAdminOrgs(user.id);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Edit event</h1>
      <EventForm
        userId={user.id}
        orgs={orgs}
        eventId={event.id}
        isPublished={event.status === "published"}
        initial={{
          orgId: event.orgId,
          title: event.title,
          description: event.description,
          type: event.type,
          domainTags: event.domainTags,
          mode: event.mode,
          venue: event.venue ?? "",
          startsAt: toLocalInput(event.startsAt),
          endsAt: toLocalInput(event.endsAt),
          regDeadline: toLocalInput(event.regDeadline),
          teamMin: event.teamMin,
          teamMax: event.teamMax,
          eligibilityScope: event.eligibilityScope,
          allowCrossCollege: event.allowCrossCollege,
          isFree: event.isFree,
          feeText: event.feeText ?? "",
          prizeText: event.prizeText ?? "",
          rulesMd: event.rulesMd ?? "",
          posterUrl: event.posterUrl,
          externalUrl: event.externalUrl ?? "",
          beginnerFriendly: event.beginnerFriendly,
        }}
      />
    </div>
  );
}
