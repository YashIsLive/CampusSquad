"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/form";
import { DOMAINS, EVENT_TYPE_LABEL, MODE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

const FILTER_KEYS = ["type", "domain", "mode", "fee", "within", "size", "beginner"] as const;

/** Writes filters to the URL so the server-rendered feed (and shared links) reflect them. */
export function FeedFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const activeCount = FILTER_KEYS.filter((k) => params.get(k)).length;
  const [open, setOpen] = useState(activeCount > 0);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  // Debounced search.
  useEffect(() => {
    if ((params.get("q") ?? "") === q) return;
    const t = setTimeout(() => update({ q: q.trim() || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the typed query changes
  }, [q]);

  const select = (key: (typeof FILTER_KEYS)[number], label: string, options: Array<[string, string]>) => (
    <NativeSelect
      aria-label={label}
      value={params.get(key) ?? ""}
      onChange={(e) => update({ [key]: e.target.value || null })}
      className={cn("h-8 w-auto text-xs sm:text-sm", params.get(key) && "border-primary text-primary")}
    >
      <option value="">{label}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </NativeSelect>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search events or clubs"
            className="h-9 pl-8"
            aria-label="Search events or organizations"
          />
        </div>
        <Button variant={activeCount ? "secondary" : "outline"} onClick={() => setOpen((o) => !o)} aria-expanded={open} className="h-9">
          <SlidersHorizontal /> Filters{activeCount ? ` · ${activeCount}` : ""}
        </Button>
      </div>
      {open && (
        <div className="flex flex-wrap items-center gap-2">
          {select("type", "Any type", Object.entries(EVENT_TYPE_LABEL))}
          {select("domain", "Any domain", DOMAINS.map((d) => [d.value, d.label]))}
          {select("mode", "Any mode", Object.entries(MODE_LABEL))}
          {select("fee", "Free or paid", [["free", "Free"], ["paid", "Paid"]])}
          {select("within", "Any deadline", [["2", "Closes in 2 days"], ["7", "Closes in 7 days"], ["14", "Closes in 14 days"], ["30", "Closes in 30 days"]])}
          {select("size", "Solo or team", [["solo", "Solo"], ["team", "Team"]])}
          <label className={cn("flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs sm:text-sm", params.get("beginner") && "border-primary text-primary")}>
            <input
              type="checkbox"
              checked={params.get("beginner") === "1"}
              onChange={(e) => update({ beginner: e.target.checked ? "1" : null })}
            />
            Beginner-friendly
          </label>
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => update(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))}>
              <X /> Clear
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
