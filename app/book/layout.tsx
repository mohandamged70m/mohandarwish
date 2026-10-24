import type { Metadata } from "next"

import { siteConfig } from "@/lib/metadata"

// /book — public booking page mined from ./booking-system, adapted to Convex.
// The page body is client-only (BookPage is loaded with ssr: false) because the
// calendar, time zones and the entrance paint all depend on the visitor's clock
// and the DOM. Crawlers and AI agents still learn what /book is and how to use
// it from this JSON-LD + the <noscript> copy in page.tsx.
const pageUrl = `${siteConfig.url}/book`
const title = "Book a call | Mohand Darwish"
const description =
  "Book a free 30 minute Google Meet call with Mohand Darwish, software engineer and AI product builder. Pick a time in your own time zone."
const image = { url: "/book/mohand-cutout.webp", width: 920, height: 1286, alt: "Mohand Darwish" }

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "book a call with Mohand Darwish",
    "Mohand Darwish consultation",
    "hire frontend developer Egypt",
    "hire React developer",
    "hire AI engineer",
    "free consultation web developer",
    "Google Meet call",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    type: "website",
    url: pageUrl,
    title: "Book a call with Mohand Darwish",
    description: "A free 30 minute Google Meet call. Pick a time in your own time zone.",
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    images: [image],
  },
  twitter: {
    card: "summary_large_image",
    title: "Book a call with Mohand Darwish",
    description: "A free 30 minute Google Meet call. Pick a time in your own time zone.",
    images: [image.url],
  },
  other: {
    subject: "Book a free 30 minute call with Mohand Darwish",
    summary:
      "Booking page for Mohand Darwish, software engineer and AI product builder. Free 30 minute Google Meet calls about projects, roles, collaborations and podcasts.",
  },
}

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["WebPage", "ContactPage"],
      "@id": `${pageUrl}#webpage`,
      url: pageUrl,
      name: title,
      description,
      inLanguage: "en",
      isPartOf: { "@id": `${siteConfig.url}/#website` },
      about: { "@id": `${siteConfig.url}/#person` },
      primaryImageOfPage: `${siteConfig.url}${image.url}`,
      breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
      mainEntity: { "@id": `${pageUrl}#service` },
      potentialAction: {
        "@type": "ScheduleAction",
        name: "Book a free 30 minute call",
        target: {
          "@type": "EntryPoint",
          urlTemplate: pageUrl,
          actionPlatform: [
            "https://schema.org/DesktopWebPlatform",
            "https://schema.org/MobileWebPlatform",
          ],
        },
        object: { "@id": `${pageUrl}#service` },
      },
    },
    {
      "@type": "Service",
      "@id": `${pageUrl}#service`,
      name: "Free 30 minute call with Mohand Darwish",
      serviceType: "Consultation call",
      description:
        "A free 30 minute video call on Google Meet with Mohand Darwish about a project, a role, a collaboration or a podcast. The invite and Meet link are emailed after booking.",
      provider: { "@id": `${siteConfig.url}/#person` },
      areaServed: "Worldwide",
      availableChannel: {
        "@type": "ServiceChannel",
        serviceUrl: pageUrl,
        availableLanguage: "English",
      },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: pageUrl,
      },
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${pageUrl}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: siteConfig.name, item: siteConfig.url },
        { "@type": "ListItem", position: 2, name: "Book a call", item: pageUrl },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${pageUrl}#faq`,
      isPartOf: { "@id": `${pageUrl}#webpage` },
      inLanguage: "en",
      mainEntity: [
        {
          "@type": "Question",
          name: "How do I book a call?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Open the /book page, pick an open date on the calendar, choose a time slot (shown in your own time zone), then enter your name, email and what the call is about and press Book. A calendar invite with the Google Meet link is emailed to you.",
          },
        },
        {
          "@type": "Question",
          name: "How long is the call and what does it cost?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The call is 30 minutes on Google Meet and it is free.",
          },
        },
      ],
    },
  ],
}

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {children}
    </>
  )
}
