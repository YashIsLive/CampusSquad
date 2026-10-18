import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { signInWithGoogle } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { isGoogleEnabled } from "@/lib/auth-providers";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand";
import { Stamp } from "@/components/noticeboard";
import { UserAvatar } from "@/components/user-avatar";
import { safeNext } from "@/lib/auth-errors";
import { AuthPanel } from "./auth-panel";
import { emailAuthEnabled } from "@/lib/auth-config";

const DEMO_USERS = [
  { handle: "riya", name: "Riya Kulkarni", role: "Organizer · COEP AI Club · admin" },
  { handle: "aarav", name: "Aarav Deshmukh", role: "Solo student looking for a team" },
  { handle: "neha", name: "Neha Joshi", role: "Team leader · Signal Shifters" },
  { handle: "dev", name: "Dev Agarwal", role: "Team leader · Kachra Kart, PICT" },
  { handle: "meera", name: "Meera Nair", role: "Applicant · PICT" },
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  const modeParam = typeof sp.mode === "string" ? sp.mode : "";
  const emailEnabled = emailAuthEnabled();
  const mode = modeParam === "signup" || modeParam === "signin" || modeParam === "forgot" ? modeParam : emailEnabled ? "link" : "signin";
  const error = typeof sp.error === "string" ? sp.error : null;
  if (await getCurrentUser()) redirect(next);
  const google = await isGoogleEnabled();
  const demo = process.env.E2E_TEST_LOGIN === "1" && process.env.NODE_ENV !== "production";

  return (
    <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 py-10 motion-safe:animate-page-in lg:grid-cols-[1fr_1fr] lg:py-16">
      <div className="flex w-full max-w-md flex-col gap-6 justify-self-center lg:justify-self-start">
        <div>
          <p className="label-mono text-muted-foreground">{mode === "signup" ? "Create your account" : "Sign in or sign up"}</p>
          <h1 className="mt-1 text-4xl font-extrabold">{mode === "signup" ? "Join your campus board." : "Pick up where your campus is."}</h1>
          <p className="mt-2 text-muted-foreground">
            Continue with your <strong className="font-semibold text-foreground">college Google account</strong> and you&apos;re
            verified for your campus automatically — no forms, no ID upload. Or make an account with a password in seconds.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-4 rounded-lg border border-ink/20 bg-card p-5">
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

/** Illustration of what verification gets you: a campus pass, stamped by your email domain. */
function StudentPass() {
  return (
    <figure aria-hidden="true" className="relative hidden justify-self-center lg:block">
      <div className="w-[22rem] rotate-2 rounded-xl border border-ink/25 bg-card p-5 shadow-[6px_8px_0_0_rgba(26,23,20,0.10)] motion-safe:animate-rise">
        <div className="flex items-center justify-between border-b border-dashed border-rule pb-3">
          <span className="flex items-center gap-2">
            <BrandMark className="size-6" />
            <span className="label-mono font-semibold">Campus pass</span>
          </span>
          <span className="label-mono text-muted-foreground">2026–27</span>
        </div>
        <div className="flex gap-4 pt-4">
          <div className="grid size-20 place-items-center rounded-md bg-type-workshop font-display text-2xl font-extrabold text-[#f4efe4]">AD</div>
          <dl className="grid flex-1 content-start gap-1.5">
            <div>
              <dt className="label-mono text-muted-foreground">Name</dt>
              <dd className="font-display text-lg leading-tight font-bold">Aarav Deshmukh</dd>
            </div>
            <div>
              <dt className="label-mono text-muted-foreground">College</dt>
              <dd className="text-sm">COEP Technological University</dd>
            </div>
          </dl>
        </div>
        <div className="mt-4 flex flex-wrap gap-1">
          {["Python · 3", "Pandas · 3", "ML · 2"].map((s) => (
            <span key={s} className="rounded-sm border border-ink/30 px-1.5 text-xs">
              {s}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-end justify-between border-t border-dashed border-rule pt-3">
          <span className="label-mono text-muted-foreground">aarav@coeptech.ac.in</span>
          <Stamp tone="ok" className="bg-card text-sm">
            Verified
          </Stamp>
        </div>
      </div>
      <figcaption className="label-mono mt-6 text-center text-muted-foreground">Your email domain is your campus ID</figcaption>
    </figure>
  );
}
