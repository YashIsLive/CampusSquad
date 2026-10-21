import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { needsConsent, requireUser } from "@/lib/auth";
import { safeNext } from "@/lib/auth-errors";
import { ConsentForm } from "./consent-form";

export const metadata: Metadata = { title: "Before you continue" };

/** One-time check for accounts made before consent was recorded, or after the terms changed. */
export default async function ConsentPage({ searchParams }: PageProps<"/consent">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  const user = await requireUser({ next: "/consent", allowUnonboarded: true });
  if (!needsConsent(user)) redirect(next);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-10 sm:py-16">
      <h1 className="text-4xl leading-[0.95] font-black">One quick thing</h1>
      <p className="text-muted-foreground">
        {user.termsAcceptedAt
          ? "We've updated our terms and privacy policy. Please have a look and confirm to carry on."
          : "Before you carry on, please confirm your age and that you agree to how Got Next works."}{" "}
        You can <Link href="/account" className="underline">download or delete your data</Link> any time.
      </p>
      <div className="rounded-2xl border border-ink bg-card p-5">
        <ConsentForm next={next} />
      </div>
    </div>
  );
}
