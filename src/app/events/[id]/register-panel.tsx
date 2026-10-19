"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ExternalLink, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { cancelRegistration, registerForEvent } from "@/app/actions/registrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/form";
import { Stamp } from "@/components/noticeboard";

/**
 * Signing up, in one panel: the next step on top; the date, who it's for and — once you're in —
 * your entry code underneath.
 */
export function RegisterPanel(props: {
  eventId: string;
  signedIn: boolean;
  isTeamEvent: boolean;
  registered: boolean;
  checkinCode: string | null;
  checkedIn: boolean;
  team: { id: string; name: string; isLeader: boolean } | null;
  blockedReason: string | null;
  externalUrl: string | null;
  started: boolean;
  stub: { date: string; who: string; registered: number; teams: number };
}) {
  const { eventId, signedIn, isTeamEvent, registered, team, blockedReason, externalUrl, stub } = props;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [teamName, setTeamName] = useState("");
  // The entry code gets you in at the door; keep it off-screen until you ask for it.
  const [showCode, setShowCode] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(success);
      router.refresh();
    });

  return (
    <section aria-labelledby="ticket-heading" className="relative overflow-hidden rounded-xl border border-ink bg-card">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 id="ticket-heading" className="text-xl font-extrabold">
            {registered ? "You're in" : "Registration"}
          </h2>
          {registered && <Stamp tone={props.checkedIn ? "ok" : "ink"}>{props.checkedIn ? "Checked in" : "Registered"}</Stamp>}
        </div>

        {externalUrl && (
          <div className="flex flex-col gap-2 rounded-md bg-secondary p-3">
            <p className="text-sm">The organizers take sign-ups on their own site.</p>
            <Button variant="ink" render={<a href={externalUrl} target="_blank" rel="noreferrer" />}>
              Register on their site <ExternalLink />
            </Button>
            <p className="text-xs text-muted-foreground">Sign up here too if you want to find teammates.</p>
          </div>
        )}

        {!signedIn ? (
          <Button size="lg" render={<Link href={`/login?next=${encodeURIComponent(`/events/${eventId}`)}`} />}>
            Sign in to register <ArrowRight />
          </Button>
        ) : registered ? (
          <>
            {isTeamEvent &&
              (team ? (
                <Link
                  href={`/teams/${team.id}`}
                  className="group/team flex items-center justify-between rounded-lg border border-rule bg-paper px-3 py-2.5 text-sm hover:border-ink"
                >
                  <span>
                    <span className="block text-xs text-muted-foreground">{team.isLeader ? "You lead" : "Your team"}</span>
                    <strong className="font-display text-base">{team.name}</strong>
                  </span>
                  <ArrowRight className="size-4 transition-transform group-hover/team:translate-x-0.5" />
                </Link>
              ) : (
                <div className="flex flex-col gap-2 rounded-lg bg-court/40 p-3 text-sm">
                  <p className="font-semibold">No team yet.</p>
                  <p className="text-foreground/80">Take an open spot on a team, or start your own and say who you need.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ink" render={<Link href={`/events/${eventId}?tab=teams`} scroll={false} />}>
                      See open spots
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setCreatingTeam(true)}>
                      Start a team
                    </Button>
                  </div>
                </div>
              ))}
            {!props.started && (
              <Button
                variant="ghost"
                size="sm"
                className="self-start text-muted-foreground"
                disabled={pending}
                onClick={() => {
                  if (confirm("Cancel your registration?")) run(() => cancelRegistration({ eventId }), "Registration cancelled");
                }}
              >
                Cancel registration
              </Button>
            )}
          </>
        ) : blockedReason ? (
          <p className="rounded-md bg-secondary px-3 py-2.5 text-sm">{blockedReason}</p>
        ) : (
          <>
            <Button size="lg" disabled={pending} onClick={() => run(() => registerForEvent({ eventId, team: null }), "You're registered!")}>
              {isTeamEvent ? "Register solo" : "Register"} <ArrowRight />
            </Button>
            {isTeamEvent && (
              <>
                <Button size="lg" variant="outline" disabled={pending} onClick={() => setCreatingTeam(true)}>
                  Register &amp; start a team
                </Button>
                <p className="text-xs text-muted-foreground">On your own for now? You can join a team later.</p>
              </>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto] items-end gap-3 border-t border-ink bg-secondary/50 p-4">
        <dl className="grid gap-2">
          <div>
            <dt className="text-xs text-muted-foreground">When</dt>
            <dd className="text-sm font-medium">{stub.date}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Who</dt>
            <dd className="text-sm font-medium">{stub.who}</dd>
          </div>
          {registered && props.checkinCode ? (
            <div>
              <dt className="text-xs text-muted-foreground">Your entry code</dt>
              <dd className="flex items-center gap-2">
                <span className="font-mono text-lg font-semibold tracking-[0.18em]" aria-live="polite">
                  {showCode ? props.checkinCode : "••••••••••"}
                </span>
                <button
                  type="button"
                  onClick={() => setShowCode((v) => !v)}
                  aria-label={showCode ? "Hide entry code" : "Show entry code"}
                  className="text-xs font-semibold underline decoration-court decoration-2 underline-offset-4"
                >
                  {showCode ? "Hide" : "Show"}
                </button>
              </dd>
            </div>
          ) : (
            <p className="pt-1 text-sm text-muted-foreground">
              {stub.registered} going{isTeamEvent && ` · ${stub.teams} team${stub.teams === 1 ? "" : "s"}`}
            </p>
          )}
        </dl>
        {registered && props.checkinCode && !props.checkedIn && <CheckinQr code={props.checkinCode} />}
      </div>

      <Dialog open={creatingTeam} onOpenChange={setCreatingTeam}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">Start a team</DialogTitle>
            <DialogDescription>You&apos;ll lead it. Next, add the spots you need filled so people can join.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await registerForEvent({ eventId, team: { name: teamName } });
                if (!res.ok) return void toast.error(res.error);
                toast.success("Team created");
                setCreatingTeam(false);
                router.push(`/teams/${res.data.teamId}`);
              });
            }}
          >
            <Field label="Team name" htmlFor="team-name">
              <Input id="team-name" value={teamName} onChange={(e) => setTeamName(e.target.value)} required autoFocus maxLength={40} />
            </Field>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create team"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function CheckinQr({ code }: { code: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open && !src) void QRCode.toDataURL(code, { width: 320, margin: 1 }).then(setSrc);
  }, [open, src, code]);
  return (
    <>
      <Button variant="outline" size="icon-lg" onClick={() => setOpen(true)} aria-label="Show check-in QR code">
        <QrCode className="size-6" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">Your entry code</DialogTitle>
            <DialogDescription>Show this at the door. Turn your screen brightness up.</DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
            {src && <img src={src} alt={`QR code for check-in code ${code}`} className="mx-auto w-full max-w-64" />}
          </div>
          <p className="text-center font-mono text-lg tracking-[0.25em]">{code}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
