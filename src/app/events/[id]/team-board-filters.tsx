"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/form";
import { cn } from "@/lib/utils";

const KEYS = ["skill", "where", "college", "hours"] as const;

export function TeamBoardFilters({
  skills,
  colleges,
}: {
  skills: Array<{ id: string; name: string }>;
  colleges: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    next.set("tab", "teams");
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  const sel = (key: (typeof KEYS)[number], label: string, options: Array<[string, string]>) => (
    <NativeSelect
      aria-label={label}
      value={params.get(key) ?? ""}
      onChange={(e) => update({ [key]: e.target.value || null })}
      className={cn("h-8 w-auto max-w-48 text-xs sm:text-sm", params.get(key) && "border-ink font-medium")}
    >
      <option value="">{label}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </NativeSelect>
  );

  const active = KEYS.some((k) => params.get(k));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {sel("skill", "Any skill", skills.map((s) => [s.id, s.name]))}
      {sel("where", "Any college", [["intra", "My college"], ["cross", "Other colleges"]])}
      {sel("college", "Specific college", colleges.map((c) => [c.id, c.name]))}
      {sel("hours", "Any hours/week", [["5", "≤ 5 h/week"], ["10", "≤ 10 h/week"], ["20", "≤ 20 h/week"]])}
      {active && (
        <Button variant="ghost" size="sm" onClick={() => update(Object.fromEntries(KEYS.map((k) => [k, null])))}>
          <X /> Clear
        </Button>
      )}
    </div>
  );
}
