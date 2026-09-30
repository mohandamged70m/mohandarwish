import { Suspense } from "react";
import HeroSection from "@/components/sections/hero/HeroSection";
import ProjectsSection from "@/components/sections/projects/ProjectsSection";
import { StackSection } from "@/components/sections/stack/StackSection";
import { ContactCard } from "@/components/sections/contact/ContactCard";
import { BookingHashHandler } from "@/components/booking/BookingHashHandler";
import { SectionSlide, SectionTransition } from "@/components/transitions";

import { getStackServer } from "@/lib/profile-server";
import { getProjectsServer } from "@/lib/projects-server";
import { createMetadata } from "@/lib/metadata";

export const revalidate = 3600;

export const metadata = createMetadata({
  title: "Mohand Darwish — Software Engineer | AI Product Builder (Next.js, TypeScript)",
  description:
    "Mohand Darwish is a Software Engineer | AI Product Builder in Alexandria, Egypt, working worldwide. Next.js, TypeScript, Node — projects, background and booking.",
  path: "/",
});

// Module-level (referentially stable) pager sections — ids must match the
// wrapper divs below. Desktop pager (md+, fine pointer, full motion) plays
// the curtain + slide between these; everywhere else they free-scroll.
const SECTIONS = [
  { id: "hero", label: "Home" },
  { id: "projects-wrap", label: "Projects" },
  { id: "stack-wrap", label: "Stack" },
  { id: "contact-wrap", label: "Contact" },
] as const;

export default function Home() {
  return (
    <SectionTransition sections={[...SECTIONS]}>
      <div className="w-full max-w-full min-w-0 overflow-x-hidden">
        <div id="hero" className="flex min-h-[100svh] w-full max-w-full min-w-0 flex-col overflow-hidden supports-[min-height:100dvh]:min-h-[100dvh]">
          <SectionSlide section="hero" className="flex w-full min-w-0 flex-1 flex-col">
            <HeroSection />
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
