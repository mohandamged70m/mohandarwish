"use client";

import TextAnimated from "./TextAnimated";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScaleUnblur } from "../ui/motion-primitives";
import { PortraitMorph } from "./portrait-morph";

const PORTRAIT_SRC = "/josh.webp";
const PORTRAIT_HOVER_SRC = "/josh_wave.webp";

const HeroSection = () => {
  return (
    <section
      aria-label="Introduction"
      className="relative w-full overflow-hidden border-b border-border/50"
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

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 pt-24 pb-10 sm:gap-12 sm:pt-28 sm:pb-14 lg:grid-cols-[1.08fr_0.92fr] lg:gap-8 lg:pt-32 lg:pb-16 xl:gap-12 xl:pt-36 xl:pb-20">
          {/* ── left : content ── */}
          <div className="flex flex-col items-start gap-6 text-left lg:pr-2">
            {/* availability */}
            <Badge
              variant="soft"
              className="gap-2 py-1.5 pl-2.5 pr-3 text-[11px] font-medium uppercase tracking-wide"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              Available for new opportunities
            </Badge>

            {/* heading */}
            <div className="w-full space-y-4">
              <h1 className="font-heading font-bold leading-[0.92] tracking-[-0.02em] text-text-primary">
                <TextAnimated
                  text="Hi, I'm Mohand Darwish"
                  className="block text-left text-[2.15rem] font-bold leading-[0.9] tracking-[-0.02em] sm:text-5xl lg:text-[3.45rem] xl:text-6xl"
                  stagger={45}
                  duration={500}
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
                  text="A passionate software engineer, love creating innovative solutions."
                  className="block text-left font-heading text-base font-medium tracking-tight text-text-secondary sm:text-lg lg:text-xl"
                  startDelay={950}
                  stagger={35}
                  duration={400}
                />
              </p>
            </div>

            {/* description */}
            <div className="max-w-[54ch] space-y-3">
              <p className="font-body text-sm leading-relaxed text-text-muted">
                Focused on clean architecture, performant web apps, and
                delightful user experiences.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex w-full flex-wrap justify-start gap-3 pt-1">
              <Button
                variant="primary"
                size="lg"
                className="min-w-[152px] shadow-[0_0_24px_var(--accent-ring)]"
                onClick={() => {
                  document
                    .getElementById("contact")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Get in touch
                <span aria-hidden className="ml-2 translate-y-px">
                  →
                </span>
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="min-w-[152px]"
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
                Cairo, Egypt
              </span>
              <span className="inline-flex items-center rounded-pill border border-border bg-bg-surface px-3 py-1.5 tracking-wide">
                Next.js • TypeScript • Node.js
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

            <ScaleUnblur className="relative w-full max-w-[360px] sm:max-w-[400px] lg:max-w-[440px]">
              <div className="relative aspect-square w-full overflow-hidden rounded-[28px]">
                <div className="relative h-full w-full overflow-hidden rounded-[28px] bg-bg-primary">
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
