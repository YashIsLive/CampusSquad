import type { ReactNode } from "react";
import { BackButton } from "@/components/back-button";

/** Where people reach us about privacy, data requests and complaints. Set NEXT_PUBLIC_CONTACT_EMAIL. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "privacy@gotnext.example";
/** Grievance officer under the IT Rules 2021 (a named person). Set NEXT_PUBLIC_GRIEVANCE_OFFICER. */
export const GRIEVANCE_OFFICER = process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER || "[Grievance officer's name]";
/** Who runs Got Next: legal name and postal address. Set NEXT_PUBLIC_LEGAL_ENTITY. */
export const LEGAL_ENTITY = process.env.NEXT_PUBLIC_LEGAL_ENTITY || "[Legal name and address of whoever runs Got Next]";

/** Grievance officer block: shared by the privacy policy and the terms. */
export function GrievanceOfficer() {
  return (
    <div className="rounded-xl border border-rule bg-card p-4">
      <p>
        <strong>{GRIEVANCE_OFFICER}</strong>, Grievance Officer
        <br />
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        We acknowledge complaints within 24 hours and resolve them within 15 days. Reports of content that harms someone&apos;s privacy or
        dignity are acted on within 24 hours.
      </p>
    </div>
  );
}

/** Shared layout for the privacy policy and terms: short sections, plain language. */
export function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro: ReactNode; children: ReactNode }) {
  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:py-10">
      <BackButton fallback="/" />
      <header>
        <h1 className="text-4xl leading-[0.95] font-black sm:text-5xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
        <div className="mt-4 text-lg">{intro}</div>
      </header>
      <div className="flex flex-col gap-6 text-[0.975rem] leading-relaxed [&_a]:underline [&_a]:decoration-court [&_a]:decoration-2 [&_a]:underline-offset-4 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_li]:py-0.5 [&_p]:max-w-[68ch]">
        {children}
      </div>
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
