"use client";

import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { ME } from "@/data/me";
import { useTailor } from "@/lib/analytics/tailor";
import { GlassChip, GlassPill } from "@/components/ui/glassy-button";
import TopoBackground from "@/components/topo-background";
import "./hero.css";
const BookingModal = dynamic(() => import("@/components/booking/BookingModal"), { ssr: false });

function prefetchBookingModal() {
  void import("@/components/booking/BookingModal");
}


const [FIRST_NAME, LAST_NAME] = ME.name.split(" ");
const HEY_TEXT = "hey, i'm";
const ROLE_TEXT = ME.role;

const Letters = memo(function Letters({
  text,
  base,
  step,
  duration = 0.7,
}: {
  text: string;
  base: number;
  step: number;
  duration?: number;
}) {
  return (
    <>
      {text.split("").map((ch, i) =>
        ch === " " ? (
          <span key={i} aria-hidden="true" className="inline-block">
            &nbsp;
          </span>
        ) : (
          <span
            key={i}
            aria-hidden="true"
            className="inline-block animate-[mh-letter_0.7s_cubic-bezier(0.2,0.8,0.2,1)_forwards] [opacity:0] [transform:translateY(110%)_rotate(5deg)]"
            data-mh-letter
            style={{
              animationDelay: `${(base + i * step).toFixed(3)}s`,
              animationDuration: `${duration}s`,
            }}
          >
            {ch}
          </span>
        )
      )}
    </>
  );
});

// Module-scope: fixed locale/timezone, safe to share between SSR + ticks.
const cairoTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Cairo",
  hour: "2-digit",
  minute: "2-digit",
});
const cairoOffset = new Intl.DateTimeFormat("en", {
  timeZone: "Africa/Cairo",
  timeZoneName: "shortOffset",
});

function formatClock(now: Date): string {
  const o =
    cairoOffset.formatToParts(now).find((x) => x.type === "timeZoneName")
      ?.value || "";
  return cairoTime.format(now) + " · " + o.replace("GMT", "UTC");
}

