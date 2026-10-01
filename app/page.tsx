import { Suspense } from "react";
import HeroSection from "@/components/sections/hero/HeroSection";
import ProjectsSection from "@/components/sections/projects/ProjectsSection";
import { StackSection } from "@/components/sections/stack/StackSection";
import { ContactCard } from "@/components/sections/contact/ContactCard";
import { AboutSection } from "@/components/sections/about/AboutSection";
import { BookingHashHandler } from "@/components/booking/BookingHashHandler";
import { SectionSlide, SectionTransition } from "@/components/transitions";

import { getStackServer } from "@/lib/profile-server";
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
// About joins the pager because it is a real, scrollable section whose content
// is server-rendered in the initial HTML — an answer engine or crawler never
// has to execute anything to read the bio sentence.
const SECTIONS = [
  { id: "hero", label: "Home" },
  { id: "about-wrap", label: "About" },
  { id: "projects-wrap", label: "Projects" },
  { id: "stack-wrap", label: "Stack" },
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
          <div id="about-wrap" className="flex min-h-[100svh] w-full max-w-full min-w-0 flex-col justify-center overflow-hidden supports-[min-height:100dvh]:min-h-[100dvh]">
            <SectionSlide section="about-wrap" className="flex w-full min-w-0 flex-1 flex-col justify-center">
              <AboutSection />
            </SectionSlide>
          </div>
          <div id="projects-wrap" className="flex min-h-[100svh] w-full max-w-full min-w-0 flex-col justify-center overflow-hidden supports-[min-height:100dvh]:min-h-[100dvh]">
            <SectionSlide section="projects-wrap" className="flex w-full min-w-0 flex-1 flex-col justify-center">
              <Suspense fallback={null}>
                <ProjectsData />
              </Suspense>
            </SectionSlide>
          </div>
          <div id="stack-wrap" className="flex min-h-[100svh] w-full max-w-full min-w-0 flex-col justify-center overflow-hidden supports-[min-height:100dvh]:min-h-[100dvh]">
            <SectionSlide section="stack-wrap" className="flex w-full min-w-0 flex-1 flex-col justify-center">
              <Suspense fallback={null}>
                <StackData />
              </Suspense>
            </SectionSlide>
          </div>
          <div id="contact-wrap" className="flex min-h-[100svh] w-full max-w-full min-w-0 flex-col justify-center overflow-hidden supports-[min-height:100dvh]:min-h-[100dvh]">
            <SectionSlide section="contact-wrap" className="flex w-full min-w-0 flex-1 flex-col justify-center">
              <ContactCard />
            </SectionSlide>
          </div>
          <BookingHashHandler />
        </div>
      </main>
    </SectionTransition>
  );
}

// Below-fold data streams in after the hero: these async Server Components
// suspend independently, so the hero HTML (and the LCP image preload) flush
// to the browser without waiting on Supabase. Same server-rendered cards and
// client live subscriptions as before — just no longer TTFB-blocking.
// Wrappers stay min-h-100svh, so late arrival causes no layout shift.
async function ProjectsData() {
  // Server-rendered project cards for instant first paint; the section's
  // live subscriptions still attach client-side afterwards (see useProjects).
  const projects = await getProjectsServer().catch(() => []);
  return <ProjectsSection initialProjects={projects} />;
}

async function StackData() {
  const stack = await getStackServer();
  return (
    <StackSection
      stack={stack.map((c) => ({ label: c.label, slug: c.slug, bg: c.bg, fg: c.fg, iconUrl: c.icon_url }))}
    />
  );
}
