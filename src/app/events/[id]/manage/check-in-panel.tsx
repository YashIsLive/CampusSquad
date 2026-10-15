"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, CheckCircle2, Search } from "lucide-react";
import jsQR from "jsqr";
import { toast } from "sonner";
import { checkIn, searchRegistrants } from "@/app/actions/manage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Result = { id: string; status: string; code: string; name: string; email: string; team: string | null };

export function CheckInPanel({ eventId, checkedIn, total }: { eventId: string; checkedIn: number; total: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [last, setLast] = useState<{ name: string; team: string | null; already: boolean } | null>(null);

  const doCheckIn = (input: { code?: string; registrationId?: string; undo?: boolean }) =>
    startTransition(async () => {
      const res = await checkIn({ eventId, ...input });
      if (!res.ok) return void toast.error(res.error);
      if (input.undo) toast.success(`Undid check-in for ${res.data.name}`);
      else {
        setLast({ name: res.data.name, team: res.data.team, already: res.data.alreadyCheckedIn });
        if (navigator.vibrate) navigator.vibrate(80);
      }
      setCode("");
      if (q) {
        const r = await searchRegistrants({ eventId, q });
        if (r.ok) setResults(r.data);
      }
      router.refresh();
    });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="flex flex-col gap-3 rounded-lg border border-rule bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Scan QR</h2>
          <Badge variant="secondary" className="tabular-nums">
            {checkedIn}/{total} checked in
          </Badge>
        </div>
        <Scanner onCode={(c) => doCheckIn({ code: c })} paused={pending} />
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) doCheckIn({ code: code.trim() });
          }}
        >
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Or type the 10-character code" className="font-mono uppercase" />
          <Button type="submit" disabled={pending || !code.trim()}>
            Check in
          </Button>
        </form>
        {last && (
          <div
            role="status"
            className={
              last.already
                ? "rounded-md border border-ink/30 bg-marker/40 p-3 text-sm"
                : "rounded-md border border-ok/50 bg-ok/10 p-3 text-sm"
            }
          >
            <p className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="size-4" /> {last.name} {last.already ? "was already checked in" : "checked in"}
            </p>
            {last.team && <p>Team {last.team}</p>}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-rule bg-card p-4">
        <h2 className="text-xl font-bold">Search by name, email or team</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!q.trim()) return;
            startTransition(async () => {
              const r = await searchRegistrants({ eventId, q });
              if (!r.ok) return void toast.error(r.error);
              setResults(r.data);
            });
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search registrants" />
          <Button type="submit" variant="outline" disabled={pending} aria-label="Search">
            <Search />
          </Button>
        </form>
        <ul className="flex flex-col divide-y">
          {results.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.email}
                  {r.team && ` · ${r.team}`}
                </p>
              </div>
              {r.status === "checked_in" ? (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => doCheckIn({ registrationId: r.id, undo: true })}>
                  Undo
                </Button>
              ) : (
                <Button size="sm" disabled={pending} onClick={() => doCheckIn({ registrationId: r.id })}>
                  Check in
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

type Detector = { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };

/** Camera scanner: native BarcodeDetector when available (Android Chrome), jsQR fallback elsewhere (iOS Safari). */
function Scanner({ onCode, paused }: { onCode: (code: string) => void; paused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const onCodeRef = useRef(onCode);
  const pausedRef = useRef(paused);

  useEffect(() => {
    onCodeRef.current = onCode;
    pausedRef.current = paused;
  });

  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | undefined;
    let raf = 0;
    let cancelled = false;
    const BD = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    const detector = BD ? new BD({ formats: ["qr_code"] }) : null;

    const handle = (value: string) => {
      const code = value.trim().toUpperCase();
      const now = Date.now();
      // Ignore the same code for 3s so one QR isn't submitted repeatedly.
      if (code === lastRef.current.code && now - lastRef.current.at < 3000) return;
      lastRef.current = { code, at: now };
      onCodeRef.current(code);
    };

    const tick = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2 && !pausedRef.current) {
        try {
          if (detector) {
            const found = await detector.detect(video);
            if (found[0]) handle(found[0].rawValue);
          } else {
            const w = (canvas.width = video.videoWidth);
            const h = (canvas.height = video.videoHeight);
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx && w && h) {
              ctx.drawImage(video, 0, 0, w, h);
              const img = ctx.getImageData(0, 0, w, h);
              const qr = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
              if (qr?.data) handle(qr.data);
            }
          }
        } catch {
          // Transient decode errors are expected between frames.
        }
      }
      raf = requestAnimationFrame(() => void tick());
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(async (s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play();
        }
        void tick();
      })
      .catch((e: unknown) => {
        setError(e instanceof Error && e.name === "NotAllowedError" ? "Camera permission denied." : "Couldn't start the camera.");
        setOn(false);
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [on]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-black sm:aspect-video">
        <video ref={videoRef} className={on ? "size-full object-cover" : "hidden"} playsInline muted />
        {!on && (
          <div className="absolute inset-0 grid place-items-center text-sm text-white/70">
            {error ?? "Camera is off"}
          </div>
        )}
        {on && <div className="pointer-events-none absolute inset-[18%] rounded-lg border border-rule bg-card-2 border-white/70" />}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <Button variant={on ? "outline" : "default"} onClick={() => { setError(null); setOn((v) => !v); }}>
        {on ? <CameraOff /> : <Camera />} {on ? "Stop camera" : "Start camera"}
      </Button>
    </div>
  );
}
