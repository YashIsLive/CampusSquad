"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, MailCheck, ShieldCheck } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { PasswordInput } from "./password-input";
import { Turnstile, turnstileOn, type TurnstileHandle } from "@/components/turnstile";

type Mode = "link" | "signin" | "signup" | "forgot";
const RESEND_SECONDS = 60;

/**
 * One panel for every way in. Password first (fast every day); when email is set up, a new account
 * confirms its address once with a code, and a password used on a new browser is confirmed with a
 * one-time code before the session starts. Trusted browsers skip that for 30 days.
 * The email link stays available as a passwordless option.
 */
export function AuthPanel({
  next,
  initialMode = "signin",
  emailEnabled = false,
}: {
  next: string;
  initialMode?: Mode;
  /** Email links/codes/reset need an SMTP sender; without one only password modes are offered. */
  emailEnabled?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(!emailEnabled && (initialMode === "link" || initialMode === "forgot") ? "signin" : initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<null | "link" | "signup" | "reset" | "device">(null);
  const [trust, setTrust] = useState(true);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();
  // Bot check token (single-use): reset after every request that spends it.
  const [captcha, setCaptcha] = useState<string | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);
  const spend = () => {
    const t = captcha;
    turnstile.current?.reset();
    return t;
  };
  const waitingForCheck = turnstileOn && !captcha;

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
        const res = await sendMagicLink({ email, next, captchaToken: spend() });
        if (!res.ok) return setError(res.error);
        setSent("link");
        setCooldown(RESEND_SECONDS);
      } else if (mode === "signin") {
        const res = await signInWithPassword({ email, password, next, captchaToken: spend() });
        if (res && !res.ok) return setError(res.error);
        if (res?.ok && res.deviceCheck) {
          setSent("device");
          setCooldown(RESEND_SECONDS);
        }
      } else if (mode === "signup") {
        const res = await signUpWithPassword({ email, password, next: next === "/" ? "/onboarding" : next, captchaToken: spend() });
        if (res && !res.ok) return setError(res.error);
        if (res?.ok && res.needsConfirmation) {
          setSent("signup");
          setCooldown(RESEND_SECONDS);
        }
      } else {
        const res = await sendPasswordReset({ email, captchaToken: spend() });
        if (!res.ok) return setError(res.error);
        setSent("reset");
        setCooldown(RESEND_SECONDS);
      }
    });
  };

  const resend = () =>
    startTransition(async () => {
      setError(null);
      const captchaToken = spend();
      const res = sent === "reset" ? await sendPasswordReset({ email, captchaToken }) : await sendMagicLink({ email, next, captchaToken });
      if (!res.ok) return setError(res.error);
      setCooldown(RESEND_SECONDS);
    });

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await verifyEmailCode({ email, code, next, trustDevice: trust });
      if (res && !res.ok) setError(res.error);
    });
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-4" aria-live="polite">
        <div className="flex gap-3 rounded-md border border-ok/40 bg-ok/10 p-3">
          {sent === "device" ? (
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ok" />
          ) : (
            <MailCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ok" />
          )}
          <div className="text-sm">
            <p className="font-medium">{sent === "device" ? "New device? Confirm it's you" : `Check ${email}`}</p>
            <p className="text-muted-foreground">
              {sent === "reset"
                ? "We sent a link to set a new password."
                : sent === "signup"
                  ? "Type the code from the email we just sent (or tap its link) to confirm your address. You only do this once."
                  : sent === "device"
                    ? `Your password is right. Because this browser is new, we sent a code to ${email}. You won't be asked again here for 30 days.`
                    : "We sent a sign-in link. Open it on this device, or type the code from the email below."}{" "}
              It can take a minute — check spam too.
            </p>
          </div>
        </div>

        {sent !== "reset" && (
          <form onSubmit={submitCode} className="flex flex-col gap-2">
            <Field label="Code from the email" htmlFor="otp" hint={sent === "link" ? "Only if the email shows a code." : undefined} error={error ?? undefined}>
              <Input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6,10}"
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="h-11 text-center font-mono text-lg tracking-[0.5em]"
              />
            </Field>
            {sent !== "link" && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={trust} onCheckedChange={(v) => setTrust(v === true)} />
                Remember this device for 30 days
              </label>
            )}
            <Button type="submit" variant="ink" disabled={pending || code.length < 6}>
              {sent === "device" ? "Confirm and sign in" : "Verify code"}
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
          <Button type="button" variant="link" size="sm" disabled={pending || cooldown > 0 || waitingForCheck} onClick={resend} className="px-0">
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
        <div role="tablist" aria-label="Sign in or create an account" className="grid grid-cols-2 gap-1 rounded-full bg-secondary p-1">
          {(
            [
              ["signin", "Sign in"],
              ["signup", "Create account"],
            ] as const
          ).map(([m, label]) => {
            const active = mode === m || (m === "signin" && mode === "link");
            return (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => switchMode(m)}
                className={cn("h-9 rounded-full text-sm transition-colors", active ? "bg-ink font-semibold text-paper" : "text-muted-foreground hover:text-foreground")}
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
        <Field label={mode === "signup" ? "College email" : "Email"} htmlFor="email" hint={
            mode === "link"
              ? "We'll email you a link and a code. No password needed."
              : mode === "signup"
                ? emailEnabled
                  ? "Use your college address if you have one: it verifies your campus automatically."
                  : "Use your college address. For the campus Verified badge, sign in with Google using it."
                : undefined
          }>
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
              hint={mode === "signup" ? "At least 10 characters, with a letter and a number." : undefined}
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
            {mode === "signin" && emailEnabled && (
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

        <Turnstile ref={turnstile} onToken={setCaptcha} />
        <Button type="submit" size="lg" disabled={pending || waitingForCheck}>
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

      {mode === "signin" && emailEnabled && (
        <button type="button" onClick={() => switchMode("link")} className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Forgot it, or no password? Email me a sign-in link
        </button>
      )}
      {mode === "link" && (
        <button type="button" onClick={() => switchMode("signin")} className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Sign in with a password instead
        </button>
      )}
      {mode === "forgot" && (
        <button type="button" onClick={() => switchMode("signin")} className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to sign in
        </button>
      )}
    </div>
  );
}
