"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, MailCheck } from "lucide-react";
import {
  sendMagicLink,
  sendPasswordReset,
  signInWithPassword,
  signUpWithPassword,
  verifyEmailCode,
} from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form";
import { cn } from "@/lib/utils";
import { PasswordInput } from "./password-input";

type Mode = "link" | "signin" | "signup" | "forgot";
const RESEND_SECONDS = 60;

/**
 * One panel for every way in. Email link is the default (no password to forget, and it proves
 * the college email). Passwords are there for people whose mail app opens links elsewhere.
 */
export function AuthPanel({ next, initialMode = "link" }: { next: string; initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<null | "link" | "signup" | "reset">(null);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setSent(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      if (mode === "link") {
        const res = await sendMagicLink({ email, next });
        if (!res.ok) return setError(res.error);
        setSent("link");
        setCooldown(RESEND_SECONDS);
      } else if (mode === "signin") {
        const res = await signInWithPassword({ email, password, next });
        if (res && !res.ok) setError(res.error);
      } else if (mode === "signup") {
        const res = await signUpWithPassword({ email, password, next: next === "/" ? "/onboarding" : next });
        if (res && !res.ok) return setError(res.error);
        if (res?.ok && res.needsConfirmation) {
          setSent("signup");
          setCooldown(RESEND_SECONDS);
        }
      } else {
        const res = await sendPasswordReset({ email });
        if (!res.ok) return setError(res.error);
        setSent("reset");
        setCooldown(RESEND_SECONDS);
      }
    });
  };

  const resend = () =>
    startTransition(async () => {
      setError(null);
      const res = sent === "reset" ? await sendPasswordReset({ email }) : await sendMagicLink({ email, next });
      if (!res.ok) return setError(res.error);
      setCooldown(RESEND_SECONDS);
    });

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await verifyEmailCode({ email, code, next });
      if (res && !res.ok) setError(res.error);
    });
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-4" aria-live="polite">
        <div className="flex gap-3 rounded-md border border-ok/40 bg-ok/10 p-3">
          <MailCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ok" />
          <div className="text-sm">
            <p className="font-medium">Check {email}</p>
            <p className="text-muted-foreground">
              {sent === "reset"
                ? "We sent a link to set a new password."
                : sent === "signup"
                  ? "Confirm your email with the link we sent, then you're in."
                  : "We sent a sign-in link. Open it on this device, or type the 6-digit code below."}{" "}
              It can take a minute — check spam too.
            </p>
          </div>
        </div>

        {sent !== "reset" && (
          <form onSubmit={submitCode} className="flex flex-col gap-2">
            <Field label="6-digit code" htmlFor="otp" hint="Only if the email shows a code." error={error ?? undefined}>
              <Input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="h-11 text-center font-mono text-lg tracking-[0.5em]"
              />
            </Field>
            <Button type="submit" variant="ink" disabled={pending || code.length !== 6}>
              Verify code
            </Button>
          </form>
        )}
        {sent === "reset" && error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button type="button" onClick={() => switchMode(mode)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Use a different email
          </button>
          <Button type="button" variant="link" size="sm" disabled={pending || cooldown > 0} onClick={resend} className="px-0">
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
          </Button>
        </div>
      </div>
    );
  }

  const usesPassword = mode === "signin" || mode === "signup";

  return (
    <div className="flex flex-col gap-4">
      {mode !== "forgot" && (
        <div role="tablist" aria-label="Sign-in method" className="grid grid-cols-2 gap-1 rounded-md bg-secondary p-1">
          {(
            [
              ["link", "Email link"],
              ["signin", "Password"],
            ] as const
          ).map(([m, label]) => {
            const active = m === "link" ? mode === "link" : usesPassword;
            return (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => switchMode(m)}
                className={cn("h-9 rounded-[5px] text-sm transition-colors", active ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-3" noValidate={false}>
        {mode === "forgot" && (
          <div>
            <h2 className="text-lg font-bold">Reset your password</h2>
            <p className="text-sm text-muted-foreground">We&apos;ll email you a link to set a new one.</p>
          </div>
        )}
        <Field label={mode === "signup" ? "College email" : "Email"} htmlFor="email" hint={mode === "signup" || mode === "link" ? "Your college address verifies you for your campus." : undefined}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@college.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "auth-error" : undefined}
            className="h-11"
          />
        </Field>

        {usesPassword && (
          <div className="flex flex-col gap-1.5">
            <Field
              label="Password"
              htmlFor="password"
              hint={mode === "signup" ? "At least 8 characters, with a letter and a number." : undefined}
            >
              <PasswordInput
                id="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={setPassword}
                invalid={Boolean(error)}
                describedBy={error ? "auth-error" : undefined}
              />
            </Field>
            {mode === "signin" && (
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="self-end py-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Forgot password?
              </button>
            )}
          </div>
        )}

        {error && (
          <p id="auth-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={pending}>
          {pending
            ? "One moment…"
            : mode === "link"
              ? "Email me a sign-in link"
              : mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : "Send reset link"}
        </Button>
      </form>

      {usesPassword && (
        <p className="text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New here? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      )}
      {mode === "link" && <p className="text-center text-xs text-muted-foreground">New or returning — the same link signs you up or in.</p>}
      {mode === "forgot" && (
        <button type="button" onClick={() => switchMode("signin")} className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to sign in
        </button>
      )}
    </div>
  );
}
