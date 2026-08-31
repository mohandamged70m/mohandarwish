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
        <FadeIn className="flex flex-col items-center gap-4 text-center">
          <h1 className="font-heading text-[2.5rem] font-bold leading-[0.95] tracking-[-0.02em] text-text-primary md:text-[3.25rem] lg:text-[3.5rem]">
            All projects
          </h1>
          <p className="max-w-[42ch] font-body text-[16px] leading-[1.5] tracking-tight text-text-secondary sm:text-[17px]">
            Full archive — not just the top 6. Every project, filterable by category.
          </p>
        </FadeIn>
      </section>
      <Projects />
      <ContactCard />
      <div className="h-12 sm:h-16" />
    </main>
  );
}
