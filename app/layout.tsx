import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { Nav } from "@/components/layout/nav";
import { CvModalHost } from "@/components/cv/CvModal";
import { PathMemory } from "@/components/layout/path-memory";
import { Providers } from "@/components/layout/providers";
import { TrailsTracker } from "@/components/dashboard/TrailsTracker";
import { ModalViewport } from "@/components/layout/modal-viewport";
import { RouteCurtain } from "@/components/transitions";
import { Analytics } from "@vercel/analytics/next";
import { siteConfig } from "@/lib/metadata";
import { ME } from "@/data/me";

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
    default: "Mohand Darwish | Software Engineer — Full-Stack, Frontend-leaning",
    template: "%s | Mohand Darwish",
  },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  authors: [...siteConfig.authors],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  category: "technology",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Mohand Darwish | Software Engineer — Full-Stack, Frontend-leaning",
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mohand Darwish | Software Engineer — Full-Stack, Frontend-leaning",
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

// Structured data for Google + AI answer engines (ChatGPT, Perplexity, …):
// a Person entity with verifiable sameAs links, plus the WebSite entity.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": `${siteConfig.url}/#person`,
      name: ME.name,
      url: siteConfig.url,
      image: `${siteConfig.url}/me/mohand-darwish.jpeg`,
      jobTitle: "Software Engineer",
      description: siteConfig.description,
      email: `mailto:${ME.email}`,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Alexandria",
        addressCountry: "EG",
      },
      sameAs: [ME.socials.github, ME.socials.linkedin, ME.socials.x],
      knowsAbout: [
        "Next.js",
        "React",
        "TypeScript",
        "Node.js",
        "Full-Stack Development",
        "Frontend Engineering",
        "Web Accessibility",
        "Web Performance",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${siteConfig.url}/#website`,
      url: siteConfig.url,
      name: siteConfig.name,
      description: siteConfig.description,
      inLanguage: "en",
      author: { "@id": `${siteConfig.url}/#person` },
    },
  ],
};

export default function RootLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
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
        {/* Structured data: Person + WebSite (SEO + AI answer engines). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <Providers>
          <TrailsTracker />
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
