"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { IconType } from "react-icons";
import { LuFileSearch, LuGlobe, LuServer, LuSmartphone } from "react-icons/lu";
import {
  SiClerk,
  SiExpo,
  SiFastapi,
  SiGithubactions,
  SiGooglegemini,
  SiLemonsqueezy,
  SiNextdotjs,
  SiPython,
  SiReact,
  SiSupabase,
  SiTailwindcss,
  SiTypescript,
  SiVercel,
  SiWebcomponentsdotorg,
} from "react-icons/si";
import { TbBrandReactNative } from "react-icons/tb";

type LabelSide = "left" | "right" | "below";

/* ── Data: technology nodes (layout-agnostic) ────────────────────────── */

type NodeKind = "language" | "branch" | "framework" | "platform" | "service";

type StackNode = {
  id: string;
  label: string;
  Icon: IconType;
  kind: NodeKind;
};

type EdgeKind = "hierarchy" | "support";

type StackEdge = {
  a: string;
  b: string;
  kind: EdgeKind;
};

/**
 * Organizational hierarchy, not package dependencies:
 *  Python → Backend → FastAPI
 *  TypeScript → Web → React → Next.js
 *  TypeScript → Mobile → React Native → Expo
 * Supporting services attach with `support` edges and are never duplicated.
 */
const STACK_NODES: readonly StackNode[] = [
  { id: "python", label: "Python", Icon: SiPython, kind: "language" },
  { id: "ts", label: "TypeScript", Icon: SiTypescript, kind: "language" },
  { id: "backend", label: "Backend", Icon: LuServer, kind: "branch" },
  { id: "web", label: "Web", Icon: LuGlobe, kind: "branch" },
  { id: "mobile", label: "Mobile", Icon: LuSmartphone, kind: "branch" },
  { id: "fastapi", label: "FastAPI", Icon: SiFastapi, kind: "framework" },
  { id: "react", label: "React", Icon: SiReact, kind: "framework" },
  { id: "rn", label: "React Native", Icon: TbBrandReactNative, kind: "framework" },
  { id: "nextjs", label: "Next.js", Icon: SiNextdotjs, kind: "platform" },
  { id: "expo", label: "Expo", Icon: SiExpo, kind: "platform" },
  { id: "tailwind", label: "Tailwind CSS", Icon: SiTailwindcss, kind: "service" },
  { id: "wc", label: "Web Components", Icon: SiWebcomponentsdotorg, kind: "service" },
  { id: "clerk", label: "Clerk", Icon: SiClerk, kind: "service" },
  { id: "supabase", label: "Supabase", Icon: SiSupabase, kind: "service" },
  { id: "gemini", label: "Gemini API", Icon: SiGooglegemini, kind: "service" },
  { id: "rag", label: "RAG", Icon: LuFileSearch, kind: "service" },
  { id: "vercel", label: "Vercel", Icon: SiVercel, kind: "service" },
  { id: "lemon", label: "Lemon Squeezy", Icon: SiLemonsqueezy, kind: "service" },
  { id: "actions", label: "GitHub Actions", Icon: SiGithubactions, kind: "service" },
];

const STACK_EDGES: readonly StackEdge[] = [
  // Hierarchy — how products are built (solid lines).
  { a: "python", b: "backend", kind: "hierarchy" },
  { a: "backend", b: "fastapi", kind: "hierarchy" },
  { a: "ts", b: "web", kind: "hierarchy" },
  { a: "ts", b: "mobile", kind: "hierarchy" },
  { a: "web", b: "react", kind: "hierarchy" },
  { a: "react", b: "nextjs", kind: "hierarchy" },
  { a: "mobile", b: "rn", kind: "hierarchy" },
  { a: "rn", b: "expo", kind: "hierarchy" },
  // Supporting integrations — shared services, never duplicated (dashed).
  { a: "react", b: "tailwind", kind: "support" },
  { a: "nextjs", b: "tailwind", kind: "support" },
  { a: "tailwind", b: "wc", kind: "support" },
  { a: "nextjs", b: "clerk", kind: "support" },
  { a: "expo", b: "clerk", kind: "support" },
  { a: "fastapi", b: "supabase", kind: "support" },
  { a: "nextjs", b: "supabase", kind: "support" },
  { a: "expo", b: "supabase", kind: "support" },
  { a: "fastapi", b: "gemini", kind: "support" },
  { a: "nextjs", b: "gemini", kind: "support" },
  { a: "gemini", b: "rag", kind: "support" },
  { a: "supabase", b: "rag", kind: "support" },
  { a: "nextjs", b: "vercel", kind: "support" },
  { a: "expo", b: "vercel", kind: "support" },
  { a: "vercel", b: "actions", kind: "support" },
  { a: "vercel", b: "lemon", kind: "support" },
];

