import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { signInWithGoogle } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { isGoogleEnabled } from "@/lib/auth-providers";
import { Button } from "@/components/ui/button";
import { TeamSheet } from "@/components/team-sheet";
import { UserAvatar } from "@/components/user-avatar";
import { safeNext } from "@/lib/auth-errors";
import { AuthPanel } from "./auth-panel";
import { emailAuthEnabled } from "@/lib/auth-config";
import { SIGNUPS_PAUSED_MESSAGE, signupsPaused } from "@/lib/switches";

const DEMO_USERS = [
  { handle: "riya", name: "Riya Kulkarni", role: "Organizer · COEP AI Club · admin" },
  { handle: "aarav", name: "Aarav Deshmukh", role: "Free agent, no team yet" },
  { handle: "neha", name: "Neha Joshi", role: "Team leader · Signal Shifters" },
  { handle: "dev", name: "Dev Agarwal", role: "Team leader · Kachra Kart, PICT" },
  { handle: "meera", name: "Meera Nair", role: "Applicant · PICT" },
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  const modeParam = typeof sp.mode === "string" ? sp.mode : "";
  const emailEnabled = emailAuthEnabled();
  const mode = modeParam === "signup" || modeParam === "signin" || modeParam === "forgot" || (modeParam === "link" && emailEnabled) ? modeParam : "signin";
  const error = typeof sp.error === "string" ? sp.error : null;
  if (await getCurrentUser()) redirect(next);
  const google = await isGoogleEnabled();
  const demo = process.env.E2E_TEST_LOGIN === "1" && process.env.NODE_ENV !== "production";

  return (
    <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 py-10 motion-safe:animate-page-in lg:grid-cols-[1fr_1fr] lg:py-16">
      <div className="flex w-full max-w-md flex-col gap-6 justify-self-center lg:justify-self-start">
        <div>
          <h1 className="text-5xl leading-[0.95] font-black">{mode === "signup" ? "Get in the game." : "Welcome back."}</h1>
          <p className="mt-3 text-muted-foreground">
            Use your <strong className="font-semibold text-foreground">college Google account</strong> and we&apos;ll know your
            college straight away. Or use an email and password. No college email? You can prove your college later with your
            student ID.
          </p>
        </div>

        {signupsPaused() && (
          <p role="status" className="rounded-xl border border-ink bg-card px-4 py-3 text-sm">
            {SIGNUPS_PAUSED_MESSAGE}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-4 rounded-xl border border-ink bg-card p-5">
          {google && (
            <>
              <form action={signInWithGoogle.bind(null, next)}>
                <Button type="submit" variant="outline" size="lg" className="w-full">
                  Continue with Google
                </Button>
              </form>
              <div className="label-mono flex items-center gap-3 text-muted-foreground">
                <span className="h-px flex-1 bg-rule" /> or <span className="h-px flex-1 bg-rule" />
              </div>
            </>
          )}
          <AuthPanel next={next} initialMode={mode} emailEnabled={emailEnabled} />
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            privacy policy
          </Link>
          . Got Next is for students aged 18 and over.
        </p>

        {demo && (
          <section aria-labelledby="demo-heading" className="rounded-lg border border-dashed border-rule-strong p-4">
            <h2 id="demo-heading" className="label-mono text-muted-foreground">
              Demo cast · dev only
            </h2>
            <p className="mb-2 text-xs text-muted-foreground">Sign in as a seed user without email.</p>
            <ul className="flex flex-col">
              {DEMO_USERS.map((u) => (
                <li key={u.handle}>
                  <Link
                    href={`/api/test-login?u=${u.handle}&next=${encodeURIComponent(next)}`}
                    prefetch={false}
                    className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-secondary"
                  >
                    <UserAvatar name={u.name} className="size-8" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{u.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{u.role}</span>
                    </span>
                    <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <StudentPass />
    </div>
  );
}

/** What you're signing up for: a team with a spot that has your name on it. */
function StudentPass() {
  return (
    <figure aria-hidden="true" className="relative hidden w-[23rem] justify-self-center lg:block">
      <TeamSheet
        className="motion-safe:animate-rise"
        name="Byte Club"
        subtitle="Teams of 2–4 · COEP AI Hackathon"
        size={4}
        members={[
          { id: "1", name: "Riya Kulkarni", detail: "Team lead · React, Node.js" },
          { id: "2", name: "Kabir Patil", detail: "Backend · Go, PostgreSQL" },
        ]}
        openings={[{ id: "3", role: "You?", detail: "ML engineer · Python, PyTorch" }]}
      />
      <figcaption className="mt-4 text-center text-sm text-muted-foreground">Somebody&apos;s always got next.</figcaption>
    </figure>
  );
}
