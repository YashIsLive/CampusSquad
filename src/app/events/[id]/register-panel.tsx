"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { cancelRegistration, registerForEvent } from "@/app/actions/registrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
}) {
  const { eventId, signedIn, isTeamEvent, registered, team, blockedReason, externalUrl } = props;
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
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      {externalUrl && (
        <div className="flex flex-col gap-2 border-b pb-3">
          <p className="text-sm">Official registration happens on the organizer&apos;s site.</p>
          <Button render={<a href={externalUrl} target="_blank" rel="noreferrer" />}>
            Register on official site <ExternalLink />
          </Button>
          <p className="text-xs text-muted-foreground">Also join below to find teammates here.</p>
        </div>
      )}

      {!signedIn ? (
        <Button size="lg" render={<Link href={`/login?next=/events/${eventId}`} />}>
          Sign in to register
        </Button>
      ) : registered ? (
        <>
          <p className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-5" /> {props.checkedIn ? "Checked in" : "You're registered"}
          </p>
          {isTeamEvent &&
            (team ? (
              <Link href={`/teams/${team.id}`} className="rounded-lg bg-muted px-3 py-2 text-sm hover:bg-muted/70">
                Team <strong>{team.name}</strong>
                {team.isLeader && " · you lead"} →
              </Link>
            ) : (
              <div className="flex flex-col gap-2 rounded-lg bg-muted/60 p-3 text-sm">
                <p>You don&apos;t have a team yet.</p>
                <div className="flex gap-2">
                  <Button size="sm" render={<Link href={`/events/${eventId}?tab=teams`} scroll={false} />}>
                    Browse open roles
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCreatingTeam(true)}>
                    Start a team
                  </Button>
                </div>
              </div>
            ))}
          {props.checkinCode && !props.checkedIn && <CheckinQr code={props.checkinCode} />}
          {!props.started && (
            <Button
              variant="ghost"
              size="sm"
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
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{blockedReason}</p>
      ) : (
        <>
          <Button size="lg" disabled={pending} onClick={() => run(() => registerForEvent({ eventId, team: null }), "You're registered!")}>
            {isTeamEvent ? "Register — find a team later" : "Register"}
          </Button>
          {isTeamEvent && (
            <Button size="lg" variant="outline" disabled={pending} onClick={() => setCreatingTeam(true)}>
              Register &amp; start a team
            </Button>
          )}
        </>
      )}

      <Dialog open={creatingTeam} onOpenChange={setCreatingTeam}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a team</DialogTitle>
            <DialogDescription>You&apos;ll be the leader. Post open roles next so people can apply.</DialogDescription>
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
            <Input placeholder="Team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} required autoFocus />
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
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <QrCode /> Show check-in QR
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Your check-in code</DialogTitle>
            <DialogDescription>Show this at the venue entrance.</DialogDescription>
          </DialogHeader>
          {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
          {src && <img src={src} alt={`QR code ${code}`} className="mx-auto w-full max-w-64" />}
          <p className="text-center font-mono text-lg tracking-widest">{code}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
