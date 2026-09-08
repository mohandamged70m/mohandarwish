import type { Metadata } from "next";

export const siteConfig = {
  name: "Mohand Darwish",
  description:
    "Mohand Darwish — Software Engineer (Full-Stack, Frontend-leaning) from Alexandria. Clean architecture, performant web apps, delightful UX. Next.js, TypeScript, Node.",
  url: "https://mohand-darwish.dev",
  ogImage: "/og-image.png",
  creator: "@mohanddarwish",
  authors: [
    {
      name: "Mohand Darwish",
      url: "https://mohand-darwish.dev",
    },
  ],
  keywords: [
    "Mohand Darwish",
    "Software Engineer",
    "Frontend Engineer",
    "Full-Stack",
    "Next.js",
    "React",
    "TypeScript",
    "Portfolio",
    "Alexandria",
  ],
} as const;

export function createMetadata({
  title,
  description,
  path = "/",
  image,
  noIndex = false,
}: {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
}): Metadata {
  const url = `${siteConfig.url}${path}`;
  const ogImage = image ?? siteConfig.ogImage;

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: title ?? siteConfig.name,
      description: description ?? siteConfig.description,
      url,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title ?? siteConfig.name,
        },
      ],
    },
    twitter: {
      title: title ?? siteConfig.name,
      description: description ?? siteConfig.description,
      images: [ogImage],
    },
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
  };
}
