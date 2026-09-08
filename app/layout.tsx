import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Nav } from "@/components/layouts/nav";
import { CvModalHost } from "@/components/cv/CvModal";
import { PathMemory } from "@/components/layouts/path-memory";
import { Providers } from "@/components/layouts/providers";
import { ModalViewport } from "@/components/layouts/modal-viewport";
import { RouteCurtain } from "@/components/transitions";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mohand Darwish | Software Engineer — Full-Stack, Frontend-leaning",
  description: "Mohand Darwish — Software Engineer (Full-Stack, Frontend-leaning) from Alexandria. Next.js, TypeScript, Node — clean architecture, perf, a11y.",
};

export default function RootLayout({ children, modal }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} ${plexMono.variable} antialiased`}
    >
      <body suppressHydrationWarning className="min-h-screen flex flex-col bg-bg-primary text-text-primary">
        {/* Kill browser scroll restoration before hydration: every fresh load
            starts at the top (hero) instead of a stale mid-section offset. */}
        <Script id="scroll-restoration" strategy="beforeInteractive">
          {`try{window.history.scrollRestoration="manual"}catch(e){}`}
        </Script>
        <Providers>
          <PathMemory />
          <Nav />
          <CvModalHost />
          <RouteCurtain />
          {children}
          <ModalViewport modal={modal} />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
