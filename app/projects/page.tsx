import { Projects } from "@/components/sections/projects/Projects";
import { FadeIn } from "@/components/ui/motion-primitives";
import { ScrollReveal } from "@/components/transitions";
import { createMetadata } from "@/lib/metadata";
import { getProjectsServer } from "@/lib/projects-server";
import { projectListJsonLd, projectsCollectionJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { ME } from "@/data/me";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const revalidate = 3600;

export const metadata: Metadata = createMetadata({
  title: "Projects",
  description:
    "Every project by Mohand Darwish — production Next.js, TypeScript and full-stack builds, design systems, developer tooling and AI product work, with live demos and public source code.",
  path: "/projects",
});

export default async function ProjectsPage(): Promise<ReactNode> {
  // Server-fetched purely for the structured data. The visible list is the
  // same data hydrated client-side by useProjects, so the JSON-LD always
  // describes exactly the projects the page lists.
  const projects = await getProjectsServer().catch(() => []);

  return (
    <main id="main-content" className="flex flex-1 flex-col">
      <JsonLd data={projectsCollectionJsonLd()} />
      {projects.length > 0 && <JsonLd data={projectListJsonLd(projects)} />}

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
          {/* Factual lead-in for answer engines: names the owner, the count and
              the domain, in plain server-rendered text. */}
          <p className="max-w-[52ch] font-body text-[15px] leading-[1.6] tracking-normal text-pretty text-text-secondary sm:text-base">
            The complete archive of {ME.name}, a software engineer and AI product builder in{" "}
            {ME.location} — experiments, collaborations and production work, filterable by
            category. Every entry links to a case study with a live demo and public source
            code.
          </p>
          {projects.length > 0 && (
            <p className="font-heading text-[11px] uppercase tracking-[0.14em] text-text-muted">
              {projects.length} {projects.length === 1 ? "project" : "projects"} published
            </p>
          )}
        </FadeIn>
      </section>
      <ScrollReveal>
        <Projects />
      </ScrollReveal>
      <div className="h-12 sm:h-16" />
    </main>
  );
}
