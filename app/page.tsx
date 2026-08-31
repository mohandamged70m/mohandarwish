import HeroSection from "@/components/hero/HeroSection";
import ProjectsSection from "@/components/projects/ProjectsSection";
import { ContactCard } from "@/components/contact/contact-card";
import { BookingHashHandler } from "@/components/booking/BookingHashHandler";

export default function Home() {
  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden">
      <div id="hero" className="flex min-h-[100svh] w-full max-w-full min-w-0 flex-col overflow-hidden supports-[min-height:100dvh]:min-h-[100dvh]">
        <HeroSection />
      </div>
      <div id="projects-wrap" className="flex min-h-0 w-full max-w-full min-w-0 flex-col justify-center overflow-hidden">
        <ProjectsSection />
      </div>
      <div id="contact-wrap" className="flex w-full max-w-full min-w-0 flex-col justify-center overflow-hidden">
        <ContactCard />
      </div>
      <BookingHashHandler />
    </div>
  );
}
