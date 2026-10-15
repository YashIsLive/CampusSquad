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
 * Registration as a paper ticket: actions above the perforation, the stub below
 * (date, admission, and — once registered — your check-in code).
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

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(success);
      router.refresh();
    });

  return (
    <section aria-labelledby="ticket-heading" className="relative">
      <div className="flex flex-col gap-3 rounded-t-lg border border-b-0 border-ink/25 bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 id="ticket-heading" className="label-mono text-muted-foreground">
            {registered ? "Your ticket" : "Registration"}
          </h2>
          {registered && <Stamp tone={props.checkedIn ? "ok" : "ink"}>{props.checkedIn ? "Checked in" : "Registered"}</Stamp>}
        </div>

        {externalUrl && (
          <div className="flex flex-col gap-2 rounded-md bg-secondary p-3">
            <p className="text-sm">Official registration is on the organizer&apos;s site.</p>
            <Button variant="ink" render={<a href={externalUrl} target="_blank" rel="noreferrer" />}>
              Register on official site <ExternalLink />
            </Button>
            <p className="text-xs text-muted-foreground">Join here too, to find teammates.</p>
          </div>
        )}

        {!signedIn ? (
          <Button size="lg" render={<Link href={`/login?next=/events/${eventId}`} />}>
            Sign in to register <ArrowRight />
          </Button>
        ) : registered ? (
          <>
            {isTeamEvent &&
              (team ? (
                <Link
                  href={`/teams/${team.id}`}
                  className="group/team flex items-center justify-between rounded-md border border-rule bg-paper px-3 py-2.5 text-sm hover:border-ink"
                >
                  <span>
                    <span className="label-mono block text-muted-foreground">{team.isLeader ? "You lead" : "Your team"}</span>
                    <strong className="font-display text-base">{team.name}</strong>
                  </span>
                  <ArrowRight className="size-4 transition-transform group-hover/team:translate-x-0.5" />
                </Link>
              ) : (
                <div className="flex flex-col gap-2 rounded-md border border-dashed border-signal/60 bg-signal-soft/50 p-3 text-sm">
                  <p className="font-medium">You don&apos;t have a team yet.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" render={<Link href={`/events/${eventId}?tab=teams`} scroll={false} />}>
                      Browse open roles
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
                <p className="text-xs text-muted-foreground">Solo? You can join a team later from the Teams tab.</p>
              </>
            )}
          </>
        )}
      </div>

      {/* Perforation with punched notches. */}
      <div aria-hidden="true" className="relative h-0">
        <div className="mx-3 border-t-2 border-dashed border-rule-strong" />
        <span className="absolute top-0 -left-2.5 size-5 -translate-y-1/2 rounded-full border border-ink/25 bg-paper [clip-path:inset(0_0_0_50%)]" />
        <span className="absolute top-0 -right-2.5 size-5 -translate-y-1/2 rounded-full border border-ink/25 bg-paper [clip-path:inset(0_50%_0_0)]" />
      </div>

      <div className="grid grid-cols-[1fr_auto] items-end gap-3 rounded-b-lg border border-t-0 border-ink/25 bg-card p-4">
        <dl className="grid gap-1.5">
          <div>
            <dt className="label-mono text-muted-foreground">Date</dt>
            <dd className="text-sm font-medium">{stub.date}</dd>
          </div>
          <div>
            <dt className="label-mono text-muted-foreground">Admit</dt>
            <dd className="text-sm font-medium">{stub.who}</dd>
          </div>
          {registered && props.checkinCode ? (
            <div>
              <dt className="label-mono text-muted-foreground">Check-in code</dt>
              <dd className="font-mono text-base font-semibold tracking-[0.18em]">{props.checkinCode}</dd>
            </div>
          ) : (
            <p className="label-mono pt-1 text-muted-foreground">
              {stub.registered} going{isTeamEvent && ` · ${stub.teams} teams`}
            </p>
          )}
        </dl>
        {registered && props.checkinCode && !props.checkedIn && <CheckinQr code={props.checkinCode} />}
      </div>

      <Dialog open={creatingTeam} onOpenChange={setCreatingTeam}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">Start a team</DialogTitle>
            <DialogDescription>You&apos;ll lead it. Next, post the roles you&apos;re missing so people can apply.</DialogDescription>
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
            <DialogTitle className="font-display text-xl font-bold">Check-in code</DialogTitle>
            <DialogDescription>Show this at the entrance. Turn your brightness up.</DialogDescription>
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
