"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createOrganization } from "@/app/actions/orgs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "@/components/form";
import { ImageUpload } from "@/components/image-upload";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export function OrgForm({ userId, collegeName }: { userId: string; collegeName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [type, setType] = useState<"club" | "department" | "community" | "company">("club");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});

  return (
    <form
      className="mt-6 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await createOrganization({ name, slug, type, description, logoUrl });
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            toast.error(res.error);
            return;
          }
          toast.success("Club added");
          router.push(`/orgs/${res.data.slug}`);
        });
      }}
    >
      <Field label="Name" htmlFor="name" error={errors.name?.[0]}>
        <Input
          id="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          placeholder="COEP AI Club"
          required
        />
      </Field>
      <Field label="URL" htmlFor="slug" hint={`gotnext/orgs/${slug || "your-club"}`} error={errors.slug?.[0]}>
        <Input
          id="slug"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          required
        />
      </Field>
      <Field label="Type" htmlFor="type" hint={`Linked to ${collegeName}.`}>
        <NativeSelect id="type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="club">Club</option>
          <option value="department">Department</option>
          <option value="community">Community</option>
        </NativeSelect>
      </Field>
      <Field label="Description" htmlFor="description" error={errors.description?.[0]}>
        <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Logo">
        <ImageUpload bucket="logos" userId={userId} value={logoUrl} onChange={setLogoUrl} aspect="aspect-square" label="Upload logo" />
      </Field>
      <Button type="submit" size="lg" disabled={pending} className="self-end">
        {pending ? "Creating…" : "Add club"}
      </Button>
    </form>
  );
}
