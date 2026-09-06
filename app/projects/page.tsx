import { ContactCard } from "@/components/contact/contact-card";
import { Projects } from "@/components/projects/projects";
import { FadeIn } from "@/components/ui/motion-primitives";
import { createMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = createMetadata({
  title: "All Projects",
  description: "Full archive of projects — every build, experiment and collaboration.",
  path: "/projects",
});

export default function ProjectsPage(): ReactNode {
  return (
    <main id="main-content" className="flex flex-1 flex-col">
      <section className="mx-auto w-full max-w-7xl px-6 pt-24 pb-12 sm:px-6 lg:px-8 sm:pt-28 sm:pb-16 lg:pt-32">
        <FadeIn className="flex flex-col items-center gap-4 text-center sm:gap-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-surface px-3 py-1.5 font-heading text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <span className="text-text-secondary">~/projects</span>
            <span aria-hidden className="text-border-strong">
              ·
            </span>
            <span>full archive</span>
          </span>
          <h1 className="max-w-[16ch] font-heading text-[clamp(2.25rem,6vw,3.5rem)] font-bold leading-[1.04] tracking-[-0.02em] text-balance text-text-primary">
            Every build<span aria-hidden className="text-accent">.</span>
          </h1>
          <p className="max-w-[52ch] font-body text-[15px] leading-[1.6] tracking-normal text-pretty text-text-secondary sm:text-base">
            The complete archive — experiments, collaborations and production work, filterable by
            category.
          </p>
        </FadeIn>
      </section>
      <Projects />
      <ContactCard />
      <div className="h-12 sm:h-16" />
    </main>
  );
}
