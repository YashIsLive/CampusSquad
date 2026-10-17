"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Field, NativeSelect } from "@/components/form";
import { DOMAINS, MODE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

const MORE_KEYS = ["domain", "mode", "fee", "within", "size", "beginner"] as const;
type MoreKey = (typeof MORE_KEYS)[number];

const TYPE_CHIPS: Array<[string, string]> = [
  ["hackathon", "Hackathons"],
  ["coding_contest", "Contests"],
  ["workshop", "Workshops"],
  ["quiz", "Quizzes"],
  ["ideathon", "Ideathons"],
  ["ctf", "CTFs"],
];

const OPTIONS: Record<Exclude<MoreKey, "beginner">, { label: string; any: string; options: Array<[string, string]> }> = {
  domain: { label: "Domain", any: "Any domain", options: DOMAINS.map((d) => [d.value, d.label]) },
  mode: { label: "Mode", any: "Online or offline", options: Object.entries(MODE_LABEL) },
  fee: { label: "Fee", any: "Free or paid", options: [["free", "Free"], ["paid", "Paid"]] },
  within: {
    label: "Registration closes",
    any: "Any time",
    options: [["2", "Within 2 days"], ["7", "Within a week"], ["14", "Within 2 weeks"], ["30", "Within a month"]],
  },
  size: { label: "Participation", any: "Solo or team", options: [["solo", "Solo"], ["team", "Team"]] },
};

/** Writes filters to the URL so the server-rendered feed (and shared links) reflect them. */
export function FeedFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [sheetOpen, setSheetOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const activeMore = MORE_KEYS.filter((k) => params.get(k));
  const [panelOpen, setPanelOpen] = useState(activeMore.length > 0);

  const update = (patch: Record<string, string | null>) => {
    // A debounced update can fire after the user has already navigated away (e.g. clicked a card).
    if (window.location.pathname !== pathname) return;
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

  // "/" jumps to search, like most developer tools.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const type = params.get("type");
  const clearAll = () => update(Object.fromEntries([...MORE_KEYS, "type"].map((k) => [k, null])));

  const fields = (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {(Object.keys(OPTIONS) as Array<keyof typeof OPTIONS>).map((key) => (
        <Field key={key} label={<span className="label-mono text-muted-foreground">{OPTIONS[key].label}</span>} htmlFor={`f-${key}`}>
          <NativeSelect
            id={`f-${key}`}
            value={params.get(key) ?? ""}
            onChange={(e) => update({ [key]: e.target.value || null })}
            className={cn(params.get(key) && "border-ink font-medium")}
          >
            <option value="">{OPTIONS[key].any}</option>
            {OPTIONS[key].options.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ))}
      <label className="flex h-10 items-center gap-2 self-end rounded-md border border-input bg-card px-3 text-sm sm:h-9">
        <input
          type="checkbox"
          className="size-4 accent-[var(--ink)]"
          checked={params.get("beginner") === "1"}
          onChange={(e) => update({ beginner: e.target.checked ? "1" : null })}
        />
        Beginner-friendly
      </label>
    </div>
  );

  return (
    <div className="relative flex flex-col gap-3">
      {/* Thin progress rule while the feed re-renders. */}
      <div aria-hidden="true" className={cn("absolute -top-2 left-0 h-0.5 bg-signal transition-all duration-500", pending ? "w-2/3 opacity-100" : "w-0 opacity-0")} />

      <div className="flex gap-2">
        <div className="relative flex-1" data-tour="search">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search events or clubs"
            className="h-11 pl-9 sm:h-10"
            aria-label="Search events or clubs"
            aria-keyshortcuts="/"
          />
          <kbd className="label-mono pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded-sm border border-rule px-1.5 text-muted-foreground sm:block">
            /
          </kbd>
        </div>
        <Button
          variant={activeMore.length ? "ink" : "outline"}
          className="h-11 sm:hidden"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
        >
          <SlidersHorizontal /> Filters{activeMore.length ? ` · ${activeMore.length}` : ""}
        </Button>
        <Button
          variant={activeMore.length ? "ink" : "outline"}
          className="hidden h-10 sm:inline-flex"
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
          aria-controls="more-filters"
        >
          <SlidersHorizontal /> More filters{activeMore.length ? ` · ${activeMore.length}` : ""}
        </Button>
      </div>

      <div role="group" aria-label="Event type" data-tour="types" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TypeChip active={!type} onClick={() => update({ type: null })}>
          Everything
        </TypeChip>
        {TYPE_CHIPS.map(([value, label]) => (
          <TypeChip key={value} active={type === value} onClick={() => update({ type: type === value ? null : value })} swatch={value}>
            {label}
          </TypeChip>
        ))}
      </div>

      {panelOpen && (
        <div id="more-filters" className="hidden rounded-lg border border-rule bg-card p-3 motion-safe:animate-rise sm:block">
          {fields}
        </div>
      )}

      {activeMore.length > 0 && (
        <ul aria-label="Active filters" className="flex flex-wrap items-center gap-1.5">
          {activeMore.map((k) => {
            const value = params.get(k)!;
            const text = k === "beginner" ? "Beginner-friendly" : OPTIONS[k].options.find(([v]) => v === value)?.[1] ?? value;
            return (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => update({ [k]: null })}
                  className="flex h-8 items-center gap-1 rounded-full border border-ink bg-card pr-2 pl-3 text-xs font-medium hover:bg-secondary"
                  aria-label={`Remove filter: ${text}`}
                >
                  {text} <X className="size-3.5" />
                </button>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={clearAll} className="label-mono h-8 px-2 text-muted-foreground underline-offset-4 hover:underline">
              Clear all
            </button>
          </li>
        </ul>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-xl border-ink/20 bg-paper pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle className="font-display text-xl font-bold">Filters</SheetTitle>
            <SheetDescription>Results update as you choose.</SheetDescription>
          </SheetHeader>
          <div className="px-4">{fields}</div>
          <div className="flex gap-2 px-4">
            <Button variant="outline" className="flex-1" onClick={clearAll}>
              Clear
            </Button>
            <Button variant="ink" className="flex-1" onClick={() => setSheetOpen(false)}>
              Show results
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function TypeChip({
  active,
  onClick,
  swatch,
  children,
}: {
  active: boolean;
  onClick: () => void;
  swatch?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors",
        active ? "border-ink bg-ink text-paper" : "border-rule bg-card text-foreground hover:border-ink",
      )}
    >
      {swatch && <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: `var(--type-${swatch})` }} />}
      {children}
    </button>
  );
}
