import type { ReactNode } from "react";

/** Where people reach us about privacy, data requests and complaints. Set NEXT_PUBLIC_CONTACT_EMAIL. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "privacy@gotnext.example";

/** Shared layout for the privacy policy and terms: short sections, plain language. */
export function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro: ReactNode; children: ReactNode }) {
  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:py-10">
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
