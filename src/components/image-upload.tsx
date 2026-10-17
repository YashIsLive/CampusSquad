"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Uploads straight to Supabase Storage under `<bucket>/<uid>/…` (storage RLS only allows a user's own folder)
 * and reports the public URL.
 */
export function ImageUpload({
  bucket,
  userId,
  value,
  onChange,
  aspect = "aspect-[4/5]",
  label = "Upload image",
}: {
  bucket: "posters" | "avatars" | "logos";
  userId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  aspect?: string;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Pick an image file.");
    if (file.size > MAX_BYTES) return toast.error("Image must be under 5 MB.");
    setUploading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "31536000",
        contentType: file.type,
      });
      if (error) throw error;
      onChange(supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        aria-label={value ? `${label}: replace current image` : label}
        onClick={() => input.current?.click()}
        className={`relative grid w-32 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed bg-muted/40 text-muted-foreground hover:bg-muted ${aspect}`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded preview of arbitrary size
          <img src={value} alt="" className="absolute inset-0 size-full object-cover" />
        ) : uploading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <ImagePlus className="size-6" />
        )}
      </button>
      <div className="flex flex-col gap-2 text-sm">
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={uploading}>
          {uploading ? "Uploading…" : value ? "Replace" : label}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X /> Remove
          </Button>
        )}
        <p className="text-xs text-muted-foreground">PNG or JPG, up to 5 MB.</p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
