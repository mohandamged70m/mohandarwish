import { Education } from "@/components/about/education";
import { Experience } from "@/components/about/experience";
import { Skills } from "@/components/about/skills";
import { Stack } from "@/components/about/stack";
import { ContactCard } from "@/components/contact/contact-card";
import { FadeIn } from "@/components/ui/motion-primitives";
import { createMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = createMetadata({
  title: "About",
  description: "About me, background, and how to book a call.",
  path: "/about",
});

export default function AboutPage(): ReactNode {
  return (
    <main id="main-content" className="flex flex-1 flex-col">
      <section className="mx-auto w-full max-w-3xl px-6 pt-24 pb-12 sm:px-6 lg:px-8 sm:pt-28 sm:pb-16 lg:pt-32">
        <FadeIn delay={0.5}>
          <div className="rounded-[20px] border border-border bg-bg-surface p-8 sm:p-12">
            <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight text-text-primary sm:text-[2rem]">
              Hello! I&rsquo;m <span className="border-b border-accent/30 pb-0.5 text-accent">Mohand Darwish</span>.
            </h1>
            <p className="mt-3 font-heading text-sm tracking-wide text-text-muted">Alexandria, Egypt · GMT+2 · Full-Stack, Frontend-leaning</p>
            <div className="mt-8 space-y-6 font-body text-[17px] leading-[1.7] tracking-tight text-text-secondary sm:text-[18px]">
              <p>
                A <strong className="font-semibold text-text-primary">software engineer (full-stack, frontend-leaning)</strong> focused on clean architecture, performant web apps, and systems that scale. I ship <strong className="font-semibold text-text-primary">Next.js + TypeScript + Node</strong> with attention to perf, a11y and DX.
              </p>
              <p>
                I enjoy turning fuzzy product ideas into shipped software — from design tokens and component APIs to tRPC routes and Postgres queries. My sweet spot is where <strong className="font-semibold text-text-primary">frontend craft meets full-stack ownership</strong>.
              </p>
              <p>
                Currently building mock engineering projects across <strong className="font-semibold text-text-primary">design systems, tooling and full-stack products</strong> — always open to collaboration. See <a href="/projects" className="text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent">projects</a> or{" "}
                <a href="/#booking" className="text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent">
                  book a call
                </a>
                .
              </p>
            </div>
          </div>
        </FadeIn>
      </section>

      <section className="mx-auto w-full max-w-3xl px-6 pb-20 sm:px-6 lg:px-8 sm:pb-28">
        <FadeIn delay={0.1}>
          <div className="flex flex-col gap-10">
            <Experience />
            <Education />
            <Skills />
            <Stack />
          </div>
        </FadeIn>
      </section>

      <ContactCard />
      <div className="h-12 sm:h-16" />
    </main>
  );
}
