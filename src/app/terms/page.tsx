import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage, LegalSection } from "@/components/legal";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      updated="19 October 2026"
      intro={<p>The short version: be real, be decent, and remember that events are run by their organizers, not by us.</p>}
    >
      <LegalSection title="Who can use Got Next">
        <p>College students and the clubs and communities that run tech events, aged 18 or over. One account per person.</p>
      </LegalSection>

      <LegalSection title="Be real">
        <ul>
          <li>Use your real name and your real college.</li>
          <li>Only send your own student ID, and only vouch for classmates you actually know study at your college.</li>
          <li>List skills you actually have. Teams pick people based on them.</li>
        </ul>
        <p>Faking any of this can get your account removed.</p>
      </LegalSection>

      <LegalSection title="Be decent">
        <p>
          No harassment, hate, spam or scams, in messages, team chats, event pages or anywhere else. Don&apos;t post anything you
          don&apos;t have the right to share. We can remove content and suspend or delete accounts that break these rules.
        </p>
      </LegalSection>

      <LegalSection title="Events are run by their organizers">
        <p>
          Clubs and communities post and run their own events. They&apos;re responsible for the event details being accurate, and for
          prizes, fees, venues and conduct at the event. Got Next isn&apos;t a party to any arrangement between you and an organizer
          or your teammates. If something goes wrong at an event, contact its organizers first. Tell us too if it involves someone
          misusing Got Next.
        </p>
      </LegalSection>

      <LegalSection title="Organizers">
        <ul>
          <li>Post real events you&apos;re actually running, with honest details.</li>
          <li>
            Use registrants&apos; details (name, email, college) only to run that event, and as our{" "}
            <Link href="/privacy">privacy policy</Link> describes.
          </li>
          <li>Keep your club&apos;s admin list up to date.</li>
        </ul>
      </LegalSection>

      <LegalSection title="What you post">
        <p>
          You keep ownership of what you write and upload. You let us show it on Got Next to the people it&apos;s meant for (for example,
          your application to the team lead you sent it to).
        </p>
      </LegalSection>

      <LegalSection title="No guarantees">
        <p>
          We work hard to keep Got Next running and accurate, but we provide it as it is. We can&apos;t promise it will always be
          available or error-free, and we&apos;re not liable for losses from events, teams or other users, to the extent the law allows.
        </p>
      </LegalSection>

      <LegalSection title="Leaving, and changes">
        <p>
          You can delete your account any time from <Link href="/account">Account and privacy</Link>. If we change these terms
          we&apos;ll update this page and tell you on the site. These terms are governed by the laws of India.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
