"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { postVacancy } from "@/app/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, NativeSelect } from "@/components/form";
import { SkillPicker, type PickedSkill, type SkillOption } from "@/components/skill-picker";

export function PostVacancyButton({
  teamId,
  skills,
  capacityLeft,
  allowCross,
}: {
  teamId: string;
  skills: SkillOption[];
  capacityLeft: number;
  allowCross: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [roleTitle, setRoleTitle] = useState("");
  const [description, setDescription] = useState("");
  const [required, setRequired] = useState<PickedSkill[]>([]);
  const [nice, setNice] = useState<PickedSkill[]>([]);
  const [hours, setHours] = useState("");
  const [slots, setSlots] = useState(1);
  const [scope, setScope] = useState<"intra" | "cross">(allowCross ? "cross" : "intra");
  const [question, setQuestion] = useState("");

  const reset = () => {
    setRoleTitle("");
    setDescription("");
    setRequired([]);
    setNice([]);
    setHours("");
    setSlots(1);
    setQuestion("");
    setErrors({});
  };

  if (capacityLeft <= 0) {
    return <p className="text-xs text-muted-foreground">Team size limit reached</p>;
  }

  return (
    <>
      <Button size="sm" data-tour="post-role" onClick={() => setOpen(true)}>
        <Plus /> Add an open spot
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add an open spot</DialogTitle>
            <DialogDescription>Say who you need. People who apply are ranked by how many of these skills they have.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setErrors({});
              startTransition(async () => {
                const res = await postVacancy({
                  teamId,
                  roleTitle,
                  description,
                  requiredSkillIds: required.map((s) => s.skillId),
                  niceSkillIds: nice.map((s) => s.skillId),
                  commitmentHours: hours ? Number(hours) : null,
                  slots,
                  scope,
                  screeningQuestion: question,
                });
                if (!res.ok) {
                  setErrors(res.fieldErrors ?? {});
                  return void toast.error(res.error);
                }
                toast.success("Spot posted");
                setOpen(false);
                reset();
                router.refresh();
              });
            }}
          >
            <Field label="Who you need" htmlFor="role" error={errors.roleTitle?.[0]}>
              <Input id="role" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="React Native developer" required />
            </Field>
            <Field label="Must have" error={errors.requiredSkillIds?.[0]}>
              <SkillPicker options={skills} value={required} onChange={setRequired} max={6} label="Add a required skill" />
            </Field>
            <Field label="Bonus skills">
              <SkillPicker options={skills} value={nice} onChange={setNice} max={6} label="Add a nice-to-have skill" />
            </Field>
            <Field label="What they'll do" htmlFor="desc">
              <Textarea id="desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Hours / week" htmlFor="hrs">
                <Input id="hrs" type="number" min={1} max={80} value={hours} onChange={(e) => setHours(e.target.value)} />
              </Field>
              <Field label="How many" htmlFor="slots" hint={`Up to ${capacityLeft}`}>
                <Input id="slots" type="number" min={1} max={capacityLeft} value={slots} onChange={(e) => setSlots(Number(e.target.value))} />
              </Field>
              <Field label="Open to" htmlFor="scope">
                <NativeSelect id="scope" value={scope} onChange={(e) => setScope(e.target.value as "intra" | "cross")}>
                  <option value="intra">My college</option>
                  {allowCross && <option value="cross">Any college</option>}
                </NativeSelect>
              </Field>
            </div>
            <Field label="One question for applicants (optional)" htmlFor="q" hint="For example: link one project you've built.">
              <Input id="q" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} />
            </Field>
            <Button type="submit" disabled={pending}>
              {pending ? "Posting…" : "Post spot"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
