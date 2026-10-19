"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { sendApplicationMessage } from "@/app/actions/threads";
import { subscribeAsUser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

type Person = { id: string; name: string; avatarUrl: string | null };
type Message = { id: string; body: string; createdAt: string; sender: Person; pending?: boolean };
type Row = { id: string; application_id: string; sender_id: string; body: string; created_at: string };

const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", day: "numeric", month: "short" });

/** Leader ↔ applicant conversation. Writes go through a server action; Realtime (RLS: the two parties) delivers replies live. */
export function ApplicationThread({
  applicationId,
  me,
  other,
  initial,
  closed,
}: {
  applicationId: string;
  me: Person;
  other: Person;
  initial: Message[];
  closed: string | null;
}) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const people = new Map([me, other].map((p) => [p.id, p]));
    return subscribeAsUser((supabase) =>
      supabase.channel(`app-thread:${applicationId}`).on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "application_messages", filter: `application_id=eq.${applicationId}` },
        ({ new: row }: RealtimePostgresInsertPayload<Row>) =>
          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [...prev, { id: row.id, body: row.body, createdAt: row.created_at, sender: people.get(row.sender_id) ?? other }],
          ),
      ),
    );
  }, [applicationId, me, other]);

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    const tempId = `temp-${crypto.randomUUID()}`;
    setMessages((prev) => [...prev, { id: tempId, body, createdAt: new Date().toISOString(), sender: me, pending: true }]);
    setDraft("");
    startTransition(async () => {
      const res = await sendApplicationMessage({ applicationId, body });
      if (!res.ok) {
        toast.error(res.error);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setDraft(body);
        return;
      }
      setMessages((prev) => {
        const rest = prev.filter((m) => m.id !== tempId);
        return rest.some((m) => m.id === res.data.id) ? rest : [...rest, { id: res.data.id, body, createdAt: res.data.createdAt, sender: me }];
      });
    });
  };

  return (
    <section aria-label={`Conversation with ${other.name}`} className="flex flex-col rounded-xl border border-rule bg-card">
      <ol ref={listRef} className="flex max-h-[60vh] min-h-48 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <li className="m-auto max-w-xs text-center text-sm text-muted-foreground">
            No messages yet. Ask a question, share a call link, or say hi to {other.name.split(" ")[0]}.
          </li>
        )}
        {messages.map((m) => {
          const mine = m.sender.id === me.id;
          return (
            <li key={m.id} className={cn("flex gap-2", mine && "flex-row-reverse")}>
              {!mine && <UserAvatar name={m.sender.name} src={m.sender.avatarUrl} className="size-7" />}
              <div className={cn("max-w-[80%] rounded-2xl px-3 py-1.5 text-sm", mine ? "bg-ink text-paper" : "bg-secondary text-foreground", m.pending && "opacity-70")}>
                <p className="break-words whitespace-pre-wrap">{m.body}</p>
                <p className={cn("mt-0.5 text-[11px]", mine ? "text-paper/80" : "text-muted-foreground")}>
                  {m.pending ? "Sending…" : timeFmt.format(new Date(m.createdAt))}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {closed ? (
        <p className="border-t border-rule px-4 py-3 text-sm text-muted-foreground">{closed}</p>
      ) : (
        <form
          className="flex items-end gap-2 border-t border-rule p-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter adds a line.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={`Message ${other.name.split(" ")[0]}`}
            aria-label={`Message ${other.name}`}
            className="max-h-40 min-h-10 resize-none"
          />
          <Button type="submit" size="icon" aria-label="Send" disabled={!draft.trim()}>
            <Send />
          </Button>
        </form>
      )}
    </section>
  );
}
