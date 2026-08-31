import HeroSection from "@/components/hero/HeroSection";
import ProjectsSection from "@/components/projects/ProjectsSection";
import { ContactCard } from "@/components/contact/contact-card";
import { BookingHashHandler } from "@/components/booking/BookingHashHandler";

export default function Home() {
  return (
    <div className="w-full">
      <section id="hero">
        <HeroSection />
      </section>
      <section id="projects">
        <ProjectsSection />
      </section>
      <section id="contact">
        <ContactCard />
      </section>
      <BookingHashHandler />
    </div>
  );
}
