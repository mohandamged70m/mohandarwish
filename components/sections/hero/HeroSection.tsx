"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { BookingModal } from "@/components/booking/BookingModal";
import { ME } from "@/data/me";
import "./hero.css";

// Name split verbatim from ME.name ("Mohand Darwish").
const [FIRST_NAME, LAST_NAME] = ME.name.split(" ");

export default function HeroSection() {
  const heroRef = useRef<HTMLElement | null>(null);
  const [clock, setClock] = useState("");
  const [bookingOpen, setBookingOpen] = useState(false);

  // Live Cairo clock for the location pill.
  useEffect(() => {
    const tf = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Cairo",
      hour: "2-digit",
      minute: "2-digit",
    });
    const of2 = new Intl.DateTimeFormat("en", {
      timeZone: "Africa/Cairo",
      timeZoneName: "shortOffset",
    });
    const tick = () => {
      const o =
        of2.formatToParts(new Date()).find((x) => x.type === "timeZoneName")
          ?.value || "";
      setClock(tf.format(new Date()) + " · " + o.replace("GMT", "UTC"));
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => clearInterval(id);
  }, []);

  // Subtle pointer parallax only — skipped for prefers-reduced-motion.
  // The loop idles while the hero is off-screen (IntersectionObserver) and
  // skips DOM writes when settled, so it never churns style recalc under
  // the section curtain / slide transitions. Eases back to neutral while
  // a transition runs instead of fighting the slide animation.
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

    const kick = () => {
      if (!raf && visible) raf = requestAnimationFrame(frame);
    };
    const onMove = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
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
      const locked = document.documentElement.dataset.sectionTransition === "1";
      const gx = locked ? 0 : tx;
      const gy = locked ? 0 : ty;
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
      raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        kick();
      },
      { threshold: 0 }
    );
    io.observe(hero);

    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(frame);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      raf = 0;
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <section
      ref={heroRef}
      aria-label="Introduction"
      style={{ "--px": "0px", "--py": "0px" } as CSSProperties}
      className="relative h-svh min-h-[540px] overflow-hidden bg-bg-primary [color-scheme:dark] [&>*]:absolute"
    >
      <h1 data-pager-focus tabIndex={-1} className="sr-only">
        {ME.name} — {ME.role}
      </h1>
      <div
        id="mh-a"
        aria-hidden="true"
        className="mh-nm left-[4vw] top-[15%] z-[2] overflow-hidden p-[0.04em_0.02em] font-hero-display text-[11vw] font-normal uppercase leading-[0.88] text-text-primary [transform:translate(calc(var(--px)*-0.35),calc(var(--py)*-0.35))]"
      >
        <span className="block animate-[mh-up_1s_cubic-bezier(0.2,0.8,0.2,1)_0.25s_forwards] [transform:translateY(108%)]">
          {FIRST_NAME}
        </span>
      </div>
      <div
        id="mh-b"
        aria-hidden="true"
        className="mh-nm right-[1vw] top-[47%] z-[2] overflow-hidden p-[0.04em_0.02em] font-hero-display text-[11vw] font-normal uppercase leading-[0.88] text-text-primary [transform:translate(calc(var(--px)*-0.35),calc(var(--py)*-0.35))]"
      >
        <span className="block animate-[mh-up_1s_cubic-bezier(0.2,0.8,0.2,1)_0.5s_forwards] [transform:translateY(108%)]">
          {LAST_NAME}
        </span>
      </div>

      <div
        className="mh-me pointer-events-none bottom-0 left-[48%] z-[3] h-[88%] w-[min(86vw,420px)] animate-[mh-rise_1s_cubic-bezier(0.2,0.8,0.2,1)_0.15s_forwards] opacity-0 [transform:translate(calc(-50%+var(--px)/-3),36px)] md:w-[520px]"
      >
        <Image
          src="/me/mohand-cutout.png"
          alt="Portrait of Mohand Darwish, software engineer based in Alexandria, Egypt"
          width={817}
          height={1379}
          priority
          unoptimized
          className="h-full w-full object-contain object-bottom drop-shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        />
      </div>

      <p
        className="mh-hw mh-hey pointer-events-none left-[4.4vw] top-[8.5%] z-[4] animate-[mh-fade_0.8s_ease_1.4s_forwards] font-hero-hand text-[1.9vw] uppercase text-accent-text opacity-0 [text-shadow:0_0_18px_var(--accent-ring)] [transform:rotate(-4deg)]"
      >
        hey, i&apos;m
      </p>
      <p
        className="mh-hw mh-tag pointer-events-none right-[5vw] top-[8%] z-[4] animate-[mh-fade_0.8s_ease_1.7s_forwards] text-right font-hero-hand text-[2vw] uppercase leading-[1.1] text-accent-text opacity-0 [text-shadow:0_0_18px_var(--accent-ring)] [transform:rotate(-3deg)]"
      >
        {ME.role}
      </p>

      <div
        className="mh-pills bottom-[5%] left-[4vw] z-[5] flex animate-[mh-fade_0.8s_ease_2.1s_forwards] flex-wrap gap-[10px] opacity-0"
      >
        <span className="flex items-center gap-2 rounded-full border border-border bg-[color-mix(in_srgb,var(--bg-surface)_82%,transparent)] px-4 py-2.5 font-heading text-[clamp(10px,0.85vw,13px)] font-medium text-text-primary no-underline backdrop-blur-[6px]">
          <i
            aria-hidden="true"
            className="h-2 w-2 animate-[mh-pl_1.8s_ease-in-out_infinite] rounded-full bg-accent-text shadow-[0_0_10px_var(--accent-ring)]"
          />
          {ME.location} <b className="font-medium text-text-secondary">{clock}</b>
        </span>
        <button
          type="button"
          onClick={() => setBookingOpen(true)}
          data-track="contact-open"
          className="flex cursor-pointer items-center gap-2 rounded-full border border-accent bg-accent px-4 py-2.5 font-heading text-[clamp(10px,0.85vw,13px)] font-medium text-text-on-accent no-underline shadow-[0_0_20px_var(--accent-ring)] backdrop-blur-[6px] transition-colors hover:border-accent-hover hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Book a call &rarr;
        </button>
      </div>
      <BookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} />
    </section>
  );
}
