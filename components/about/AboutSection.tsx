"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { ME } from "@/Data/me";
import { Education } from "@/components/about/education";
import { Experience } from "@/components/about/experience";
import { Skills } from "@/components/about/skills";

const StackLazy = dynamic(
  () => import("@/components/about/stack").then((m) => m.Stack),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-[20px] border border-border bg-bg-surface p-6 text-center">
        <p className="font-heading text-sm font-medium text-text-primary">
          Loading playground…
        </p>
      </div>
    ),
  }
);

const TABS = ["Experience", "Education", "Skills", "Stack"] as const;
type Tab = (typeof TABS)[number];

export function AboutSection(): ReactNode {
  const [active, setActive] = useState<Tab>("Experience");

  return (
    <section
      id="about"
      aria-label="About"
      className="relative w-full max-w-full min-w-0 scroll-mt-24 overflow-hidden bg-bg-primary"
    >
      {/* backdrop — subtle right-side glow to separate from projects carousel, distinct from contact */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
        <div className="absolute inset-y-0 right-0 w-[60%] bg-[radial-gradient(ellipse_at_80%_40%,var(--accent-ring)_0%,transparent_60%)] opacity-50" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-60" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="grid w-full items-start gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
          {/* ── left : condensed intro (stays short so Contact isn't pushed far) ── */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-start gap-5"
          >
            <p className="font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
              About
            </p>
            <h2 className="font-heading text-[clamp(1.75rem,3vw+1rem,2.5rem)] font-bold leading-[1.02] tracking-[-0.02em] text-text-primary">
              Frontend craft,
              <br />
              full-stack ownership.
            </h2>
            <div className="max-w-[46ch] space-y-3 font-body text-[15px] leading-relaxed text-text-secondary sm:text-base">
              <p>
                I&rsquo;m <strong className="font-semibold text-text-primary">Mohand Darwish</strong> — a software
                engineer (full-stack, frontend-leaning) shipping{" "}
                <strong className="font-semibold text-text-primary">Next.js + TypeScript + Node</strong> with
                attention to perf, a11y and DX.
              </p>
              <p>
                My sweet spot is where design tokens and component APIs meet tRPC routes and Postgres queries.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 font-heading text-xs text-text-muted">
              <span className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-bg-surface px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {ME.location} · {ME.timezone}
              </span>
              <span className="inline-flex items-center rounded-pill border border-border bg-bg-surface px-3 py-1.5">
                {ME.availability}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-1 font-heading text-sm">
              <Link
                href="/about"
                className="focus-ring group inline-flex items-center gap-1.5 font-medium text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent"
              >
                Read full story
                <span aria-hidden className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
              </Link>
              <a
                href={ME.cvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring text-text-secondary underline decoration-border underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
              >
                Download CV
              </a>
            </div>
          </motion.div>

          {/* ── right : tabbed details (one card tall, not four stacked sections) ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="flex min-w-0 flex-col gap-4"
          >
            <div
              role="tablist"
              aria-label="About details"
              className="inline-flex max-w-full items-center gap-1 self-start overflow-x-auto rounded-full border border-border bg-bg-surface p-1.5 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {TABS.map((tab) => {
                const isActive = tab === active;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActive(tab)}
                    className={`relative shrink-0 cursor-pointer rounded-full px-4 py-2 font-heading text-[13px] font-medium whitespace-nowrap transition-colors sm:text-sm ${
                      isActive ? "bg-accent text-text-on-accent shadow-[0_0_20px_var(--accent-ring)]" : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            <div className="min-h-[300px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  {active === "Experience" && <Experience />}
                  {active === "Education" && <Education />}
                  {active === "Skills" && <Skills />}
                  {active === "Stack" && <StackLazy />}
                </motion.div>
              </AnimatePresence>
            </div>
            <p className="sr-only" aria-live="polite">
              Showing {active}
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default AboutSection;