export default function HeroSection() {
  const heroRef = useRef<HTMLElement | null>(null);
  const [clock, setClock] = useState(() => formatClock(new Date()));
  const [bookingOpen, setBookingOpen] = useState(false);
  // A share link can greet this visitor by name ("hey, Sam, it's Mohand") instead of
  // the default line. Null on the server and the first client render, so the default
  // shows first and the tailored line swaps in without a hydration mismatch.
  const tailor = useTailor();
  const hey = tailor?.Greeting?.trim() || HEY_TEXT;

  useEffect(() => {
    const tick = () => {
      setClock(formatClock(new Date()));
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(prefetchBookingModal, { timeout: 8000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(prefetchBookingModal, 5000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let tx = 0;
    let ty = 0;
    let px = 0;
    let py = 0;
    let raf = 0;
    let visible = true;
    let lastX = "0px";
    let lastY = "0px";
    // Cache the hero rect: reading getBoundingClientRect on every
    // pointermove forces a layout; refresh on scroll/resize instead.
    let rect = hero.getBoundingClientRect();
    const refreshRect = () => {
      rect = hero.getBoundingClientRect();
    };

    const locked = () =>
      document.documentElement.dataset.sectionTransition === "1";
    const kick = () => {
      if (!raf && visible) raf = requestAnimationFrame(frame);
    };
    const onMove = (e: PointerEvent) => {
      const r = rect;
      tx = -((e.clientX - r.left) / r.width - 0.5) * 24;
      ty = -((e.clientY - r.top) / r.height - 0.5) * 16;
      kick();
    };
    const onLeave = () => {
      tx = ty = 0;
      kick();
    };
    const frame = () => {
      raf = 0;
      if (!visible) return;
      const isLocked = locked();
      const gx = isLocked ? 0 : tx;
      const gy = isLocked ? 0 : ty;
      px += (gx - px) * 0.08;
      py += (gy - py) * 0.08;
      if (Math.abs(gx - px) < 0.02) px = gx;
      if (Math.abs(gy - py) < 0.02) py = gy;
      const sx = px.toFixed(2) + "px";
      const sy = py.toFixed(2) + "px";
      if (sx !== lastX || sy !== lastY) {
        hero.style.setProperty("--px", sx);
        hero.style.setProperty("--py", sy);
        lastX = sx;
        lastY = sy;
      }
      // Park when settled; kick() restarts on next input/visibility/lock.
      if (px !== gx || py !== gy) raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        kick();
      },
      { threshold: 0 }
    );
    io.observe(hero);

    // Re-awaken when the pager curtain locks/unlocks the parallax target.
    const mo = new MutationObserver(kick);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-section-transition"],
    });

    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", refreshRect, { passive: true });
    window.addEventListener("resize", refreshRect);
    raf = requestAnimationFrame(frame);
    return () => {
      io.disconnect();
      mo.disconnect();
      cancelAnimationFrame(raf);
      raf = 0;
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", refreshRect);
      window.removeEventListener("resize", refreshRect);
    };
  }, []);

  return (
    <section
      ref={heroRef}
      aria-label="Introduction"
      style={{ "--px": "0px", "--py": "0px" } as CSSProperties}
      className="relative isolate h-svh min-h-[540px] overflow-hidden bg-bg-primary [color-scheme:dark] [&>*]:absolute"
    >
      <TopoBackground />
      <h1 data-pager-focus tabIndex={-1} className="sr-only">
        {ME.name} — {ME.role}. {ME.tagline}
      </h1>
      <div
        id="mh-a"
        aria-hidden="true"
        className="mh-nm left-[4vw] top-[15%] z-[2] overflow-hidden p-[0.04em_0.02em] font-hero-display text-[11vw] font-normal uppercase leading-[0.88] text-text-primary [transform:translate(calc(var(--px)*-0.35),calc(var(--py)*-0.35))]"
      >
        <span className="block">
          <Letters text={FIRST_NAME} base={0.55} step={0.06} />
        </span>
      </div>
      <div
        id="mh-b"
        aria-hidden="true"
        className="mh-nm right-[1vw] top-[47%] z-[2] overflow-hidden p-[0.04em_0.02em] font-hero-display text-[11vw] font-normal uppercase leading-[0.88] text-text-primary [transform:translate(calc(var(--px)*-0.35),calc(var(--py)*-0.35))]"
      >
        <span className="block">
          <Letters text={LAST_NAME} base={1.0} step={0.06} />
        </span>
      </div>

      <div
        className="mh-me pointer-events-none bottom-0 left-[48%] z-[3] h-[88%] w-[min(86vw,420px)] [transform:translate(calc(-50%+var(--px)/-3),0)] md:w-[520px]"
      >
        <Image
          src="/me/mohand-cutout.png"
          alt="Portrait of Mohand Darwish, software engineer based in Alexandria, Egypt"
          width={817}
          height={1379}
          priority
          fetchPriority="high"
          sizes="(max-width: 488px) 86vw, (max-width: 768px) 420px, 520px"
          className="h-full w-full object-contain object-bottom drop-shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        />
      </div>

      <p
        aria-hidden="true"
        className="mh-hw mh-hey pointer-events-none left-[4.4vw] top-[8.5%] z-[4] overflow-hidden px-[0.1em] py-[0.15em] font-hero-hand text-[1.9vw] uppercase text-accent-text [text-shadow:0_0_18px_var(--accent-ring)] [transform:rotate(-4deg)]"
      >
        <Letters text={hey} base={0.15} step={0.035} duration={0.55} />
      </p>
      <p
        aria-hidden="true"
        className="mh-hw mh-tag pointer-events-none right-[5vw] top-[8%] z-[4] overflow-hidden px-[0.1em] py-[0.15em] text-right font-hero-hand text-[2vw] uppercase leading-[1.1] text-accent-text [text-shadow:0_0_18px_var(--accent-ring)] [transform:rotate(-3deg)]"
      >
        <Letters text={ROLE_TEXT} base={1.55} step={0.018} duration={0.55} />
      </p>

      <div
        className="mh-pills bottom-[5%] left-[4vw] z-[5] flex animate-[mh-fade_0.8s_ease_2.6s_forwards] flex-wrap gap-[10px] opacity-0"
      >
        <GlassPill className="font-heading no-underline">
          <i
            aria-hidden="true"
            className="h-2 w-2 animate-[mh-pl_1.8s_ease-in-out_infinite] rounded-full bg-accent-text shadow-[0_0_10px_var(--accent-ring)]"
          />
          {ME.location} <b suppressHydrationWarning className="font-medium text-text-secondary">{clock}</b>
        </GlassPill>
        <GlassChip
          type="button"
          active
          onClick={() => setBookingOpen(true)}
          onMouseEnter={prefetchBookingModal}
          onFocus={prefetchBookingModal}
          data-track="contact-open"
          className="font-heading no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Book a call &rarr;
        </GlassChip>
      </div>
      <BookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} />
      {/* scroll cue — motion-safe, hides on reduced-motion via hero.css */}
      <a
        href="#stack-wrap"
        aria-label="Scroll to stack"
        className="mh-cue absolute bottom-4 left-1/2 z-[6] hidden -translate-x-1/2 flex-col items-center gap-1 text-text-muted transition-colors hover:text-accent-text focus-ring md:flex"
      >
        <span className="font-heading text-[10px] uppercase tracking-[0.2em]">Scroll</span>
        <span aria-hidden="true" className="block h-8 w-[22px] rounded-full border border-current p-1">
          <span className="mh-cue-dot mx-auto block h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      </a>
    </section>
  );
}
