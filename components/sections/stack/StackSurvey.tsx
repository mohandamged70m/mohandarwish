"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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

// Desktop (md and up) geometry — unchanged.
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

// Mobile portrait geometry (viewBox 400x900, every label below its station).
// Same ids, labels and icons as desktop; coordinates re-laid for a ~1:1 scale.
// Tailwind sits at x=305 (not 290) so the Next.js–React traverse clears its label.
const M_STATION_R = 24;
const M_HIT_R = 32;
const M_ICON = 26;
const M_LABEL_DY = 46;

const MOBILE_STATIONS: readonly Station[] = [
  { id: "expo", label: "Expo", x: 90, y: 60, side: "below", Icon: SiExpo },
  { id: "react", label: "React", x: 290, y: 100, side: "below", Icon: SiReact },
  { id: "ts", label: "TypeScript", x: 90, y: 190, side: "below", Icon: SiTypescript },
  { id: "tailwind", label: "Tailwind CSS", x: 305, y: 230, side: "below", Icon: SiTailwindcss },
  { id: "wc", label: "Web Components", x: 90, y: 320, side: "below", Icon: SiWebcomponentsdotorg },
  { id: "nextjs", label: "Next.js", x: 200, y: 420, side: "below", Icon: SiNextdotjs },
  { id: "clerk", label: "Clerk", x: 80, y: 520, side: "below", Icon: SiClerk },
  { id: "supabase", label: "Supabase", x: 310, y: 520, side: "below", Icon: SiSupabase },
  { id: "gemini", label: "Gemini API", x: 140, y: 630, side: "below", Icon: SiGooglegemini },
  { id: "rag", label: "RAG", x: 310, y: 640, side: "below", Icon: LuFileSearch },
  { id: "vercel", label: "Vercel", x: 200, y: 740, side: "below", Icon: SiVercel },
  { id: "actions", label: "GitHub Actions", x: 80, y: 830, side: "below", Icon: SiGithubactions },
  { id: "lemon", label: "Lemon Squeezy", x: 320, y: 830, side: "below", Icon: SiLemonsqueezy },
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

const MOBILE_HILLS: readonly Hill[] = [
  { cx: 200, cy: 200, rings: 6 },
  { cx: 230, cy: 520, rings: 8 },
  { cx: 180, cy: 800, rings: 6 },
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

function buildContours(hills: readonly Hill[]): ContourRing[] {
  const rings: ContourRing[] = [];
  hills.forEach((hill, hi) => {
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
}

export function StackSurvey(): React.JSX.Element {
  const [activeId, setActiveId] = useState<string | null>(null);
  // The traverse draw-on runs when the section scrolls into view (not on page
  // load), so visitors actually see it. One-shot: disconnects after firing.
  const sectionRef = useRef<HTMLElement | null>(null);
  const [drawOn, setDrawOn] = useState(false);
  // Unique clip ids per component instance: both SVGs render (CSS toggles
  // visibility), so static ids would duplicate in the DOM.
  const uid = useId().replace(/:/g, "");
  const desktopClipId = `stacksurvey-clip-${uid}-d`;
  const mobileClipId = `stacksurvey-clip-${uid}-m`;
  // Tap-to-toggle guard: a tap focuses the station (activating it) before the
  // click fires, so the click right after a focus must not toggle it back off.
  const focusGuard = useRef(false);

  useEffect(() => {
    const el = sectionRef.current;
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

  const contours = useMemo(() => buildContours(HILLS), []);
  const mobileContours = useMemo(() => buildContours(MOBILE_HILLS), []);

  const byId = useMemo(() => new Map(STATIONS.map((s) => [s.id, s])), []);
  const mobileById = useMemo(() => new Map(MOBILE_STATIONS.map((s) => [s.id, s])), []);

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
    <section
      ref={sectionRef}
      id="stack"
      aria-label="Stack"
      className="w-full scroll-mt-24 bg-bg-primary"
    >
      <style>{`
        @keyframes stacksurvey-draw { to { stroke-dashoffset: 0; } }
        .stacksurvey-line { stroke-dasharray: 1; stroke-dashoffset: 1; }
        .stacksurvey-line.go { animation: stacksurvey-draw 0.6s ease-out forwards; }
        @media (prefers-reduced-motion: reduce) {
          .stacksurvey-line { animation: none; stroke-dasharray: none; stroke-dashoffset: 0; }
        }
        .stacksurvey-station { cursor: pointer; transition: opacity 150ms ease; }
        .stacksurvey-station:focus { outline: none; }
        .stacksurvey-station:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 3px; }
        .stacksurvey-station .station-bg { transition: fill 150ms ease; }
        .stacksurvey-station text { transition: fill 150ms ease; }
        .stacksurvey-station .station-focus-ring { opacity: 0; transition: opacity 150ms ease; }
        .stacksurvey-station:focus-visible .station-focus-ring { opacity: 1; }
      `}</style>
      <div className="mx-auto w-full max-w-7xl px-4 py-16 text-left sm:px-6 sm:py-16 lg:px-8 lg:py-12">
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

        {/* Desktop landscape map (md and up). Untouched geometry. */}
        <div className="mt-8 hidden overflow-x-auto bg-bg-primary md:block">
          <svg
            viewBox="0 0 1000 580"
            role="img"
            aria-label="Survey control network map of the tools I use"
            className="block h-auto w-full min-w-0 sm:min-w-[760px]"
            onMouseLeave={() => setActiveId(null)}
          >
            <defs>
              <clipPath id={desktopClipId}>
                <rect x={0} y={0} width={1000} height={580} />
              </clipPath>
            </defs>

            <g clipPath={`url(#${desktopClipId})`} aria-hidden="true">
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
                  aria-pressed={isActive}
                  opacity={dimmed ? 0.25 : 1}
                  onMouseEnter={() => setActiveId(s.id)}
                  onFocus={() => setActiveId(s.id)}
                  onBlur={() => setActiveId(null)}
                  onClick={() => setActiveId(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveId((prev) => (prev === s.id ? null : s.id));
                    } else if (e.key === "Escape") {
                      setActiveId(null);
                    }
                  }}
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

        {/* Mobile portrait map (below md). Same data, connections and states;
            re-laid stations in a 400x900 viewBox at ~1:1 scale with all labels
            below their stations. */}
        <div className="mt-8 overflow-x-auto bg-bg-primary md:hidden">
          <svg
            viewBox="0 0 400 900"
            role="img"
            aria-label="Portrait survey control network map of the tools I use"
            className="block h-auto w-full"
            onClick={() => setActiveId(null)}
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          >
            <defs>
              <clipPath id={mobileClipId}>
                <rect x={0} y={0} width={400} height={900} />
              </clipPath>
            </defs>

            <g clipPath={`url(#${mobileClipId})`} aria-hidden="true">
              {mobileContours.map((ring) => (
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
              const a = mobileById.get(c.a);
              const b = mobileById.get(c.b);
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
                    animationDelay: `${0.1 + i * 0.07}s`,
                    transition: "opacity 150ms ease",
                    pointerEvents: "none",
                  }}
                />
              );
            })}

            {MOBILE_STATIONS.map((s) => {
              const isActive = s.id === activeId;
              const dimmed =
                activeId !== null && !isActive && !neighbours.has(s.id);
              const Icon = s.Icon;
              return (
                <g
                  key={s.id}
                  className="stacksurvey-station"
                  tabIndex={0}
                  role="button"
                  aria-label={s.label}
                  aria-pressed={isActive}
                  opacity={dimmed ? 0.25 : 1}
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") setActiveId(s.id);
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType === "mouse") setActiveId(null);
                  }}
                  onFocus={() => {
                    focusGuard.current = true;
                    setActiveId(s.id);
                  }}
                  onBlur={() => setActiveId(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveId((prev) => (prev === s.id ? null : s.id));
                    } else if (e.key === "Escape") {
                      setActiveId(null);
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    // A tap focuses first (activating the station); swallow
                    // that click so it does not toggle straight back off.
                    // A later tap on the already-active station toggles off.
                    if (focusGuard.current) {
                      focusGuard.current = false;
                      return;
                    }
                    setActiveId((prev) => (prev === s.id ? null : s.id));
                  }}
                >
                  <circle cx={s.x} cy={s.y} r={M_HIT_R} fill="transparent" />
                  <circle
                    className="station-focus-ring stroke-accent"
                    cx={s.x}
                    cy={s.y}
                    r={M_STATION_R + 5}
                    fill="none"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                  <circle
                    className={`station-bg stroke-accent ${isActive ? "fill-accent" : "fill-bg-primary"}`}
                    cx={s.x}
                    cy={s.y}
                    r={M_STATION_R}
                    strokeWidth={1.6}
                  />
                  <g
                    transform={`translate(${s.x - M_ICON / 2} ${s.y - M_ICON / 2})`}
                    className={isActive ? "text-bg-primary" : "text-text-primary"}
                  >
                    <Icon size={M_ICON} aria-hidden="true" />
                  </g>
                  <text
                    x={s.x}
                    y={s.y + M_LABEL_DY}
                    textAnchor="middle"
                    className={`font-heading ${isActive ? "fill-accent" : "fill-text-primary"}`}
                    fontSize={15}
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
