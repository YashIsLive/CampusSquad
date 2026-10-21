import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { deletionBlockers } from "@/lib/account";
import { Button } from "@/components/ui/button";
import { DeleteAccount } from "./delete-account";

export const metadata: Metadata = { title: "Account and privacy" };

export default async function AccountPage() {
  const user = await requireUser({ next: "/account", allowUnonboarded: true });
  const blockers = await deletionBlockers(user.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:py-10">
      <header>
        <h1 className="text-4xl leading-[0.95] font-black sm:text-5xl">Account and privacy</h1>
        <p className="mt-2 text-muted-foreground">
          Signed in as <strong className="text-foreground">{user.email}</strong>. Read how we use your data in the{" "}
          <Link href="/privacy" className="underline decoration-court decoration-2 underline-offset-4">
            privacy policy
          </Link>
          .
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-2xl border border-rule bg-card p-5">
        <h2 className="text-lg font-bold">Your profile</h2>
        <p className="text-sm text-muted-foreground">Name, college, skills and links. Team leads see these when you apply.</p>
        <Button variant="outline" className="w-fit" render={<Link href="/onboarding" />}>
          Edit profile
        </Button>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-rule bg-card p-5">
        <h2 className="text-lg font-bold">Two-step sign-in</h2>
        <p className="text-sm text-muted-foreground">Ask for a code from an authenticator app when you sign in, so a stolen password isn&apos;t enough.</p>
        <Button variant="outline" className="w-fit" render={<Link href="/account/security" />}>
          Manage two-step sign-in
        </Button>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-rule bg-card p-5">
        <h2 className="text-lg font-bold">Download your data</h2>
        <p className="text-sm text-muted-foreground">
          A file with everything we hold about you: profile, skills, events, teams, applications and the messages you&apos;ve sent.
        </p>
        <Button variant="outline" className="w-fit" render={<a href="/account/export" download />}>
          <Download /> Download my data
        </Button>
      </section>

      <section aria-labelledby="delete-heading" className="flex flex-col gap-3 rounded-2xl border border-destructive/50 bg-card p-5">
        <h2 id="delete-heading" className="text-lg font-bold">
          Delete your account
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Your profile, skills, sign-ups, applications, messages and photos are deleted for good.</li>
          <li>Teams you lead pass to your longest-standing teammate. A team that&apos;s only you is removed.</li>
          <li>Announcements you posted for a club stay up, without your name.</li>
          <li>This can&apos;t be undone.</li>
        </ul>
        {blockers.length > 0 && (
          <p role="alert" className="rounded-md bg-signal-soft p-3 text-sm text-signal-ink">
            You&apos;re the only admin of{" "}
            {blockers.map((b, i) => (
              <span key={b.slug}>
                {i > 0 && ", "}
                <Link href={`/orgs/${b.slug}`} className="font-semibold underline">
                  {b.name}
                </Link>
              </span>
            ))}
            , which has upcoming events. Add another admin there first, so the event still has someone running it.
          </p>
        )}
        <DeleteAccount blocked={blockers.length > 0} />
      </section>
    </div>
  );
}
