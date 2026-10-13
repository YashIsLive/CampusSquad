"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { toggleFollowOrg } from "@/app/actions/orgs";
import { Button } from "@/components/ui/button";

export function FollowButton({ orgId, initialFollowing }: { orgId: string; initialFollowing: boolean }) {
  const [, startTransition] = useTransition();
  const [following, setOptimistic] = useOptimistic(initialFollowing);

  return (
    <Button
      variant={following ? "outline" : "secondary"}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!following);
          const res = await toggleFollowOrg({ orgId, follow: !following });
          if (!res.ok) toast.error(res.error);
        })
      }
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
}
