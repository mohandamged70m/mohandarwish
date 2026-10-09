type TopoHillConfig = {
  /** SVG user units (viewBox 1200x800). */
  cx: number;
  cy: number;
  /** Number of nested rings in this hill. */
  rings: number;
  /** Radial gap between consecutive rings (px in viewBox units). */
  step: number;
  /** Radius of the innermost ring before jitter. */
  baseRadius: number;
  /** Seed for the deterministic PRNG (server/client identical). */
  seed: number;
  /** Extra stagger offset for this hill (seconds). */
  delayOffset: number;
  /** Horizontal / vertical squash for an organic feel. */
  ex?: number;
  ey?: number;
};

// Tweak count, step, position and seed here. Total paths must stay < ~30.
const TOPO_HILLS: TopoHillConfig[] = [
  // Densest cluster, centred on the portrait (~48% left, lower half).
  { cx: 600, cy: 540, rings: 10, step: 36, baseRadius: 44, seed: 7, delayOffset: 0, ex: 1, ey: 0.82 },
  // Upper-left cluster behind the first-name type.
  { cx: 180, cy: 200, rings: 9, step: 34, baseRadius: 40, seed: 23, delayOffset: 0.3, ex: 1, ey: 0.85 },
  // Right-hand cluster behind the surname / role type.
  { cx: 1010, cy: 270, rings: 6, step: 40, baseRadius: 48, seed: 91, delayOffset: 0.6, ex: 1, ey: 0.8 },
];

const RING_DURATION = 2.4; // seconds per ring
const RING_STAGGER = 0.28; // seconds between inner -> outer rings
const POINTS_PER_RING = 12;

/** Deterministic PRNG (mulberry32) — no Math.random, so SSR == CSR. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function catmullRomClosed(pts: Array<readonly [number, number]>): string {
  const n = pts.length;
  let d = `M ${(pts[0][0]).toFixed(1)} ${(pts[0][1]).toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + " Z";
}

/** Rings share one base jitter so they nest; only a tiny per-ring wobble is added. */
function hillRingPath(hill: TopoHillConfig, ring: number, factors: number[], rotation: number): string {
  const ex = hill.ex ?? 1;
  const ey = hill.ey ?? 0.82;
  const rBase = hill.baseRadius + ring * hill.step;
  const jitter = mulberry32(hill.seed * 1000 + ring * 77 + 13);
  const pts: Array<readonly [number, number]> = factors.map((f, j) => {
    const ang = (j / factors.length) * Math.PI * 2 + rotation;
    const wobble = (jitter() - 0.5) * 10; // +/-5px, far smaller than step
    const r = rBase * f + wobble;
    return [hill.cx + r * Math.cos(ang) * ex, hill.cy + r * Math.sin(ang) * ey] as const;
  });
  return catmullRomClosed(pts);
}

function hillFactors(seed: number): { factors: number[]; rotation: number } {
  const rng = mulberry32(seed);
  const factors = Array.from({ length: POINTS_PER_RING }, () => 0.82 + rng() * 0.36);
  const rotation = rng() * Math.PI * 2;
  return { factors, rotation };
}

/**
 * Animated topographic contour background for the hero.
 * Server-component safe: pure deterministic render, animation is CSS-only.
 * Colour comes from `currentColor` — the wrapper uses the `text-accent`
 * token, so light/dark mode follow globals.css automatically.
 */
export default function TopoBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 text-accent"
      style={{
        WebkitMaskImage: "radial-gradient(ellipse 80% 75% at 50% 45%, black 45%, transparent 88%)",
        maskImage: "radial-gradient(ellipse 80% 75% at 50% 45%, black 45%, transparent 88%)",
      }}
    >
      <style>{`@keyframes topo-draw{to{stroke-dashoffset:0}}.topo-ring{stroke-dasharray:1;stroke-dashoffset:1;animation:topo-draw ${RING_DURATION}s cubic-bezier(.4,0,.2,1) forwards}@media (prefers-reduced-motion:reduce){.topo-ring{animation:none!important;stroke-dashoffset:0!important}}`}</style>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
      >
        <g fill="none" stroke="currentColor">
          {TOPO_HILLS.flatMap((hill) => {
            const { factors, rotation } = hillFactors(hill.seed);
            return Array.from({ length: hill.rings }, (_, ring) => {
              const emphasized = (ring + 1) % 3 === 0;
              const delay = hill.delayOffset + ring * RING_STAGGER;
              return (
                <path
                  key={`${hill.seed}-${ring}`}
                  d={hillRingPath(hill, ring, factors, rotation)}
                  pathLength={1}
                  className="topo-ring"
                  strokeWidth={emphasized ? 1.6 : 1}
                  strokeOpacity={emphasized ? 0.28 : 0.14}
                  strokeLinecap="round"
                  style={{ animationDelay: `${delay.toFixed(2)}s` }}
                />
              );
            });
          })}
        </g>
      </svg>
    </div>
  );
}