/* ── Layout: positions stay separate from technology data ────────────── */

type Station = StackNode & {
  x: number;
  y: number;
  side: LabelSide;
};

const DESKTOP_POS: Record<string, { x: number; y: number; side: LabelSide }> = {
  python: { x: 150, y: 140, side: "below" },
  backend: { x: 335, y: 140, side: "below" },
  fastapi: { x: 510, y: 140, side: "below" },
  tailwind: { x: 690, y: 140, side: "below" },
  clerk: { x: 870, y: 130, side: "below" },
  ts: { x: 150, y: 320, side: "below" },
  web: { x: 335, y: 265, side: "below" },
  mobile: { x: 335, y: 430, side: "below" },
  react: { x: 510, y: 265, side: "below" },
  rn: { x: 510, y: 430, side: "below" },
  nextjs: { x: 690, y: 265, side: "below" },
  expo: { x: 690, y: 430, side: "below" },
  wc: { x: 870, y: 230, side: "below" },
  supabase: { x: 870, y: 330, side: "below" },
  gemini: { x: 870, y: 430, side: "below" },
  vercel: { x: 335, y: 560, side: "below" },
  actions: { x: 150, y: 560, side: "below" },
  lemon: { x: 510, y: 560, side: "below" },
  rag: { x: 690, y: 560, side: "below" },
};

const MOBILE_POS: Record<string, { x: number; y: number }> = {
  python: { x: 200, y: 55 },
  backend: { x: 200, y: 135 },
  fastapi: { x: 200, y: 215 },
  ts: { x: 200, y: 295 },
  web: { x: 110, y: 375 },
  mobile: { x: 290, y: 375 },
  react: { x: 110, y: 455 },
  rn: { x: 290, y: 455 },
  nextjs: { x: 110, y: 535 },
  expo: { x: 290, y: 535 },
  tailwind: { x: 110, y: 615 },
  wc: { x: 290, y: 615 },
  clerk: { x: 110, y: 695 },
  supabase: { x: 290, y: 695 },
  gemini: { x: 110, y: 775 },
  rag: { x: 290, y: 775 },
  vercel: { x: 200, y: 855 },
  actions: { x: 105, y: 935 },
  lemon: { x: 295, y: 935 },
};

// Progressively smaller nodes for deeper levels; languages stay the anchors.
function radiusForKind(kind: NodeKind, mobile: boolean): number {
  switch (kind) {
    case "language":
      return mobile ? 24 : 26;
    case "framework":
      return mobile ? 22 : 21;
    case "platform":
      return mobile ? 21 : 19;
    case "service":
      return mobile ? 19 : 17;
    case "branch":
      return 15;
  }
}

function buildStations(
  positions: Record<string, { x: number; y: number; side?: LabelSide }>
): Station[] {
  return STACK_NODES.map((n) => {
    const p = positions[n.id];
    if (!p) throw new Error(`Missing stack position for "${n.id}"`);
    return { ...n, x: p.x, y: p.y, side: p.side ?? "below" };
  });
}

const STATIONS: readonly Station[] = buildStations(DESKTOP_POS);
const MOBILE_STATIONS: readonly Station[] = buildStations(MOBILE_POS);

const CONNECTIONS: readonly StackEdge[] = STACK_EDGES;

// Desktop (md and up) interaction geometry.
const HIT_PAD = 8;
const LABEL_DY = 46;

// Mobile portrait geometry (viewBox 400x1000, every label below its station).
const M_HIT_PAD = 8;
const M_LABEL_DY = 44;

const edgeKey = (a: string, b: string): string => `${a}__${b}`;

type Hill = { cx: number; cy: number; rings: number };

const HILLS: readonly Hill[] = [
  { cx: 320, cy: 300, rings: 9 },
  { cx: 760, cy: 300, rings: 7 },
  { cx: 480, cy: 560, rings: 5 },
];

