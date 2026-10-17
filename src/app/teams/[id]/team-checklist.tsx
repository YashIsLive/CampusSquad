"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addTask, deleteTask, toggleTask } from "@/app/actions/workspace";
import { Input } from "@/components/ui/input";
import { RealtimeRefresh } from "@/components/realtime-refresh";

type Task = { id: string; title: string; done: boolean };

export function TeamChecklist({ teamId, initial }: { teamId: string; initial: Task[] }) {
  const [tasks, setTasks] = useState(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  const [title, setTitle] = useState("");
  const [, startTransition] = useTransition();

  // Teammates' edits arrive via RealtimeRefresh → new `initial` from the server.
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setTasks(initial);
  }

  const done = tasks.filter((t) => t.done).length;

  return (
    <section data-tour="checklist" className="rounded-lg border border-rule bg-card p-4">
      <RealtimeRefresh channel={`team-tasks:${teamId}`} table="team_tasks" filter={`team_id=eq.${teamId}`} />
      <h2 className="mb-2 flex items-center justify-between text-lg font-bold">
        Checklist
        {tasks.length > 0 && (
          <span className="text-xs font-normal text-muted-foreground">
            {done}/{tasks.length} done
          </span>
        )}
      </h2>
      <ul className="flex flex-col gap-1">
        {tasks.map((t) => (
          <li key={t.id} className="group flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={t.done}
              aria-label={t.title}
              onChange={(e) => {
                const checked = e.target.checked;
                setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: checked } : x)));
                startTransition(async () => {
                  const res = await toggleTask({ taskId: t.id, done: checked });
                  if (!res.ok) toast.error(res.error);
                });
              }}
              className="size-4 accent-primary"
            />
            <span className={t.done ? "flex-1 text-muted-foreground line-through" : "flex-1"}>{t.title}</span>
            <button
              type="button"
              aria-label={`Delete ${t.title}`}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100"
              onClick={() => {
                setTasks((prev) => prev.filter((x) => x.id !== t.id));
                startTransition(async () => {
                  const res = await deleteTask({ taskId: t.id });
                  if (!res.ok) toast.error(res.error);
                });
              }}
            >
              <Trash2 className="size-3.5 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = title.trim();
          if (!value) return;
          setTitle("");
          startTransition(async () => {
            const res = await addTask({ teamId, title: value });
            if (!res.ok) return void toast.error(res.error);
            setTasks((prev) => (prev.some((x) => x.id === res.data.id) ? prev : [...prev, { id: res.data.id, title: value, done: false }]));
          });
        }}
      >
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task and press Enter" className="h-8" maxLength={200} />
      </form>
    </section>
  );
}
