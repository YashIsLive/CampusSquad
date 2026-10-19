"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, MessageCircle, Trash2 } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { createShareLink, deleteShareLink } from "@/app/actions/manage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Link = { id: string; label: string; code: string; clicks: number; registrations: number };

const SUGGESTED = ["CSE 2nd-yr WhatsApp", "Notice board QR", "Instagram bio", "Classroom slides"];

async function copy(text: string, what = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(what);
  } catch {
    toast.error("Couldn't copy — select and copy manually");
  }
}

export function ShareKit({
  event,
  siteUrl,
  links,
}: {
  event: { id: string; title: string; orgName: string; startsAt: string; regDeadline: string; venue: string };
  siteUrl: string;
  links: Link[];
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [pending, startTransition] = useTransition();
  const url = (code: string) => `${siteUrl}/s/${code}`;
  const primary = links[0] ? url(links[0].code) : `${siteUrl}/events/${event.id}`;

  const [caption, setCaption] = useState(
    `🚀 *${event.title}* by ${event.orgName}\n\n📅 ${event.startsAt}\n📍 ${event.venue}\n⏰ Register by ${event.regDeadline}\n\nNo team? Find teammates on the event page 👇\n${primary}`,
  );

  const downloadQr = async (l: Link) => {
    const dataUrl = await QRCode.toDataURL(url(l.code), { width: 1024, margin: 2 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${event.title}-${l.label}-qr.png`.replace(/[^a-z0-9.-]+/gi, "-");
    a.click();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="flex flex-col gap-3 rounded-xl border border-rule bg-card p-4">
        <div>
          <h2 className="text-xl font-bold">Tracked links</h2>
          <p className="text-sm text-muted-foreground">
            One link per channel. Clicks and registrations are counted separately, so you can see which WhatsApp group actually worked.
          </p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await createShareLink({ eventId: event.id, channelLabel: label });
              if (!res.ok) return void toast.error(res.error);
              setLabel("");
              void copy(url(res.data.shortCode), "Link created and copied");
              router.refresh();
            });
          }}
        >
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Channel, e.g. CSE 2nd-yr WhatsApp" list="channel-suggestions" required />
          <datalist id="channel-suggestions">
            {SUGGESTED.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <Button type="submit" disabled={pending}>
            Create
          </Button>
        </form>
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground">No links yet. Create one for each group or poster.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {links.map((l) => (
              <li key={l.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{l.label}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{url(l.code)}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.clicks} clicks · {l.registrations} registrations
                    {l.clicks > 0 && ` · ${Math.round((l.registrations / l.clicks) * 100)}% conversion`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon-sm" variant="outline" aria-label="Copy link" onClick={() => copy(url(l.code))}>
                    <Copy />
                  </Button>
                  <Button size="icon-sm" variant="outline" aria-label="Download QR code" onClick={() => void downloadQr(l)}>
                    <Download />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Delete link"
                    onClick={() =>
                      confirm("Delete this link? Existing posters with it will stop tracking.") &&
                      startTransition(async () => {
                        const res = await deleteShareLink({ shareLinkId: l.id });
                        if (!res.ok) return void toast.error(res.error);
                        router.refresh();
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-rule bg-card p-4">
        <div>
          <h2 className="text-xl font-bold">WhatsApp caption</h2>
          <p className="text-sm text-muted-foreground">Pre-written, uses your first tracked link. Edit freely.</p>
        </div>
        <Textarea rows={10} value={caption} onChange={(e) => setCaption(e.target.value)} className="font-mono text-xs" />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => copy(caption, "Caption copied")}>
            <Copy /> Copy caption
          </Button>
          <Button render={<a href={`https://wa.me/?text=${encodeURIComponent(caption)}`} target="_blank" rel="noreferrer" />}>
            <MessageCircle /> Share to WhatsApp
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          The event link shows a preview card (title, date, deadline, poster) when pasted into WhatsApp.
        </p>
      </section>
    </div>
  );
}
