"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IconType } from "react-icons";
import { LuFileSearch } from "react-icons/lu";
import {
  SiClerk,
  SiExpo,
  SiGithubactions,
  SiGooglegemini,
  SiLemonsqueezy,
  SiNextdotjs,
  SiReact,
  SiSupabase,
  SiTailwindcss,
  SiTypescript,
  SiVercel,
  SiWebcomponentsdotorg,
} from "react-icons/si";

type LabelSide = "left" | "right" | "below";

type Station = {
  id: string;
  label: string;
  x: number;
  y: number;
  side: LabelSide;
  Icon: IconType;
};

type Connection = {
  a: string;
  b: string;
};

const STATION_R = 22;
const HIT_R = 30;
const LABEL_DX = 34;
const LABEL_DY = 46;

const STATIONS: readonly Station[] = [
  { id: "nextjs", label: "Next.js", x: 500, y: 255, side: "below", Icon: SiNextdotjs },
  { id: "react", label: "React", x: 340, y: 160, side: "right", Icon: SiReact },
  { id: "ts", label: "TypeScript", x: 200, y: 255, side: "left", Icon: SiTypescript },
  { id: "tailwind", label: "Tailwind CSS", x: 330, y: 360, side: "right", Icon: SiTailwindcss },
  { id: "expo", label: "Expo", x: 170, y: 120, side: "left", Icon: SiExpo },
  // Label sits right of the station (rather than the mirrored left) so the
  // 14-character name stays inside the 1000-wide viewBox. Station coordinates
  // themselves are unchanged.
  { id: "wc", label: "Web Components", x: 140, y: 400, side: "right", Icon: SiWebcomponentsdotorg },
  { id: "clerk", label: "Clerk", x: 660, y: 150, side: "right", Icon: SiClerk },
  { id: "supabase", label: "Supabase", x: 790, y: 280, side: "right", Icon: SiSupabase },
  { id: "gemini", label: "Gemini API", x: 680, y: 380, side: "right", Icon: SiGooglegemini },
  { id: "rag", label: "RAG", x: 880, y: 410, side: "below", Icon: LuFileSearch },
  { id: "vercel", label: "Vercel", x: 480, y: 455, side: "right", Icon: SiVercel },
  { id: "lemon", label: "Lemon Squeezy", x: 640, y: 515, side: "right", Icon: SiLemonsqueezy },
  { id: "actions", label: "GitHub Actions", x: 290, y: 510, side: "left", Icon: SiGithubactions },
];

const CONNECTIONS: readonly Connection[] = [
  { a: "nextjs", b: "react" },
  { a: "nextjs", b: "ts" },
  { a: "nextjs", b: "tailwind" },
  { a: "nextjs", b: "clerk" },
  { a: "nextjs", b: "supabase" },
  { a: "nextjs", b: "gemini" },
  { a: "nextjs", b: "vercel" },
  { a: "react", b: "expo" },
  { a: "react", b: "ts" },
  { a: "tailwind", b: "wc" },
  { a: "supabase", b: "rag" },
  { a: "gemini", b: "rag" },
  { a: "vercel", b: "lemon" },
  { a: "vercel", b: "actions" },
];

type Hill = { cx: number; cy: number; rings: number };

const HILLS: readonly Hill[] = [
  { cx: 500, cy: 280, rings: 9 },
  { cx: 800, cy: 330, rings: 6 },
  { cx: 220, cy: 300, rings: 6 },
];

const RING_POINTS = 96;

