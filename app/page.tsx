import HeroSection from "@/components/hero/HeroSection";
import ProjectsSection from "@/components/projects/ProjectsSection";
import { AboutSection } from "@/components/about/AboutSection";
import { ContactCard } from "@/components/contact/contact-card";
import { BookingHashHandler } from "@/components/booking/BookingHashHandler";
import { ScrollReveal, SectionSlide, SectionTransition } from "@/components/transitions";
import type { SectionDef } from "@/components/transitions";

// Paged sections target the full-page WRAPS (exact viewport boundaries),
// not the inner content blocks — so curtain reveals land pixel-flush with
// no seam of the previous section. Focus still lands on inner headings.
const SECTIONS: SectionDef[] = [
  { id: "hero", label: "Home" },
  { id: "projects-wrap", label: "Projects" },
  { id: "about-wrap", label: "About" },
  { id: "contact-wrap", label: "Contact" },
];

export default function Home() {
  return (
    <SectionTransition sections={SECTIONS}>
      <div className="w-full max-w-full min-w-0 overflow-x-hidden">
        <SectionSlide section="hero">
          <div id="hero" className="flex min-h-[100svh] w-full max-w-full min-w-0 flex-col overflow-hidden supports-[min-height:100dvh]:min-h-[100dvh]">
            <HeroSection />
          </div>
        </SectionSlide>
        <SectionSlide section="projects">
          <div id="projects-wrap" className="flex min-h-[100svh] w-full max-w-full min-w-0 flex-col justify-center overflow-hidden supports-[min-height:100dvh]:min-h-[100dvh]">
            <ScrollReveal>
              <ProjectsSection />
            </ScrollReveal>
          </div>
        </SectionSlide>
        <SectionSlide section="about">
          <div id="about-wrap" className="flex min-h-[100svh] w-full max-w-full min-w-0 flex-col justify-center overflow-hidden supports-[min-height:100dvh]:min-h-[100dvh]">
            <ScrollReveal delay={0.05}>
              <AboutSection />
            </ScrollReveal>
          </div>
        </SectionSlide>
        <SectionSlide section="contact">
          <div id="contact-wrap" className="flex min-h-[100svh] w-full max-w-full min-w-0 flex-col justify-center overflow-hidden supports-[min-height:100dvh]:min-h-[100dvh]">
            <ScrollReveal delay={0.05}>
              <ContactCard />
            </ScrollReveal>
          </div>
        </SectionSlide>
        <BookingHashHandler />
      </div>
    </SectionTransition>
  );
}
