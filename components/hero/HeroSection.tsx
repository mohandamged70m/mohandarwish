"use client";

import TextAnimated from "./TextAnimated";
import { Button } from "@/components/ui/button";
import { ScaleUnblur } from "../ui/motion-primitives";
import { PortraitMorph } from "./portrait-morph";
import { BookButton } from "@/components/booking/BookButton";

const PORTRAIT_SRC = "/me/mohand-darwish.jpeg";
const PORTRAIT_HOVER_SRC = "/me/mohandarwish.jpeg";

const HeroSection = () => {
  return (
    <section
      aria-label="Introduction"
      className="relative flex min-h-[100svh] w-full max-w-full min-w-0 items-center overflow-hidden border-b border-border/50 supports-[min-height:100dvh]:min-h-[100dvh]"
    >
      {/* ── background ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {/* lime glow — left */}
        <div className="absolute inset-y-0 left-0 w-[68%] bg-[radial-gradient(ellipse_at_18%_52%,var(--accent-ring)_0%,transparent_62%)] opacity-70" />
        {/* subtle grid — masked to left side only */}
        <div className="absolute inset-0 opacity-[0.035] [mask-image:radial-gradient(ellipse_at_22%_50%,black_42%,transparent_72%)] bg-[linear-gradient(to_right,var(--border-strong)_1px,transparent_1px),linear-gradient(to_bottom,var(--border-strong)_1px,transparent_1px)] bg-[size:32px_32px]" />
        {/* top hairline accent */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-60" />
      </div>

      <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-1 items-center overflow-hidden px-4 py-6 pt-[calc(3.5rem+4dvh)] pb-[max(1.5rem,3dvh)] sm:px-6 sm:py-8 sm:pt-[calc(3.75rem+4dvh)] lg:px-8 lg:py-6 lg:pt-[calc(2rem+4dvh)]">
        <div className="grid w-full max-w-full min-w-0 items-center gap-8 sm:gap-10 overflow-hidden lg:grid-cols-[1.08fr_0.92fr] lg:gap-8 xl:gap-12 hero-grid">
          {/* ── left : content ── */}
          <div className="flex flex-col items-start gap-6 text-left lg:pr-2">
            {/* heading */}
            <div className="w-full space-y-4">
              <h1 className="font-heading font-bold leading-[0.92] tracking-[-0.02em] text-text-primary">
                <TextAnimated
                  text="Hi, I'm Mohand Darwish"
                  className="block text-left font-bold leading-[0.9] tracking-[-0.02em] text-[clamp(2rem,5vw+0.75rem,3.75rem)]"
                  stagger={18}
                  duration={260}
                />
              </h1>

              {/* accent rule */}
              <div className="flex justify-start">
                <div
                  aria-hidden
                  className="h-px w-24 bg-gradient-to-r from-accent/70 to-transparent"
                />
              </div>

              <p className="pt-1 font-heading text-base text-text-secondary sm:text-lg">
                <TextAnimated
                  text="Full-stack engineer, frontend-leaning — clean architecture, fast UIs, systems that scale."
                  className="block text-left font-heading font-medium tracking-tight text-text-secondary text-[clamp(0.95rem,1.5vw+0.6rem,1.25rem)]"
                  startDelay={280}
                  stagger={16}
                  duration={260}
                />
              </p>
            </div>

            {/* description */}
            <div className="max-w-[48ch] space-y-3">
              <p className="font-body text-sm leading-relaxed text-text-secondary">
                I turn product ideas into shipped software — Next.js + TypeScript + Node, with a focus on performance, accessibility and DX. Based in Alexandria, working worldwide.
              </p>
            </div>

            {/* CTAs — single primary conversion (Book a call), secondary View projects */}
            <div className="flex w-full flex-wrap justify-start gap-3 pt-1">
              <BookButton label="Book a call →" />
              <Button
                variant="secondary"
                size="lg"
                className="min-w-[152px] w-full sm:w-auto"
                aria-label="View projects — scroll to work"
                onClick={() => {
                  document
                    .getElementById("projects")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                View projects
              </Button>
            </div>

            {/* meta */}
            <div className="flex flex-wrap justify-start gap-2 pt-2 font-heading text-xs text-text-muted">
              <span className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-bg-surface px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Alexandria, Egypt
              </span>
            </div>
          </div>

          {/* ── right : portrait ── */}
          <div className="relative flex items-center justify-center lg:justify-end">
            {/* glow behind card */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-[88%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,var(--accent-ring)_0%,transparent_70%)] opacity-60 blur-[18px] lg:left-auto lg:right-[-4%] lg:w-[92%] lg:translate-x-0"
            />

            <ScaleUnblur className="relative w-full max-w-[320px] sm:max-w-[360px] lg:max-w-[clamp(320px,32vw,440px)] max-h-[min(50dvh,420px)] sm:max-h-[min(48dvh,460px)] lg:max-h-[min(62dvh,560px)]">
              <div className="relative aspect-square w-full max-h-[inherit] overflow-hidden rounded-[28px]">
                <div className="relative h-full w-full max-h-[inherit] overflow-hidden rounded-[28px] bg-bg-primary">
                  <PortraitMorph
                    srcA={PORTRAIT_SRC}
                    srcB={PORTRAIT_HOVER_SRC}
                    alt="Mohand portrait"
                  />
                </div>
              </div>
            </ScaleUnblur>
          </div>
        </div>
      </div>

      {/* scroll hint — desktop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 hidden justify-center pb-4 lg:flex"
      >
        <span className="inline-flex flex-col items-center gap-2 font-heading text-[10px] uppercase tracking-widest text-text-muted/60">
          <span className="h-6 w-px bg-gradient-to-b from-border-strong to-transparent" />
        </span>
      </div>
    </section>
  );
};

export default HeroSection;
