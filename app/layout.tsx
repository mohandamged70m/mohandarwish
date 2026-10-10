import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Anton, Inter, Permanent_Marker, Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Nav } from "@/components/layout/nav";
import { CvModalHost } from "@/components/cv/CvModal";
import { PathMemory } from "@/components/layout/path-memory";
import { Providers } from "@/components/layout/providers";
import { RouteCurtain } from "@/components/transitions/RouteCurtain";
import { TrailsTracker } from "@/components/dashboard/TrailsTracker";
import { ModalViewport } from "@/components/layout/modal-viewport";
import { ScrollRestorationFix } from "@/components/layout/scroll-restoration";
import { Analytics } from "@vercel/analytics/next";
import { siteConfig } from "@/lib/metadata";
import { SAME_AS } from "@/data/me";
import { JsonLd } from "@/components/seo/JsonLd";
import { siteEntityGraph } from "@/lib/seo";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

// Hero display + handwriting faces (new hero only). Scoped to
// --font-hero-* so they never override the Space Grotesk / Plex Mono system.
const heroDisplay = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-hero-display",
  display: "swap",
});

const heroHand = Permanent_Marker({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-hero-hand",
  display: "swap",
});

// Self-hosted (was next/font/google): the build environment can't always reach
// fonts.googleapis.com, which made Next fall back silently. Same files, same
// --font-plex-mono variable, zero network at build time.
const plexMono = localFont({
  variable: "--font-plex-mono",
  display: "swap",
  src: [
    { path: "../public/fonts/ibm-plex-mono-400.woff2", weight: "400" },
    { path: "../public/fonts/ibm-plex-mono-500.woff2", weight: "500" },
    { path: "../public/fonts/ibm-plex-mono-600.woff2", weight: "600" },
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "Mohand Darwish - Software Engineer",
    template: "%s | Mohand Darwish",
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [...siteConfig.keywords],
  authors: [...siteConfig.authors],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  category: "technology",
  // Site is English-only: no hreflang graph is emitted (a self-referencing
  // `alternates.languages` block with no translations is noise, not signal).
  alternates: {
    canonical: "/",
    types: {
      // Points LLM crawlers at the machine-readable brief for the site root.
      "text/markdown": "/llms.txt",
    },
  },
  // Crisp SVG brand mark first; the generated /icon PNG route stays as
  // fallback (and feeds the PWA manifest, which requires PNG).
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
  },
  // `me` links are the standard way to claim an identity across profiles.
  other: {
    "me": [...SAME_AS],
  },
  openGraph: {
    title: "Mohand Darwish - Software Engineer",
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    // The home page is the portfolio *site*, not an OG "profile" object —
    // the legacy profile type isn't rendered by current social consumers.
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mohand Darwish - Software Engineer",
    description: siteConfig.description,
    creator: siteConfig.creator,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// Structured data for Google + AI answer engines (ChatGPT, Perplexity, Gemini,
// Claude, AI Overviews). Person + WebSite + ProfilePage + primaryImage, built
// once in lib/seo.ts so the entity `@id`s are identical on every route and the
// handles can never disagree with the nav, footer, or llms.txt. Rendered in
// this Server Component, so it is in the initial HTML payload — not injected
// by client JS.
const jsonLd = siteEntityGraph();

export default function RootLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable} ${plexMono.variable} ${heroDisplay.variable} ${heroHand.variable} antialiased`}
    >
      <body suppressHydrationWarning className="min-h-screen flex flex-col bg-bg-primary text-text-primary">
        {/* Entity graph: Person + WebSite + ProfilePage (SEO + AI citation). */}
        <JsonLd data={jsonLd} />
        <Providers>
          <ScrollRestorationFix />
          <TrailsTracker />
          <PathMemory />
          {/* Banner landmark wraps the (fixed-position) primary nav. */}
          <header>
            <Nav />
          </header>
          <CvModalHost />
          <RouteCurtain />
          {children}
          <footer className="w-full border-t border-border bg-bg-primary">
            <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
              <p className="font-heading text-xs uppercase tracking-[0.12em] text-text-muted">
                © {new Date().getFullYear()} Mohand Darwish — Alexandria, EG · GMT+2
              </p>
              <nav aria-label="Footer" className="flex items-center gap-5 font-heading text-xs uppercase tracking-[0.12em]">
                <Link href="/projects" className="text-text-secondary transition-colors hover:text-accent-text">
                  Projects
                </Link>
                <Link href="/llms.txt" className="text-text-secondary transition-colors hover:text-accent-text">
                  llms.txt
                </Link>
                <a href="#booking" className="text-text-secondary transition-colors hover:text-accent-text">
                  Book a call
                </a>
              </nav>
            </div>
          </footer>
          <ModalViewport modal={modal} />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
