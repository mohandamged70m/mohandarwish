import HeroSection from "@/components/hero/HeroSection";
import ProjectsSection from "@/components/projects/ProjectsSection";
import { ContactCard } from "@/components/contact/contact-card";
import { BookingHashHandler } from "@/components/booking/BookingHashHandler";
import { PixelNavigator } from "@/components/transitions/PixelNavigator";

export default function Home() {
  return (
    <div className="w-full">
      <PixelNavigator
        gridSize={20}
        pixelColor="var(--accent-primary)"
        animationStepDuration={0.42}
        sections={[
          { id: "hero", label: "Home", content: <HeroSection /> },
          { id: "projects", label: "Work", content: <ProjectsSection /> },
          { id: "contact", label: "Contact", content: <ContactCard /> },
        ]}
      />
      <BookingHashHandler />
    </div>
  );
}
