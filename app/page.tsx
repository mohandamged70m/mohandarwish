import { Suspense } from "react";
import HeroSection from "@/components/sections/hero/HeroSection";
import ProjectsSection from "@/components/sections/projects/ProjectsSection";
import { StackSurvey } from "@/components/sections/stack/StackSurvey";
import { ContactCard } from "@/components/sections/contact/ContactCard";
import { AboutSection } from "@/components/sections/about/AboutSection";
import { BookingHashHandler } from "@/components/booking/BookingHashHandler";
import { SectionSlide, SectionTransition } from "@/components/transitions";
import { PagerDots } from "@/components/transitions/PagerDots";
import { ScrollTop } from "@/components/layout/ScrollTop";

import { getProjectsServer } from "@/lib/projects-server";
import { createMetadata } from "@/lib/metadata";

export const revalidate = 3600;

export const metadata = createMetadata({
  title: "Software Engineer & AI Product Builder in Egypt",
  description:
    "Mohand Darwish is a software engineer and AI product builder in Alexandria, Egypt. He builds fast, accessible full-stack web apps with Next.js, TypeScript and Node.js — projects, stack, and booking.",
  path: "/",
});

// Module-level (referentially stable) pager sections — ids must match the
// wrapper divs below. Desktop pager (md+, fine pointer, full motion) plays
// the curtain + slide between these; everywhere else they free-scroll.
//
// About is deliberately absent: it is `sr-only` on `/`, so it is no longer a
// scroll destination. Leaving it in this array would give the wheel pager and
// the curtain a blank full-height stop labelled "About".
const SECTIONS = [
  { id: "hero", label: "Home" },
  { id: "stack-wrap", label: "Stack" },
  { id: "projects-wrap", label: "Projects" },
  { id: "contact-wrap", label: "Contact" },
] as const;

export default function Home() {
  return (
    <SectionTransition sections={[...SECTIONS]}>
      {/* Single <main> landmark for the whole page. Was previously a bare
          fragment, so assistive tech and crawlers had no main region. */}
      <main id="main-content" className="flex w-full max-w-full min-w-0 flex-1 flex-col">
        <div className="w-full max-w-full min-w-0 overflow-x-hidden">
          <div id="hero" className="flex min-h-[100svh] w-full max-w-full min-w-0 flex-col overflow-hidden supports-[min-height:100dvh]:min-h-[100dvh]">
            <SectionSlide section="hero" className="flex w-full min-w-0 flex-1 flex-col">
              <HeroSection />
            </SectionSlide>
          </div>
          {/* Crawl-only bio. `sr-only` is `position: absolute` + 1px, so it
              contributes no flow height — hence no `min-h-[100svh]` wrapper and
              no `SectionSlide` (the slide starts at opacity 0 and would never
              animate in, since the section is no longer a pager target).
              Kept server-rendered and in the accessibility tree on purpose:
              this is the sentence answer engines quote. */}
          <AboutSection />
          <div id="stack-wrap" className="flex min-h-[100svh] w-full max-w-full min-w-0 flex-col justify-center overflow-hidden supports-[min-height:100dvh]:min-h-[100dvh]">
            <SectionSlide section="stack-wrap" className="flex w-full min-w-0 flex-1 flex-col justify-center">
              <StackSurvey />
            </SectionSlide>
          </div>
          <div id="projects-wrap" className="flex min-h-[100svh] w-full max-w-full min-w-0 flex-col justify-center overflow-hidden supports-[min-height:100dvh]:min-h-[100dvh]">
            <SectionSlide section="projects-wrap" className="flex w-full min-w-0 flex-1 flex-col justify-center">
              <Suspense fallback={null}>
                <ProjectsData />
              </Suspense>
            </SectionSlide>
          </div>
          <div id="contact-wrap" className="flex min-h-[100svh] w-full max-w-full min-w-0 flex-col justify-center overflow-hidden supports-[min-height:100dvh]:min-h-[100dvh]">
            <span id="booking" aria-hidden="true" className="block h-0 w-0" />
            <SectionSlide section="contact-wrap" className="flex w-full min-w-0 flex-1 flex-col justify-center">
              <ContactCard />
            </SectionSlide>
          </div>
          <BookingHashHandler />
          <PagerDots />
          <ScrollTop />
        </div>
      </main>
    </SectionTransition>
  );
}

// Below-fold data streams in after the hero: these async Server Components
// suspend independently, so the hero HTML (and the LCP image preload) flush
// to the browser without waiting on Convex. Same server-rendered cards and
// client live subscriptions as before — just no longer TTFB-blocking.
// Wrappers stay min-h-100svh, so late arrival causes no layout shift.
async function ProjectsData() {
  // Server-rendered project cards for instant first paint; the section's
  // live subscriptions still attach client-side afterwards (see useProjects).
  const projects = await getProjectsServer().catch(() => []);
  return <ProjectsSection initialProjects={projects} />;
}
