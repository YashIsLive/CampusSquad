import type { CurrentUser } from "@/lib/auth";
import type { EventWithOrg } from "@/lib/queries";
import { EmptyState } from "@/components/empty-state";

export async function TeamsTab(_props: {
  event: EventWithOrg;
  user: CurrentUser | null;
  filters: Record<string, string | string[] | undefined>;
}) {
  return <EmptyState title="Team board coming soon" />;
}
