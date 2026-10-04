"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { ME } from "@/data/me";
import { Stack, type StackChip } from "@/components/sections/stack/Stack";
import { useProfile } from "@/hooks/useProfile";

export type StackSectionProps = {
  stack?: StackChip[];
};

export function StackSection(initial: StackSectionProps = {}): ReactNode {
  // Live data: prefer server-provided props (homepage fetch), fall back to
  // client fetch so dashboard edits appear without a rebuild. Falls back to
  // hardcoded defaults inside Stack when the list is empty/undefined.
  const live = useProfile();
  const stack = initial.stack ?? live.stack;
  const reduce = useReducedMotion();
  const reveal = reduce ? { initial: false } : {};

  return (
    <section
      id="stack"
      aria-label="Stack"
      className="relative w-full max-w-full min-w-0 scroll-mt-24 overflow-hidden bg-bg-primary"
    >
      {/* backdrop — subtle right-side glow to separate from projects carousel, distinct from contact */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
        <div className="absolute inset-y-0 right-0 w-[60%] bg-[radial-gradient(ellipse_at_80%_40%,var(--accent-ring)_0%,transparent_60%)] opacity-50" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-60" />
      </div>

      <div className="stack-shell relative mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-12">
        <div className="stack-grid grid w-full items-start gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
          {/* ── left : condensed intro — sticky on desktop so the story
              stays visible while the playground sits beside it. */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: reduce ? 0.01 : 0.6, ease: [0.22, 1, 0.36, 1] }}
            {...reveal}
            className="flex flex-col items-start gap-5 lg:sticky lg:top-28 lg:self-start"
          >
            <p className="font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-text">
              Stack
            </p>
            <h2 data-pager-focus tabIndex={-1} className="font-display text-[clamp(1.75rem,3vw+1rem,2.5rem)] font-bold leading-[1.02] tracking-[-0.02em] text-text-primary">
              Frontend craft,
              <br />
              full-stack ownership.
            </h2>
            <div className="max-w-[46ch] space-y-3 font-body text-[15px] leading-relaxed text-text-secondary sm:text-base">
              <p>
                I&rsquo;m <strong className="font-semibold text-text-primary">Mohand Darwish</strong> — a software
                engineer (full-stack, frontend-leaning) shipping{" "}
                <strong className="font-semibold text-text-primary">Next.js + TypeScript + Node</strong> who
                keeps an eye on speed, accessibility and readable code.
              </p>
              <p>
                These are the tools I reach for — drag the chips around, then check the work in{" "}
                <Link
                  href="/projects"
                  className="focus-ring font-medium text-accent-text underline decoration-accent/30 underline-offset-4 hover:decoration-accent"
                >
                  projects
                </Link>
                .
              </p>
            </div>
            <div className="flex flex-wrap gap-2 font-heading text-xs text-text-muted">
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-bg-surface px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {ME.location} · {ME.timezone}
              </span>
              <span className="inline-flex items-center rounded-sm border border-border bg-bg-surface px-3 py-1.5">
                {ME.availability}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-1 font-heading text-sm">
              <a
                href={ME.cvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring text-text-secondary underline decoration-border underline-offset-4 transition-colors hover:text-accent-text hover:decoration-accent"
              >
                Download CV
              </a>
            </div>
          </motion.div>

          {/* ── right : stack playground ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: reduce ? 0.01 : 0.7, ease: [0.22, 1, 0.36, 1], delay: reduce ? 0 : 0.1 }}
            {...reveal}
            className="flex min-w-0 flex-col gap-4"
          >
            <Stack chips={stack} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default StackSection;
