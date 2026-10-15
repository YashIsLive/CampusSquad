import type { ReactNode } from "react";
import { seededRandom } from "@/lib/seeded";
import { cn } from "@/lib/utils";

export type EventType = "hackathon" | "quiz" | "coding_contest" | "workshop" | "ideathon" | "ctf";

// Fixed "print" colours so posters look printed in both themes.
const CREAM = "#f4efe4";
const INK = "#1a1714";

const W = 400;
const H = 250;

/**
 * Generated poster art for events without an uploaded poster. Each type has its own motif
 * (pixels for hackathons, code lines for contests, Truchet tiles for workshops…), laid out
 * from a seed so every event gets a distinct but stable print.
 */
export function EventArt({
  id,
  type,
  posterUrl,
  className,
  children,
}: {
  id: string;
  type: EventType;
  posterUrl?: string | null;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ background: `var(--type-${type})` }}>
      {posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded poster of unknown size
        <img src={posterUrl} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden="true" focusable="false">
          {MOTIFS[type](seededRandom(id))}
        </svg>
      )}
      {children}
    </div>
  );
}

type Rng = ReturnType<typeof seededRandom>;

const MOTIFS: Record<EventType, (r: Rng) => ReactNode> = {
  // Pixel board with a circuit trace.
  hackathon(r) {
    const s = 25;
    const cells: ReactNode[] = [];
    for (let x = 0; x < W / s; x++) {
      for (let y = 0; y < H / s; y++) {
        const v = r.next();
        if (v < 0.22) cells.push(<rect key={`${x}-${y}`} x={x * s + 3} y={y * s + 3} width={s - 6} height={s - 6} fill={CREAM} />);
        else if (v < 0.27) cells.push(<rect key={`${x}-${y}`} x={x * s + 3} y={y * s + 3} width={s - 6} height={s - 6} fill={INK} />);
      }
    }
    let x = r.int(1, 4) * s + s / 2;
    let y = r.int(1, 8) * s + s / 2;
    const pts = [`${x},${y}`];
    for (let i = 0; i < 6; i++) {
      if (i % 2 === 0) x = Math.min(W - s / 2, x + r.int(2, 5) * s);
      else y = Math.max(s / 2, Math.min(H - s / 2, y + (r.chance(0.5) ? 1 : -1) * r.int(1, 3) * s));
      pts.push(`${x},${y}`);
    }
    return (
      <>
        {cells}
        <polyline points={pts.join(" ")} fill="none" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        <circle cx={x} cy={y} r={9} fill={INK} />
      </>
    );
  },
  // Scattered answer bubbles, one oversized.
  quiz(r) {
    const dots = Array.from({ length: 16 }, (_, i) => {
      const rad = r.range(6, 26);
      const filled = r.chance(0.45);
      return (
        <circle
          key={i}
          cx={r.range(0, W)}
          cy={r.range(0, H)}
          r={rad}
          fill={filled ? CREAM : "none"}
          stroke={filled ? "none" : INK}
          strokeWidth={4}
        />
      );
    });
    return (
      <>
        <circle cx={r.range(W * 0.55, W * 0.9)} cy={r.range(H * 0.2, H * 0.6)} r={r.range(70, 100)} fill={CREAM} />
        {dots}
      </>
    );
  },
  // Indented code lines.
  coding_contest(r) {
    const rows: ReactNode[] = [];
    let indent = 0;
    for (let i = 0; i < 11; i++) {
      indent = Math.max(0, Math.min(4, indent + r.pick([-1, 0, 0, 1])));
      const x = 28 + indent * 26;
      const len = r.range(50, W - x - 24);
      const y = 20 + i * 21;
      const hot = r.chance(0.12);
      rows.push(<rect key={i} x={x} y={y} width={len} height={11} rx={5.5} fill={hot ? INK : CREAM} opacity={hot ? 1 : 0.92} />);
      if (r.chance(0.35)) rows.push(<rect key={`t${i}`} x={x + len + 8} y={y} width={r.range(16, 40)} height={11} rx={5.5} fill={INK} opacity={0.55} />);
    }
    return <>{rows}</>;
  },
  // Truchet tiles of quarter circles.
  workshop(r) {
    const s = 50;
    const tiles: ReactNode[] = [];
    for (let x = 0; x < W / s; x++) {
      for (let y = 0; y < H / s + 1; y++) {
        const rot = r.int(0, 3) * 90;
        const fill = r.chance(0.18) ? INK : CREAM;
        tiles.push(
          <g key={`${x}-${y}`} transform={`translate(${x * s + s / 2} ${y * s + s / 2}) rotate(${rot})`}>
            <path d={`M ${-s / 2} ${-s / 2} h ${s} a ${s} ${s} 0 0 1 ${-s} ${s} z`} fill={fill} opacity={0.95} />
          </g>,
        );
      }
    }
    return <>{tiles}</>;
  },
  // A rising sun with rays — the idea.
  ideathon(r) {
    const cx = r.range(W * 0.25, W * 0.75);
    const cy = r.range(H * 0.55, H * 0.85);
    const rays = Array.from({ length: 14 }, (_, i) => {
      const a = Math.PI + (i / 13) * Math.PI;
      const r1 = 85;
      const r2 = r1 + r.range(40, 120);
      return (
        <line
          key={i}
          x1={cx + Math.cos(a) * r1}
          y1={cy + Math.sin(a) * r1}
          x2={cx + Math.cos(a) * r2}
          y2={cy + Math.sin(a) * r2}
          stroke={CREAM}
          strokeWidth={6}
          strokeLinecap="round"
        />
      );
    });
    return (
      <>
        {rays}
        <circle cx={cx} cy={cy} r={70} fill={CREAM} />
        <circle cx={cx + r.range(-25, 25)} cy={cy - r.range(10, 30)} r={12} fill={INK} />
        <rect x={0} y={cy + 40} width={W} height={H} fill={INK} opacity={0.9} />
      </>
    );
  },
  // Diagonal hazard stripes and a captured flag.
  ctf(r) {
    const stripes = Array.from({ length: 18 }, (_, i) => (
      <line key={i} x1={i * 34 - 120} y1={H + 20} x2={i * 34 + 80} y2={-20} stroke={CREAM} strokeWidth={r.chance(0.3) ? 10 : 3} opacity={0.22} />
    ));
    const fx = r.range(W * 0.45, W * 0.75);
    return (
      <>
        {stripes}
        <rect x={fx} y={40} width={7} height={170} fill={CREAM} />
        <path d={`M ${fx + 7} 44 h 100 l -26 32 l 26 32 h -100 z`} fill="#e05a30" />
        <text x={28} y={H - 26} fill={CREAM} fontFamily="ui-monospace, monospace" fontSize={22} opacity={0.85}>
          {`flag{${Math.floor(r.next() * 0xffffff).toString(16).padStart(6, "0")}}`}
        </text>
      </>
    );
  },
};
