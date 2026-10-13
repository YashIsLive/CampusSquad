"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { sendMessage } from "@/app/actions/workspace";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

type Person = { id: string; name: string; avatarUrl: string | null };
type Message = { id: string; body: string; createdAt: string; sender: Person; pending?: boolean };
type MessageRow = { id: string; team_id: string; sender_id: string; body: string; created_at: string };

const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", day: "numeric", month: "short" });

/** Team chat. Messages are written through a server action and fanned out by Supabase Realtime (RLS: members only). */
export function TeamChat({ teamId, me, initial, members }: { teamId: string; me: { id: string; name: string }; initial: Message[]; members: Person[] }) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const byId = new Map(members.map((m) => [m.id, m]));
    const ch = supabase
      .channel(`team-chat:${teamId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `team_id=eq.${teamId}` },
        (msg: RealtimePostgresInsertPayload<MessageRow>) => {
          const row = msg.new;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: row.id,
                    body: row.body,
                    createdAt: row.created_at,
                    sender: byId.get(row.sender_id) ?? { id: row.sender_id, name: "Teammate", avatarUrl: null },
                  },
                ],
          );
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [teamId, members]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    const tempId = `temp-${crypto.randomUUID()}`;
    const self = members.find((m) => m.id === me.id) ?? { id: me.id, name: me.name, avatarUrl: null };
    setMessages((prev) => [...prev, { id: tempId, body, createdAt: new Date().toISOString(), sender: self, pending: true }]);
    setDraft("");
    startTransition(async () => {
      const res = await sendMessage({ teamId, body });
      if (!res.ok) {
        toast.error(res.error);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return;
      }
      // Swap the optimistic row for the real one (Realtime may have delivered it already).
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        return withoutTemp.some((m) => m.id === res.data.id)
          ? withoutTemp
          : [...withoutTemp, { id: res.data.id, body, createdAt: res.data.createdAt, sender: self }];
      });
    });
  };

  return (
    <section className="flex h-[28rem] flex-col rounded-xl border">
      <h2 className="border-b px-4 py-2.5 font-medium">Team chat</h2>
      <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-3" aria-live="polite">
        {messages.length === 0 && <p className="m-auto text-sm text-muted-foreground">Say hi to your team 👋</p>}
        {messages.map((m) => {
          const mine = m.sender.id === me.id;
          return (
            <div key={m.id} className={cn("flex gap-2", mine && "flex-row-reverse")}>
              {!mine && <UserAvatar name={m.sender.name} src={m.sender.avatarUrl} className="size-7" />}
              <div className={cn("max-w-[80%] rounded-2xl px-3 py-1.5 text-sm", mine ? "bg-primary text-primary-foreground" : "bg-muted", m.pending && "opacity-60")}>
                {!mine && <p className="text-xs font-medium opacity-70">{m.sender.name}</p>}
                <p className="break-words whitespace-pre-wrap">{m.body}</p>
                <p className="mt-0.5 text-[10px] opacity-60">{timeFmt.format(new Date(m.createdAt))}</p>
              </div>
            </div>
          );
        })}
      </div>
      <form
        className="flex gap-2 border-t p-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message your team" maxLength={2000} aria-label="Message" />
        <Button type="submit" size="icon" aria-label="Send" disabled={!draft.trim()}>
          <Send />
        </Button>
      </form>
    </section>
  );
}