const MOBILE_HILLS: readonly Hill[] = [
  { cx: 200, cy: 220, rings: 7 },
  { cx: 200, cy: 520, rings: 8 },
  { cx: 200, cy: 830, rings: 6 },
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

/** Ancestry-aware highlight: active node + hierarchy ancestors/descendants + direct support neighbours. */
function useHighlight(activeId: string | null): {
  nodes: Set<string>;
  edges: Set<string>;
} {
  return useMemo(() => {
    const nodes = new Set<string>();
    const edges = new Set<string>();
    if (activeId === null) return { nodes, edges };
    const parents = new Map<string, string[]>();
    const children = new Map<string, string[]>();
    for (const e of CONNECTIONS) {
      if (e.kind !== "hierarchy") continue;
      // Hierarchy edges are stored parent-first (language → branch → tech).
      if (!children.has(e.a)) children.set(e.a, []);
      children.get(e.a)?.push(e.b);
      if (!parents.has(e.b)) parents.set(e.b, []);
      parents.get(e.b)?.push(e.a);
    }
    // Ancestry chain + descendant subtree form one connected subtree that
    // always contains the active node — the "relevant branch".
    const onPath = new Set<string>([activeId]);
    let cursor: string | undefined = activeId;
    while (cursor) {
      const parent: string | undefined = (parents.get(cursor) ?? [])[0];
      if (!parent) break;
      onPath.add(parent);
      cursor = parent;
    }
    const stack: string[] = [activeId];
    while (stack.length > 0) {
      const cur = stack.pop();
      if (!cur) continue;
      for (const c of children.get(cur) ?? []) {
        if (onPath.has(c)) continue;
        onPath.add(c);
        stack.push(c);
      }
    }
    for (const id of onPath) nodes.add(id);
    for (const e of CONNECTIONS) {
      if (e.kind === "hierarchy" && onPath.has(e.a) && onPath.has(e.b)) {
        edges.add(edgeKey(e.a, e.b));
      }
    }
    // Direct supporting integrations of the active node.
    for (const e of CONNECTIONS) {
      if (e.kind !== "support") continue;
      if (e.a === activeId || e.b === activeId) {
        nodes.add(e.a);
        nodes.add(e.b);
        edges.add(edgeKey(e.a, e.b));
      }
    }
    return { nodes, edges };
  }, [activeId]);
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
  const mobileById = useMemo(
    () => new Map(MOBILE_STATIONS.map((s) => [s.id, s])),
    []
  );
  const { nodes: highlighted, edges: highlightedEdges } =
    useHighlight(activeId);

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
        .stacksurvey-support { opacity: 0; transition: opacity 600ms ease; }
        .stacksurvey-support.go { opacity: 1; }
        @media (prefers-reduced-motion: reduce) {
          .stacksurvey-line { animation: none; stroke-dasharray: none; stroke-dashoffset: 0; }
          .stacksurvey-support { opacity: 1; transition: none; }
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
          A field survey of the tools I build with. Python and TypeScript are
          the two anchors — pick a station and trace its lines. Solid lines
          show how I build; dashed lines show supporting integrations.
        </p>
        <div
          aria-hidden="true"
          className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-heading text-xs text-text-secondary"
        >
          <span className="inline-flex items-center gap-2">
            <svg width="28" height="6" viewBox="0 0 28 6" aria-hidden="true">
              <line
                x1="1"
                y1="3"
                x2="27"
                y2="3"
                className="stroke-accent"
                strokeWidth="1.6"
              />
            </svg>
            Builds on
          </span>
          <span className="inline-flex items-center gap-2">
            <svg width="28" height="6" viewBox="0 0 28 6" aria-hidden="true">
              <line
                x1="1"
                y1="3"
                x2="27"
                y2="3"
                className="stroke-accent"
                strokeWidth="1.4"
                strokeDasharray="3 4"
              />
            </svg>
            Integrates with
          </span>
        </div>

        {/* Desktop landscape map (md and up). */}
        <div className="mt-8 hidden overflow-x-auto bg-bg-primary md:block">
          <svg
            viewBox="0 0 1000 630"
            role="img"
            aria-label="Survey control network map of the tools I use, anchored on Python and TypeScript"
            className="block h-auto w-full min-w-0 sm:min-w-[760px]"
            onMouseLeave={() => setActiveId(null)}
          >
            <defs>
              <clipPath id={desktopClipId}>
                <rect x={0} y={0} width={1000} height={630} />
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
              const lit =
                activeId !== null && highlightedEdges.has(edgeKey(c.a, c.b));
              if (c.kind === "support") {
                return (
                  <line
                    key={`${c.a}-${c.b}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className={`stacksurvey-support stroke-accent${drawOn ? " go" : ""}`}
                    strokeWidth={activeId === null ? 1.1 : lit ? 1.8 : 1}
                    opacity={activeId === null ? 0.35 : lit ? 0.9 : 0.08}
                    strokeDasharray="3 4"
                    style={{
                      transitionDelay: drawOn ? `${0.4 + i * 0.03}s` : "0s",
                    }}
                  />
                );
              }
              return (
                <line
                  key={`${c.a}-${c.b}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  pathLength={1}
                  className={`stacksurvey-line stroke-accent${drawOn ? " go" : ""}`}
                  strokeWidth={activeId === null ? 1 : lit ? 2 : 1}
                  opacity={activeId === null ? 0.5 : lit ? 1 : 0.1}
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
                activeId !== null && !isActive && !highlighted.has(s.id);
              const Icon = s.Icon;
              const r = radiusForKind(s.kind, false);
              const iconSize = s.kind === "branch" ? 16 : Math.round(r * 1.1);
              const labelY = s.y + LABEL_DY;
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
                  <circle
                    cx={s.x}
                    cy={s.y}
                    r={r + HIT_PAD}
                    fill="transparent"
                  />
                  <circle
                    className="station-focus-ring stroke-accent"
                    cx={s.x}
                    cy={s.y}
                    r={r + 5}
                    fill="none"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                  <circle
                    className={`station-bg stroke-accent ${isActive ? "fill-accent" : "fill-bg-primary"}`}
                    cx={s.x}
                    cy={s.y}
                    r={r}
                    strokeWidth={s.kind === "language" ? 2 : 1.6}
                  />
                  <g
                    transform={`translate(${s.x - iconSize / 2} ${s.y - iconSize / 2})`}
                    className={isActive ? "text-bg-primary" : "text-text-primary"}
                  >
                    <Icon size={iconSize} aria-hidden="true" />
                  </g>
                  <text
                    x={s.x}
                    y={labelY}
                    textAnchor="middle"
                    className={`font-heading ${isActive ? "fill-accent" : "fill-text-primary"}`}
                    fontSize={s.kind === "branch" ? 13 : 14}
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
            re-laid stations in a 400x1000 viewBox at ~1:1 scale with all labels
            below their stations. */}
        <div className="mt-8 overflow-x-auto bg-bg-primary md:hidden">
          <svg
            viewBox="0 0 400 1000"
            role="img"
            aria-label="Portrait survey control network map of the tools I use, anchored on Python and TypeScript"
            className="block h-auto w-full"
            onClick={() => setActiveId(null)}
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          >
            <defs>
              <clipPath id={mobileClipId}>
                <rect x={0} y={0} width={400} height={1000} />
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
              const lit =
                activeId !== null && highlightedEdges.has(edgeKey(c.a, c.b));
              if (c.kind === "support") {
                return (
                  <line
                    key={`${c.a}-${c.b}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className={`stacksurvey-support stroke-accent${drawOn ? " go" : ""}`}
                    strokeWidth={activeId === null ? 1.1 : lit ? 1.8 : 1}
                    opacity={activeId === null ? 0.35 : lit ? 0.9 : 0.08}
                    strokeDasharray="3 4"
                    style={{
                      transitionDelay: drawOn ? `${0.4 + i * 0.03}s` : "0s",
                      pointerEvents: "none",
                    }}
                  />
                );
              }
              return (
                <line
                  key={`${c.a}-${c.b}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  pathLength={1}
                  className={`stacksurvey-line stroke-accent${drawOn ? " go" : ""}`}
                  strokeWidth={activeId === null ? 1 : lit ? 2 : 1}
                  opacity={activeId === null ? 0.5 : lit ? 1 : 0.1}
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
                activeId !== null && !isActive && !highlighted.has(s.id);
              const Icon = s.Icon;
              const r = radiusForKind(s.kind, true);
              const iconSize = s.kind === "branch" ? 16 : Math.round(r * 1.1);
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
                  <circle
                    cx={s.x}
                    cy={s.y}
                    r={r + M_HIT_PAD}
                    fill="transparent"
                  />
                  <circle
                    className="station-focus-ring stroke-accent"
                    cx={s.x}
                    cy={s.y}
                    r={r + 5}
                    fill="none"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                  <circle
                    className={`station-bg stroke-accent ${isActive ? "fill-accent" : "fill-bg-primary"}`}
                    cx={s.x}
                    cy={s.y}
                    r={r}
                    strokeWidth={s.kind === "language" ? 2 : 1.6}
                  />
                  <g
                    transform={`translate(${s.x - iconSize / 2} ${s.y - iconSize / 2})`}
                    className={isActive ? "text-bg-primary" : "text-text-primary"}
                  >
                    <Icon size={iconSize} aria-hidden="true" />
                  </g>
                  <text
                    x={s.x}
                    y={s.y + M_LABEL_DY}
                    textAnchor="middle"
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
