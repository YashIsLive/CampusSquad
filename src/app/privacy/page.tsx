import type { Metadata } from "next";
import Link from "next/link";
import { GrievanceOfficer, LEGAL_ENTITY, LegalPage, LegalSection } from "@/components/legal";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="19 October 2026"
      intro={
        <p>
          Got Next helps students find tech events and teammates. To do that we keep some information about you. This page says what,
          why, who can see it, and how to get it deleted. We don&apos;t sell your data and we don&apos;t show ads.
        </p>
      }
    >
      <LegalSection title="Who we are">
        <p>
          Got Next is run by {LEGAL_ENTITY}. We decide how your personal data is used (under India&apos;s data protection law, we&apos;re the
          &ldquo;data fiduciary&rdquo;).
        </p>
      </LegalSection>

      <LegalSection title="What we collect">
        <ul>
          <li>
            <strong>Your account:</strong> your email address and, if you use one, a password. Passwords are stored by our sign-in
            provider in a form nobody can read back, including us.
          </li>
          <li>
            <strong>Your profile:</strong> name, username, college, year, branch, skills, a short bio, GitHub and LinkedIn links, and a
            profile photo if you add one.
          </li>
          <li>
            <strong>What you do here:</strong> events you sign up for or save, teams you join, spots you apply for, messages you send to
            your team or a team lead, and whether you checked in at an event.
          </li>
          <li>
            <strong>A student ID photo, only if you choose to send one</strong> to prove your college. See below.
          </li>
          <li>
            <strong>Cookies</strong> that keep you signed in and remember a browser you&apos;ve confirmed with an email code (for 30 days).
            No advertising or tracking cookies.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Who can see what">
        <ul>
          <li>
            <strong>Anyone</strong> can see your public profile: name, username, college, year, branch, skills, endorsements, links,
            and how often you turn up to events you signed up for. Your email address is never shown publicly.
          </li>
          <li>
            <strong>Team leads</strong> see your profile and what you wrote when you apply for a spot on their team.
          </li>
          <li>
            <strong>Event organizers</strong> see the name, email, college, year, branch and team of everyone who signs up for their
            event, so they can run it and check people in.
          </li>
          <li>
            <strong>Your team</strong> sees the team chat and checklist. Nobody outside the team can.
          </li>
          <li>
            <strong>Got Next admins</strong> can see account details to approve colleges and clubs, review ID cards and deal with abuse.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Student ID photos">
        <p>
          If your college doesn&apos;t give you a college email, you can prove you study there with a photo of your student ID. The photo
          is stored privately. Only a Got Next admin, or an admin of a verified club at your college, can view it, through a link that
          stops working after 10 minutes. <strong>We delete the photo as soon as it&apos;s been reviewed</strong>, whether it was approved
          or not. You can cover your ID number and photo before uploading.
        </p>
      </LegalSection>

      <LegalSection title="Why we use it">
        <ul>
          <li>To run your account and show you events near your college.</li>
          <li>To match you with teams, and teams with you, based on your skills.</li>
          <li>To send you what you asked for: sign-in codes, reminders, team invites and messages.</li>
          <li>To keep the site safe: stop spam, fake accounts and abuse.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Who we share it with">
        <p>
          Only the services that run Got Next for us: Supabase (database, sign-in and file storage), Vercel (hosting) and our email
          provider (sign-in codes and notifications). They process data on our behalf and can&apos;t use it for anything else. We share
          data with anyone else only if the law requires it.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          As long as you have an account. ID photos are deleted once reviewed. When you delete your account, your data is removed
          straight away. Backups that might still contain it are overwritten within 30 days.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>Under India&apos;s Digital Personal Data Protection Act, 2023, you can:</p>
        <ul>
          <li>
            <strong>See your data:</strong> download it any time from <Link href="/account">Account and privacy</Link>.
          </li>
          <li>
            <strong>Correct it:</strong> <Link href="/onboarding">edit your profile</Link>.
          </li>
          <li>
            <strong>Delete it:</strong> delete your account from <Link href="/account">Account and privacy</Link>.
          </li>
          <li>
            <strong>Nominate someone</strong> to use these rights for you if you die or can&apos;t act yourself: email us their name and
            how to reach them.
          </li>
          <li>
            <strong>Complain:</strong> to our grievance officer (below). If you&apos;re not satisfied with the answer, you can go to the
            Data Protection Board of India.
          </li>
        </ul>
        <GrievanceOfficer />
      </LegalSection>

      <LegalSection title="Age">
        <p>Got Next is for college students aged 18 or over. If you&apos;re under 18, please don&apos;t create an account.</p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>If we change how we use your data, we&apos;ll update this page and tell you on the site before the change applies.</p>
      </LegalSection>
    </LegalPage>
  );
}
