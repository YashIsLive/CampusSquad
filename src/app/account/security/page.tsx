import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { safeNext } from "@/lib/auth-errors";
import { adminMfaRequired } from "@/lib/mfa";
import { TwoStep } from "./two-step";
import { BackButton } from "@/components/back-button";

export const metadata: Metadata = { title: "Two-step sign-in" };

export default async function SecurityPage({ searchParams }: PageProps<"/account/security">) {
  const sp = await searchParams;
  const user = await requireUser({ next: "/account/security", allowUnonboarded: true });
  const next = typeof sp.next === "string" ? safeNext(sp.next) : null;
  const forAdmin = sp.reason === "admin";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:py-10">
      <BackButton fallback="/account" />
      <header>
        <h1 className="text-4xl leading-[0.95] font-black sm:text-5xl">Two-step sign-in</h1>
        {forAdmin && (
          <p role="status" className="mt-4 rounded-xl bg-court/45 p-4 text-sm">
            Admin tools and student ID photos need two-step sign-in. Set it up below, or enter a code from your app if it&apos;s already
            on, then you&apos;ll go straight back.
          </p>
        )}
        {!forAdmin && (user.isAdmin && adminMfaRequired()) && (
          <p className="mt-4 text-sm text-muted-foreground">As an admin, you need this on to use the admin tools.</p>
        )}
      </header>
      <section className="rounded-2xl border border-rule bg-card p-5">
        <TwoStep next={next} />
      </section>
    </div>
  );
}
