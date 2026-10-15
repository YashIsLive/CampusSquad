"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { endorseTeammate } from "@/app/actions/workspace";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/form";

type Teammate = { id: string; name: string; skills: Array<{ id: string; name: string }> };

/** After the event ends, teammates endorse each other on a skill (one per skill per pair per event). */
export function EndorsePanel({ eventId, teamId, teammates }: { eventId: string; teamId: string; me: string; teammates: Teammate[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<Record<string, string>>({});

  if (teammates.length === 0) return null;

  return (
    <section className="rounded-lg border border-rule bg-secondary/60 p-4">
      <h2 className="text-xl font-bold">Endorse your teammates</h2>
      <p className="mb-3 text-sm text-muted-foreground">The event is over. Vouch for a skill each teammate showed — it appears on their profile.</p>
      <ul className="flex flex-col gap-2">
        {teammates.map((t) => (
          <li key={t.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="w-40 shrink-0 text-sm font-medium">{t.name}</span>
            {t.skills.length === 0 ? (
              <span className="text-sm text-muted-foreground">No skills listed on their profile</span>
            ) : (
              <>
                <NativeSelect
                  aria-label={`Skill to endorse for ${t.name}`}
                  value={picked[t.id] ?? ""}
                  onChange={(e) => setPicked({ ...picked, [t.id]: e.target.value })}
                  className="sm:w-56"
                >
                  <option value="">Pick a skill</option>
                  {t.skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </NativeSelect>
                <Button
                  size="sm"
                  disabled={pending || !picked[t.id]}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await endorseTeammate({ eventId, teamId, toUser: t.id, skillId: picked[t.id] });
                      if (!res.ok) return void toast.error(res.error);
                      toast.success(`Endorsed ${t.name}`);
                      setPicked({ ...picked, [t.id]: "" });
                      router.refresh();
                    })
                  }
                >
                  Endorse
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