function contourPath(cx: number, cy: number, k: number, phase: number): string {
  const base = 28 + 36 * k;
  let d = "";
  for (let i = 0; i < RING_POINTS; i++) {
    const t = (i / RING_POINTS) * Math.PI * 2;
    const r =
      base *
      (1 +
        0.12 * Math.sin(3 * t + phase) +
        0.07 * Math.sin(5 * t + 2 * phase + 0.25 * k) +
        0.04 * Math.sin(8 * t + 0.5 * k));
    const x = cx + r * 1.3 * Math.cos(t);
    const y = cy + r * 0.8 * Math.sin(t);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${d}Z`;
}

type ContourRing = { d: string; major: boolean; key: string };

export function StackSurvey(): React.JSX.Element {
  const [activeId, setActiveId] = useState<string | null>(null);
  // The traverse draw-on runs when the map scrolls into view (not on page
  // load), so visitors actually see it. One-shot: disconnects after firing.
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [drawOn, setDrawOn] = useState(false);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDrawOn(true);
          obs.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const contours = useMemo<ContourRing[]>(() => {
    const rings: ContourRing[] = [];
    HILLS.forEach((hill, hi) => {
      const phase = hi * 1.7;
      for (let k = 0; k < hill.rings; k++) {
        rings.push({
          d: contourPath(hill.cx, hill.cy, k, phase),
          major: (k + 1) % 4 === 0,
          key: `h${hi}-r${k}`,
        });
      }
    });
    return rings;
  }, []);

  const byId = useMemo(() => new Map(STATIONS.map((s) => [s.id, s])), []);

  const neighbours = useMemo(() => {
    const set = new Set<string>();
    if (activeId === null) return set;
    for (const c of CONNECTIONS) {
      if (c.a === activeId) set.add(c.b);
      else if (c.b === activeId) set.add(c.a);
    }
    return set;
  }, [activeId]);

  return (
    <section id="stack" aria-label="Stack" className="w-full scroll-mt-24 bg-bg-primary">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 text-left sm:px-6 sm:py-16 lg:px-8 lg:py-12">
        <h2
          data-pager-focus
          tabIndex={-1}
          className="max-w-[16ch] font-display text-[clamp(2rem,5.4vw,3.5rem)] font-bold leading-[1.04] tracking-[-0.02em] text-balance text-text-primary"
        >
          Stack
        </h2>
        <p className="mt-4 max-w-[52ch] font-body text-[15px] leading-[1.6] text-pretty text-text-secondary sm:text-base">
          A field survey of the tools I build with — pick a station and trace its
          lines.
        </p>

        <div ref={frameRef} className="mt-8 overflow-x-auto rounded-[16px] border border-border bg-bg-primary">
          <svg
            viewBox="0 0 1000 580"
            role="img"
            aria-label="Survey control network map of the tools I use"
            className="block h-auto w-full min-w-[760px]"
            onMouseLeave={() => setActiveId(null)}
          >
            <style>{`
              @keyframes stacksurvey-draw { to { stroke-dashoffset: 0; } }
              .stacksurvey-line { stroke-dasharray: 1; stroke-dashoffset: 1; }
              .stacksurvey-line.go { animation: stacksurvey-draw 0.6s ease-out forwards; }
              @media (prefers-reduced-motion: reduce) {
                .stacksurvey-line { animation: none; stroke-dasharray: none; stroke-dashoffset: 0; }
              }
              .stacksurvey-station { cursor: pointer; outline: none; transition: opacity 150ms ease; }
              .stacksurvey-station:focus { outline: none; }
              .stacksurvey-station:focus-visible { outline: none; }
              .stacksurvey-station .station-bg { transition: fill 150ms ease; }
              .stacksurvey-station text { transition: fill 150ms ease; }
              .stacksurvey-station .station-focus-ring { opacity: 0; transition: opacity 150ms ease; }
              .stacksurvey-station:focus-visible .station-focus-ring { opacity: 1; }
            `}</style>

            <defs>
              <clipPath id="stacksurvey-clip">
                <rect x={0} y={0} width={1000} height={580} />
              </clipPath>
            </defs>

            <g clipPath="url(#stacksurvey-clip)" aria-hidden="true">
              {contours.map((ring) => (
                <path
                  key={ring.key}
                  d={ring.d}
                  fill="none"
                  className="stroke-accent"
                  strokeWidth={ring.major ? 1.4 : 0.8}
                  strokeOpacity={ring.major ? 0.22 : 0.09}
                />
              ))}
            </g>

            {CONNECTIONS.map((c, i) => {
              const a = byId.get(c.a);
              const b = byId.get(c.b);
              if (!a || !b) return null;
              const connected =
                activeId !== null && (c.a === activeId || c.b === activeId);
              return (
                <line
                  key={`${c.a}-${c.b}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  pathLength={1}
                  className={`stacksurvey-line stroke-accent${drawOn ? " go" : ""}`}
                  strokeWidth={activeId === null ? 1 : connected ? 2 : 1}
                  opacity={activeId === null ? 0.5 : connected ? 1 : 0.1}
                  style={{
                    animationDelay: `${0.1 + i * 0.05}s`,
                    transition: "opacity 150ms ease",
                  }}
                />
              );
            })}

            {STATIONS.map((s) => {
              const isActive = s.id === activeId;
              const dimmed =
                activeId !== null && !isActive && !neighbours.has(s.id);
              const Icon = s.Icon;
              const labelX =
                s.side === "left"
                  ? s.x - LABEL_DX
                  : s.side === "right"
                    ? s.x + LABEL_DX
                    : s.x;
              const labelY = s.side === "below" ? s.y + LABEL_DY : s.y;
              const anchor =
                s.side === "left"
                  ? "end"
                  : s.side === "right"
                    ? "start"
                    : "middle";
              return (
                <g
                  key={s.id}
                  className="stacksurvey-station"
                  tabIndex={0}
                  role="button"
                  aria-label={s.label}
                  opacity={dimmed ? 0.25 : 1}
                  onMouseEnter={() => setActiveId(s.id)}
                  onFocus={() => setActiveId(s.id)}
                  onBlur={() => setActiveId(null)}
                  onClick={() => setActiveId(s.id)}
                >
                  <circle cx={s.x} cy={s.y} r={HIT_R} fill="transparent" />
                  <circle
                    className="station-focus-ring stroke-accent"
                    cx={s.x}
                    cy={s.y}
                    r={27}
                    fill="none"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                  <circle
                    className={`station-bg stroke-accent ${isActive ? "fill-accent" : "fill-bg-primary"}`}
                    cx={s.x}
                    cy={s.y}
                    r={STATION_R}
                    strokeWidth={1.6}
                  />
                  <g
                    transform={`translate(${s.x - 12} ${s.y - 12})`}
                    className={isActive ? "text-bg-primary" : "text-text-primary"}
                  >
                    <Icon size={24} aria-hidden="true" />
                  </g>
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor={anchor}
                    dominantBaseline={s.side === "below" ? "auto" : "middle"}
                    className={`font-heading ${isActive ? "fill-accent" : "fill-text-primary"}`}
                    fontSize={14}
                    style={{
                      paintOrder: "stroke",
                      stroke: "var(--bg-primary)",
                      strokeWidth: 4,
                      strokeLinejoin: "round",
                    }}
                  >
                    {s.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </section>
  );
}

export default StackSurvey;
