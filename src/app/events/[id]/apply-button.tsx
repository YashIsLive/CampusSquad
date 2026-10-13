"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applyToVacancy } from "@/app/actions/teams";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/form";

export function ApplyButton({
  vacancyId,
  roleTitle,
  teamName,
  screeningQuestion,
  score,
}: {
  vacancyId: string;
  roleTitle: string;
  teamName: string;
  screeningQuestion: string | null;
  score: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Apply
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply: {roleTitle}</DialogTitle>
            <DialogDescription>
              {teamName} will see your profile, skills and links. Your match score is {score}%.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await applyToVacancy({ vacancyId, message, screeningAnswer: answer || undefined });
                if (!res.ok) return void toast.error(res.error);
                toast.success("Application sent — you'll be notified when the leader decides");
                setOpen(false);
                router.refresh();
              });
            }}
          >
            <Field label="Why you?" htmlFor="apply-msg" hint="One or two lines: relevant project, what you'd own.">
              <Textarea id="apply-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} required minLength={10} maxLength={600} />
            </Field>
            {screeningQuestion && (
              <Field label={screeningQuestion} htmlFor="apply-answer">
                <Textarea id="apply-answer" rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} required maxLength={600} />
              </Field>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Send application"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
