"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { HandHeart } from "lucide-react";
import { toast } from "sonner";
import { vouchFor } from "@/app/actions/verification";
import { Button } from "@/components/ui/button";

export function VouchButton({ userId, name, college }: { userId: string; name: string; college: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const first = name.split(" ")[0];
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Vouch that ${name} studies at ${college}? Only vouch for people you actually know.`)) return;
        start(async () => {
          const res = await vouchFor({ userId });
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.data.verified ? `${first} is now verified. Thanks!` : `Vouched. ${first} needs one more.`);
          router.refresh();
        });
      }}
    >
      <HandHeart /> Vouch for {first}
    </Button>
  );
}
