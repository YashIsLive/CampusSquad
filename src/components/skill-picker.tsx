"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SkillOption = { id: string; name: string; category: string };
export type PickedSkill = { skillId: string; level: number };

const LEVELS = ["", "Beginner", "Basic", "Comfortable", "Strong", "Expert"];

/**
 * Tag-style picker. With `withLevels`, each picked skill gets a 1–5 level selector.
 */
export function SkillPicker({
  options,
  value,
  onChange,
  withLevels = false,
  placeholder = "Search skills…",
  max = 25,
  label = "Search skills",
}: {
  options: SkillOption[];
  value: PickedSkill[];
  onChange: (v: PickedSkill[]) => void;
  withLevels?: boolean;
  placeholder?: string;
  max?: number;
  /** Accessible name for the search box. */
  label?: string;
}) {
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const picked = new Set(value.map((v) => v.skillId));
  const matches = query.trim()
    ? options
        .filter((o) => !picked.has(o.id) && o.name.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 8)
    : [];

  const add = (id: string) => {
    if (value.length >= max) return;
    onChange([...value, { skillId: id, level: 3 }]);
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <li
              key={v.skillId}
              className="flex items-center gap-1 rounded-full border bg-muted/50 py-0.5 pr-1 pl-2.5 text-sm"
            >
              <span>{byId.get(v.skillId)?.name ?? "?"}</span>
              {withLevels && (
                <select
                  aria-label={`Level for ${byId.get(v.skillId)?.name}`}
                  value={v.level}
                  onChange={(e) =>
                    onChange(value.map((x) => (x.skillId === v.skillId ? { ...x, level: Number(e.target.value) } : x)))
                  }
                  className="rounded bg-transparent text-xs text-muted-foreground"
                >
                  {[1, 2, 3, 4, 5].map((l) => (
                    <option key={l} value={l}>
                      {l} · {LEVELS[l]}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                aria-label={`Remove ${byId.get(v.skillId)?.name}`}
                onClick={() => onChange(value.filter((x) => x.skillId !== v.skillId))}
                className="grid size-5 place-items-center rounded-full hover:bg-background"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (matches[0]) add(matches[0].id);
            }
          }}
          aria-label={label}
          placeholder={value.length >= max ? `Maximum ${max} skills` : placeholder}
          disabled={value.length >= max}
          className="h-9"
        />
        {matches.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-md">
            {matches.map((m, i) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => add(m.id)}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted",
                    i === 0 && "bg-muted/50",
                  )}
                >
                  {m.name}
                  <span className="text-xs text-muted-foreground">{m.category}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
