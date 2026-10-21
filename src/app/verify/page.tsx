import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { BadgeCheck, IdCard, Mail, Users } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { emailMatchesDomain } from "@/lib/college";
import { siteUrl, relative } from "@/lib/format";
import { isGoogleEnabled } from "@/lib/auth-providers";
import { VOUCHES_NEEDED, countValidVouches } from "@/lib/verification";
import { signInWithGoogle } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Stamp } from "@/components/noticeboard";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { CancelIdCard, CopyLink, IdCardUpload } from "./verify-controls";
import { BackButton } from "@/components/back-button";

export const metadata: Metadata = { title: "Prove your college" };

const VIA_LABEL = { email: "college email", id_card: "student ID card", vouch: "classmate vouches", admin: "an admin" } as const;

export default async function VerifyPage() {
  const user = await requireUser({ next: "/verify" });
  const college = user.college;

  const [latest, vouches, google] = await Promise.all([
    db.query.verificationRequests.findFirst({
      where: and(eq(schema.verificationRequests.userId, user.id)),
      orderBy: desc(schema.verificationRequests.createdAt),
    }),
    college ? countValidVouches(user.id, college.id) : 0,
    isGoogleEnabled(),
  ]);
  const pending = latest?.status === "pending" ? latest : null;
  const rejected = latest?.status === "rejected" ? latest : null;
  const emailOnDomain = Boolean(college?.emailDomain && emailMatchesDomain(user.email, college.emailDomain));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:py-10">
      <RealtimeRefresh channel={`verify:${user.id}`} table="notifications" filter={`user_id=eq.${user.id}`} events="INSERT" />
      <BackButton fallback="/account" />
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl leading-[0.95] font-black sm:text-5xl">Prove your college</h1>
        <p className="text-muted-foreground">
          The badge tells teams you really study where you say you do. You need it for campus-only events and to start a club page.
        </p>
      </header>

      {!college ? (
        <section className="rounded-xl border border-rule bg-card p-5">
          <p className="font-medium">First, pick your college.</p>
          <p className="mt-1 text-sm text-muted-foreground">Verification is always for a specific college.</p>
          <Button className="mt-3" render={<Link href="/onboarding?next=/verify" />}>
            Edit profile
          </Button>
        </section>
      ) : user.collegeVerified ? (
        <section className="flex items-start gap-3 rounded-lg border border-ok/40 bg-card p-5">
          <BadgeCheck className="mt-0.5 size-6 shrink-0 text-ok" aria-hidden="true" />
          <div>
            <p className="font-medium">You&apos;re verified at {college.name}.</p>
            <p className="text-sm text-muted-foreground">
              Verified by {VIA_LABEL[user.collegeVerifiedVia ?? "email"]}. Changing college in your profile removes the badge.
            </p>
            <Button className="mt-3" variant="outline" render={<Link href={`/u/${user.username}`} />}>
              See your profile
            </Button>
          </div>
        </section>
      ) : (
        <>
          <p className="text-sm">
            Verifying for <strong>{college.name}</strong>. Pick whichever is easiest; any one of these works.{" "}
            <Link href="/onboarding?next=/verify" className="underline">
              Wrong college?
            </Link>
          </p>

          {/* 1. College email */}
          <Method icon={<Mail />} title="College email" tag={emailOnDomain ? "Fastest" : undefined}>
            {emailOnDomain ? (
              <>
                <p>
                  Your account uses <strong>{user.email}</strong>, which belongs to {college.name}. Prove you own it and the
                  badge appears instantly.
                </p>
                {google && (
                  <form action={signInWithGoogle.bind(null, "/verify")}>
                    <Button type="submit" variant="outline" className="mt-2">
                      Continue with Google as {user.email}
                    </Button>
                  </form>
                )}
                <p className="text-xs text-muted-foreground">Or sign out and sign back in with an email link to this address.</p>
              </>
            ) : college.emailDomain ? (
              <p>
                Only works for accounts registered with an <strong>@{college.emailDomain}</strong> address. Yours is{" "}
                {user.email}, so use one of the options below.
              </p>
            ) : (
              <p>{college.name} doesn&apos;t have a student email domain on file. Use one of the options below.</p>
            )}
          </Method>

          {/* 2. Student ID card */}
          <Method icon={<IdCard />} title="Student ID card" tag={!emailOnDomain ? "Works for everyone" : undefined}>
            {pending ? (
              <>
                <p>
                  <Stamp tone="ink">In review</Stamp> Sent {relative(pending.createdAt)}. An admin or a verified club lead at your college
                  will check it, usually within a day.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <IdCardUpload userId={user.id} replacing />
                  <CancelIdCard />
                </div>
              </>
            ) : (
              <>
                {rejected && (
                  <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <strong>Your last photo wasn&apos;t accepted:</strong> {rejected.note ?? "no reason given"}. Try again with a clearer photo.
                  </p>
                )}
                <p>
                  Upload a photo of the front of your college ID. Your name and college should be readable. You can cover the ID number
                  and photo if you like.
                </p>
                <IdCardUpload userId={user.id} replacing={false} />
              </>
            )}
            <p className="text-xs text-muted-foreground">
              Private: only reviewers can see it, through a link that expires in 10 minutes. The photo is deleted as soon as it&apos;s
              reviewed.
            </p>
          </Method>

          {/* 3. Vouches */}
          <Method icon={<Users />} title="Vouches from classmates" tag={`${Math.min(vouches, VOUCHES_NEEDED)} of ${VOUCHES_NEEDED}`}>
            <p>
              Ask {VOUCHES_NEEDED} verified students at {college.name} to open your profile and tap <strong>Vouch</strong>. You&apos;re verified
              the moment the second one does.
            </p>
            <div aria-hidden="true" className="flex gap-1.5">
              {Array.from({ length: VOUCHES_NEEDED }, (_, i) => (
                <span key={i} className={i < vouches ? "h-2 w-10 rounded-full bg-ok" : "h-2 w-10 rounded-full bg-muted"} />
              ))}
            </div>
            <CopyLink url={`${siteUrl()}/u/${user.username}`} />
          </Method>
        </>
      )}
    </div>
  );
}

function Method({ icon, title, tag, children }: { icon: React.ReactNode; title: string; tag?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-rule bg-card p-5 text-sm">
      <h2 className="flex items-center gap-2 text-lg font-bold [&_svg]:size-5">
        {icon} {title}
        {tag && <span className="label-mono ml-auto text-muted-foreground">{tag}</span>}
      </h2>
      {children}
    </section>
  );
}
