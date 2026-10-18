"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createEvent, updateEvent, type EventInput } from "@/app/actions/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormSection, NativeSelect } from "@/components/form";
import { ImageUpload } from "@/components/image-upload";
import { DOMAINS, EVENT_TYPE_LABEL, MODE_LABEL, SCOPE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

type Org = { id: string; name: string; hasCollege: boolean };
export type EventFormValues = Omit<EventInput, "publish">;

export function EventForm({
  userId,
  orgs,
  initial,
  eventId,
  isPublished = false,
}: {
  userId: string;
  orgs: Org[];
  initial: EventFormValues;
  eventId?: string;
  isPublished?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const set = <K extends keyof EventFormValues>(k: K, val: EventFormValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const err = (k: string) => errors[k]?.[0];
  const org = orgs.find((o) => o.id === v.orgId);

  function submit(publish: boolean) {
    setErrors({});
    startTransition(async () => {
      const res = eventId ? await updateEvent({ ...v, publish, eventId }) : await createEvent({ ...v, publish });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success(publish ? "Event published" : "Saved as draft");
      router.push(`/events/${res.data.id}`);
      router.refresh();
    });
  }

  const solo = v.teamMax === 1;

  return (
    <form
      className="mt-6 flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit(true);
      }}
    >
      <FormSection title="Basics">
        <Field label="Hosted by" htmlFor="org" error={err("orgId")}>
          <NativeSelect id="org" value={v.orgId} onChange={(e) => set("orgId", e.target.value)} required>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Title" htmlFor="title" error={err("title")}>
          <Input id="title" value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="COEP AI Hackathon 2026" required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" htmlFor="type">
            <NativeSelect id="type" value={v.type} onChange={(e) => set("type", e.target.value as EventFormValues["type"])}>
              {Object.entries(EVENT_TYPE_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Mode" htmlFor="mode">
            <NativeSelect id="mode" value={v.mode} onChange={(e) => set("mode", e.target.value as EventFormValues["mode"])}>
              {Object.entries(MODE_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field label="Domains" error={err("domainTags")}>
          <div className="flex flex-wrap gap-1.5">
            {DOMAINS.map((d) => {
              const on = v.domainTags.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    set("domainTags", on ? v.domainTags.filter((t) => t !== d.value) : [...v.domainTags, d.value])
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm",
                    on ? "border-ink bg-signal-soft text-signal-ink" : "hover:bg-muted",
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Description" htmlFor="description" error={err("description")}>
          <Textarea id="description" rows={4} value={v.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label="Poster" hint="Shown on the event page and in link previews.">
          <ImageUpload bucket="posters" userId={userId} value={v.posterUrl} onChange={(url) => set("posterUrl", url)} />
        </Field>
      </FormSection>

      <FormSection title="When & where" description="Times are in IST.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Starts" htmlFor="startsAt" error={err("startsAt")}>
            <Input id="startsAt" type="datetime-local" value={v.startsAt} onChange={(e) => set("startsAt", e.target.value)} required />
          </Field>
          <Field label="Ends" htmlFor="endsAt" error={err("endsAt")}>
            <Input id="endsAt" type="datetime-local" value={v.endsAt} onChange={(e) => set("endsAt", e.target.value)} required />
          </Field>
          <Field label="Registration deadline" htmlFor="regDeadline" error={err("regDeadline")}>
            <Input id="regDeadline" type="datetime-local" value={v.regDeadline} onChange={(e) => set("regDeadline", e.target.value)} required />
          </Field>
        </div>
        {v.mode !== "online" && (
          <Field label="Venue" htmlFor="venue" error={err("venue")}>
            <Input id="venue" value={v.venue ?? ""} onChange={(e) => set("venue", e.target.value)} placeholder="Main Auditorium, Building A" />
          </Field>
        )}
      </FormSection>

      <FormSection title="Participation">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Min team size" htmlFor="teamMin" error={err("teamMin")}>
            <Input id="teamMin" type="number" min={1} max={10} value={v.teamMin} onChange={(e) => set("teamMin", Number(e.target.value))} />
          </Field>
          <Field label="Max team size" htmlFor="teamMax" hint="1 = solo event" error={err("teamMax")}>
            <Input id="teamMax" type="number" min={1} max={10} value={v.teamMax} onChange={(e) => set("teamMax", Number(e.target.value))} />
          </Field>
        </div>
        <Field
          label="Who can register"
          htmlFor="scope"
          hint={!org?.hasCollege ? "This organization isn't tied to a college, so events are open to all India." : undefined}
        >
          <NativeSelect
            id="scope"
            value={v.eligibilityScope}
            onChange={(e) => set("eligibilityScope", e.target.value as EventFormValues["eligibilityScope"])}
          >
            {Object.entries(SCOPE_LABEL).map(([k, label]) => (
              <option key={k} value={k} disabled={!org?.hasCollege && k !== "india"}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {!solo && (
          <ToggleRow
            label="Allow cross-college teams"
            description="Teams can include students from different colleges."
            checked={v.allowCrossCollege}
            onChange={(c) => set("allowCrossCollege", c)}
          />
        )}
        <ToggleRow
          label="Beginner-friendly"
          description="Shown as a badge and filterable in the feed."
          checked={v.beginnerFriendly}
          onChange={(c) => set("beginnerFriendly", c)}
        />
        <ToggleRow label="Free to enter" checked={v.isFree} onChange={(c) => set("isFree", c)} />
        {!v.isFree && (
          <Field label="Fee" htmlFor="feeText" error={err("feeText")}>
            <Input id="feeText" value={v.feeText ?? ""} onChange={(e) => set("feeText", e.target.value)} placeholder="₹100 per team, pay at venue" />
          </Field>
        )}
        <Field label="Prizes" htmlFor="prizeText">
          <Input id="prizeText" value={v.prizeText ?? ""} onChange={(e) => set("prizeText", e.target.value)} placeholder="₹50,000 pool + internships" />
        </Field>
        <Field label="Rules (Markdown)" htmlFor="rulesMd">
          <Textarea id="rulesMd" rows={5} value={v.rulesMd ?? ""} onChange={(e) => set("rulesMd", e.target.value)} placeholder={"## Rules\n- Bring your college ID"} />
        </Field>
        <Field
          label="External registration link (optional)"
          htmlFor="externalUrl"
          hint="If official registration is on Unstop/Devfolio. Students can still find teammates here."
          error={err("externalUrl")}
        >
          <Input id="externalUrl" inputMode="url" autoCapitalize="off" spellCheck={false} value={v.externalUrl ?? ""} onChange={(e) => set("externalUrl", e.target.value)} placeholder="https://unstop.com/…" />
        </Field>
      </FormSection>

      <div className="sticky bottom-16 flex justify-end gap-2 rounded-lg border border-rule bg-card bg-background/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
        {!isPublished && (
          <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => submit(false)}>
            Save draft
          </Button>
        )}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : isPublished ? "Save changes" : "Publish"}
        </Button>
      </div>
    </form>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 text-sm">
      <span>
        <span className="font-medium">{label}</span>
        {description && <span className="block text-muted-foreground">{description}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
