import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { safeNext } from "@/lib/auth-errors";
import { needsMfaChallenge } from "@/lib/mfa";
import { MfaChallenge } from "./mfa-challenge";

export const metadata: Metadata = { title: "Enter your code" };

/** After sign-in, for accounts with two-step sign-in on: ask for the authenticator code. */
export default async function MfaPage({ searchParams }: PageProps<"/auth/mfa">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!(await needsMfaChallenge())) redirect(next);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-5 px-4 py-12 sm:py-20">
      <h1 className="text-4xl leading-[0.95] font-black">Enter your code</h1>
      <p className="text-muted-foreground">Open your authenticator app and type the 6-digit code for Got Next.</p>
      <MfaChallenge next={next} />
    </div>
  );
}
