import { Suspense } from "react";
import HeroSection from "@/components/sections/hero/HeroSection";
import ProjectsSection from "@/components/sections/projects/ProjectsSection";
import { StackSurvey } from "@/components/sections/stack/StackSurvey";
import { AboutSection } from "@/components/sections/about/AboutSection";
import { BookingHashHandler } from "@/components/booking/BookingHashHandler";
import { Reveal, SectionDots } from "@/components/transitions";
import { ScrollTop } from "@/components/layout/ScrollTop";

import { getProjectsServer, getTagDirectoryServer } from "@/lib/projects-server";
import { createMetadata } from "@/lib/metadata";

export const revalidate = 3600;

export const metadata = createMetadata({
  title: "Mohand Darwish | Software Engineer & AI Product Builder",
  description:
    "Mohand Darwish is a software engineer and AI product builder in Alexandria, Egypt. He builds fast, accessible full-stack web apps with Next.js, TypeScript and Node.js. Projects, stack and booking are on this page.",
  path: "/",
});

// Module-level (referentially stable) list shared by the dot nav. Ids must
// match the wrapper divs below and the main nav's scroll-spy ids.
//
// About is deliberately absent: it is `sr-only` on `/`, so it is no longer a
// scroll destination and must not become a blank dot.
const SECTIONS = [
  { id: "hero", label: "Home" },
  { id: "stack-wrap", label: "Stack" },
  { id: "projects-wrap", label: "Projects" },
] as const;

export default function Home() {
  return (
    // Single <main> landmark for the whole page.
    <main id="main-content" className="flex w-full max-w-full min-w-0 flex-1 flex-col">
      <div className="w-full max-w-full min-w-0 overflow-x-clip">
        <div id="hero" className="flex min-h-[100svh] w-full max-w-full min-w-0 flex-col overflow-x-clip supports-[min-height:100dvh]:min-h-[100dvh]">
          {/* Hero is excluded from the reveal: no blur, no waiting. */}
          <Reveal as="div" hero className="flex w-full min-w-0 flex-1 flex-col">
            <HeroSection />
          </Reveal>
        </div>
        {/* Crawl-only bio. `sr-only` is absolutely positioned, so it adds no
            flow height and needs no reveal wrapper. Kept server-rendered and
            in the accessibility tree: this is the sentence answer engines quote. */}
        <AboutSection />
        <div id="stack-wrap" className="flex min-h-[100svh] w-full max-w-full min-w-0 flex-col justify-center overflow-x-clip supports-[min-height:100dvh]:min-h-[100dvh]">
          <Reveal as="div" className="flex w-full min-w-0 flex-1 flex-col justify-center">
            <StackSurvey />
          </Reveal>
        </div>
        <div id="projects-wrap" className="flex min-h-[100svh] w-full max-w-full min-w-0 flex-col justify-center overflow-x-clip supports-[min-height:100dvh]:min-h-[100dvh]">
          <Reveal as="div" className="flex w-full min-w-0 flex-1 flex-col justify-center">
            <Suspense fallback={null}>
              <ProjectsData />
            </Suspense>
          </Reveal>
        </div>
        <span id="booking" aria-hidden="true" className="block h-0 w-0" />
        <BookingHashHandler />
        <SectionDots sections={SECTIONS} />
        <ScrollTop />
      </div>
    </main>
  );
}

// Below-fold data streams in after the hero: these async Server Components
// suspend independently, so the hero HTML (and the LCP image preload) flush
// to the browser without waiting on Convex. Same server-rendered cards and
// client live subscriptions as before — just no longer TTFB-blocking.
// Wrappers stay min-h-100svh, so late arrival causes no layout shift.
async function ProjectsData() {
  const [projects, tagDir] = await Promise.all([
    getProjectsServer().catch(() => []),
    getTagDirectoryServer().catch(() => undefined),
  ]);
  return <ProjectsSection initialProjects={projects} initialTagDir={tagDir} />;
}
