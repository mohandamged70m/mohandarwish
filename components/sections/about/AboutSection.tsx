import type { ReactNode } from "react";
import { KNOWS_ABOUT, ME, PROFILES } from "@/data/me";

/**
 * About section — Server Component, zero client JS, zero animation gating.
 *
 * GEO intent: the very first text node in this section is `ME.oneLiner`, a
 * single factual sentence that names the person, the role, the country, what
 * he builds and the stack. It is plain <p> text in the initial HTML payload:
 * not an image, not a per-letter span, not behind `whileInView`, not behind a
 * tab. That is what lets an answer engine quote it verbatim.
 *
 * Design note: styling reuses the exact tokens and rhythm of the neighbouring
 * Stack / Contact sections, so this reads as part of the existing system.
 */
export function AboutSection(): ReactNode {
  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      className="relative w-full max-w-full min-w-0 scroll-mt-24 overflow-hidden bg-bg-primary"
    >
      {/* backdrop — mirrors the Stack section's hairline + side glow, mirrored
          to the left so the four full-bleed sections stay visually distinct. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-[55%] bg-[radial-gradient(ellipse_at_20%_50%,var(--accent-ring)_0%,transparent_60%)] opacity-40" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-60" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <p className="font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-text">
          About
        </p>
        <h2
          id="about-heading"
          data-pager-focus
          tabIndex={-1}
          className="mt-3 max-w-[22ch] font-display text-[clamp(1.75rem,3vw+1rem,2.5rem)] font-bold leading-[1.02] tracking-[-0.02em] text-text-primary"
        >
          Engineering, end to end.
        </h2>

        {/* ── The quotable sentence. Plain text, first in the section. ── */}
        <p className="mt-6 max-w-[62ch] font-body text-[17px] font-semibold leading-[1.55] text-balance text-text-primary sm:text-[19px]">
          {ME.oneLiner}
        </p>

        <div className="mt-6 max-w-[62ch] space-y-4 font-body text-[15px] leading-relaxed text-text-secondary sm:text-base">
          <p>
            {ME.name} is a frontend-leaning full-stack engineer. He ships Next.js App Router
            products end to end — data model, API layer, interface, deployment — and treats
            performance, accessibility and readable code as part of the feature rather than a
            follow-up ticket. He builds AI product features with the same discipline, wiring
            language models into real product surfaces instead of demos.
          </p>
          <p>
            He works remotely from {ME.location} ({ME.timezone}) with teams in other time zones,
            and writes about what he builds so the reasoning is public and reusable.
          </p>
        </div>

        {/* ── Facts: definition list so the label/value pairs are machine-readable
             as well as human-readable. ── */}
        <dl className="mt-8 grid w-full max-w-4xl grid-cols-1 gap-px overflow-hidden rounded-[16px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Fact term="Based in" detail={ME.location} />
          <Fact term="Time zone" detail={ME.timezone} />
          <Fact term="Role" detail={ME.role} />
          <Fact term="Availability" detail={ME.availability} />
        </dl>

        {/* ── Skills: the same list that feeds schema.org `knowsAbout`. ── */}
        <div className="mt-8 w-full max-w-4xl">
          <h3 className="font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Skills
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {KNOWS_ABOUT.map((skill) => (
              <li
                key={skill}
                className="inline-flex items-center rounded-sm border border-border bg-bg-surface px-2.5 py-1 font-body text-[12px] leading-none text-text-secondary"
              >
                {skill}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Profiles: canonical outbound links to every identity, so crawlers
             and answer engines can resolve `sameAs` to a real destination. ── */}
        <div className="mt-8 w-full max-w-4xl">
          <h3 className="font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Profiles
          </h3>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-heading text-sm">
            {PROFILES.map((profile) => (
              <li key={profile.label}>
                <a
                  href={profile.url}
                  target="_blank"
                  rel="noopener noreferrer me"
                  className="focus-ring text-text-secondary underline decoration-border underline-offset-4 transition-colors hover:text-accent-text hover:decoration-accent"
                >
                  {profile.label}
                  <span className="sr-only"> — {ME.name} on {profile.label}</span>
                </a>
              </li>
            ))}
            <li>
              <a
                href={`mailto:${ME.email}`}
                className="focus-ring text-text-secondary underline decoration-border underline-offset-4 transition-colors hover:text-accent-text hover:decoration-accent"
              >
                {ME.email}
              </a>
            </li>
            <li>
              <a
                href={ME.cvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring text-text-secondary underline decoration-border underline-offset-4 transition-colors hover:text-accent-text hover:decoration-accent"
              >
                CV (PDF)
              </a>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Fact({ term, detail }: { term: string; detail: string }): ReactNode {
  return (
    <div className="flex flex-col gap-1 bg-bg-primary px-4 py-3">
      <dt className="font-heading text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {term}
      </dt>
      <dd className="font-body text-[14px] leading-snug text-text-primary">{detail}</dd>
    </div>
  );
}
