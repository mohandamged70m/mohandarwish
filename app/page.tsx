import HeroSection from "@/components/hero/HeroSection";
import ProjectsSection from "@/components/projects/ProjectsSection";
import { ContactCard } from "@/components/contact/contact-card";
import { BookingHashHandler } from "@/components/booking/BookingHashHandler";

export default function Home() {
  return (
    <div className="w-full">
      <main className="flex flex-col w-full flex-1">
        <HeroSection />
        <ProjectsSection />
        <ContactCard />
      </main>
      <BookingHashHandler />
    </div>
  );
}
