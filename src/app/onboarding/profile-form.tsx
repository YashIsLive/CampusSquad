"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { saveProfile } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormSection, NativeSelect } from "@/components/form";
import { SkillPicker, type PickedSkill, type SkillOption } from "@/components/skill-picker";
import { emailMatchesDomain } from "@/lib/college";

type College = { id: string; name: string; city: string; emailDomain: string | null };
const NEW_COLLEGE = "__new__";

export function ProfileForm({
  email,
  next,
  colleges,
  skills,
  initial,
}: {
  email: string;
  next: string | null;
  colleges: College[];
  skills: SkillOption[];
  initial: {
    name: string;
    username: string;
    collegeId: string | null;
    year: number | null;
    branch: string;
    bio: string;
    githubUrl: string;
    linkedinUrl: string;
    openToCrossCollege: boolean;
    skills: PickedSkill[];
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [form, setForm] = useState({
    ...initial,
    collegeChoice: initial.collegeId ?? "",
    year: initial.year?.toString() ?? "",
  });
  const [newCollege, setNewCollege] = useState({ name: "", city: "", state: "" });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const chosen = colleges.find((c) => c.id === form.collegeChoice);
  const willVerify = Boolean(chosen?.emailDomain && emailMatchesDomain(email, chosen.emailDomain));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await saveProfile({
        name: form.name,
        username: form.username,
        collegeId: form.collegeChoice && form.collegeChoice !== NEW_COLLEGE ? form.collegeChoice : null,
        newCollege: form.collegeChoice === NEW_COLLEGE ? newCollege : null,
        year: form.year ? Number(form.year) : null,
        branch: form.branch,
        bio: form.bio,
        githubUrl: form.githubUrl,
        linkedinUrl: form.linkedinUrl,
        openToCrossCollege: form.openToCrossCollege,
        skills: form.skills,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success("Profile saved");
      router.push(next ?? `/u/${res.data.username}`);
      router.refresh();
    });
  }

  const err = (k: string) => errors[k]?.[0];

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
      <FormSection title="About you">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="name" error={err("name")}>
            <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </Field>
          <Field label="Username" htmlFor="username" hint="Your profile URL: /u/username" error={err("username")}>
            <Input id="username" value={form.username} onChange={(e) => set("username", e.target.value)} required />
          </Field>
        </div>
        <Field label="Bio" htmlFor="bio" hint="One or two lines: what you build, what you want to learn." error={err("bio")}>
          <Textarea id="bio" rows={2} value={form.bio} onChange={(e) => set("bio", e.target.value)} maxLength={500} />
        </Field>
      </FormSection>

      <FormSection title="College" description="Verified students get a badge and can create organizations.">
        <Field label="College" htmlFor="college">
          <NativeSelect id="college" value={form.collegeChoice} onChange={(e) => set("collegeChoice", e.target.value)}>
            <option value="">Select your college</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.city}
              </option>
            ))}
            <option value={NEW_COLLEGE}>My college isn&apos;t listed…</option>
          </NativeSelect>
        </Field>
        {chosen &&
          (willVerify ? (
            <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
              <BadgeCheck className="size-4" /> Your email ({email}) matches {chosen.emailDomain} — you&apos;ll be verified.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {chosen.emailDomain
                ? `Sign in with your @${chosen.emailDomain} email to get verified. You can still use everything else.`
                : "This college has no verified email domain yet, so you'll show as unverified."}
            </p>
          ))}
        {form.collegeChoice === NEW_COLLEGE && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="College name" error={err("newCollege")}>
              <Input value={newCollege.name} onChange={(e) => setNewCollege({ ...newCollege, name: e.target.value })} />
            </Field>
            <Field label="City">
              <Input value={newCollege.city} onChange={(e) => setNewCollege({ ...newCollege, city: e.target.value })} />
            </Field>
            <Field label="State">
              <Input value={newCollege.state} onChange={(e) => setNewCollege({ ...newCollege, state: e.target.value })} />
            </Field>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Year" htmlFor="year">
            <NativeSelect id="year" value={form.year} onChange={(e) => set("year", e.target.value)}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Branch" htmlFor="branch">
            <Input id="branch" value={form.branch} onChange={(e) => set("branch", e.target.value)} placeholder="Computer Engineering" />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Skills" description="Pick what you can actually do. Levels: 1 beginner → 5 expert.">
        <SkillPicker options={skills} value={form.skills} onChange={(v) => set("skills", v)} withLevels />
        {err("skills") && <p className="text-xs text-destructive">{err("skills")}</p>}
      </FormSection>

      <FormSection title="Proof of work">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="GitHub" htmlFor="github" error={err("githubUrl")}>
            <Input id="github" type="url" placeholder="https://github.com/you" value={form.githubUrl} onChange={(e) => set("githubUrl", e.target.value)} />
          </Field>
          <Field label="LinkedIn" htmlFor="linkedin" error={err("linkedinUrl")}>
            <Input id="linkedin" type="url" placeholder="https://linkedin.com/in/you" value={form.linkedinUrl} onChange={(e) => set("linkedinUrl", e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>
            <span className="font-medium">Open to cross-college teams</span>
            <span className="block text-muted-foreground">Leaders from other colleges can invite you.</span>
          </span>
          <Switch checked={form.openToCrossCollege} onCheckedChange={(v) => set("openToCrossCollege", v)} />
        </label>
      </FormSection>

      <div className="sticky bottom-16 flex justify-end gap-2 rounded-xl border bg-background/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
