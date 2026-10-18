"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, IdCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cancelIdCardRequest, submitIdCard } from "@/app/actions/verification";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

/** Uploads the ID photo to the private bucket (own folder only), then files the review request. */
export function IdCardUpload({ userId, replacing }: { userId: string; replacing: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (!TYPES.includes(file.type)) return void toast.error("Use a JPG, PNG, WebP or HEIC photo.");
    if (file.size > MAX_BYTES) return void toast.error("The photo must be under 5 MB.");
    setBusy(true);
    setPreview(URL.createObjectURL(file));
    try {
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await getSupabaseBrowserClient().storage.from("id-cards").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const res = await submitIdCard({ path });
      if (!res.ok) throw new Error(res.error);
      toast.success("Sent for review. You'll get a notification.");
      router.refresh();
    } catch (e) {
      setPreview(null);
      toast.error(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        type="file"
        accept={TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen file
        <img src={preview} alt="Your ID card photo" className="max-h-40 w-fit rounded-md border border-rule object-contain" />
      )}
      <Button type="button" variant={replacing ? "outline" : "default"} disabled={busy} onClick={() => input.current?.click()} className="w-fit">
        {busy ? <Loader2 className="animate-spin" /> : <IdCard />}
        {busy ? "Uploading…" : replacing ? "Send a different photo" : "Upload student ID photo"}
      </Button>
    </div>
  );
}

export function CancelIdCard() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await cancelIdCardRequest({});
          if (!res.ok) return void toast.error(res.error);
          toast.success("Request withdrawn and photo deleted.");
          router.refresh();
        })
      }
    >
      Withdraw and delete photo
    </Button>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
            await navigator.share({ title: "Vouch for me on CampusSquad", url });
            return;
          }
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* share sheet dismissed */
        }
      }}
    >
      {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Share my profile link"}
    </Button>
  );
}
