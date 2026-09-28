import type { Metadata } from "next";

export const siteConfig = {
  name: "Mohand Darwish",
  tagline: "Software Engineer — Full-Stack, Frontend-leaning",
  description:
    "Mohand Darwish is a software engineer in Alexandria, Egypt (GMT+2), working worldwide. Next.js, TypeScript and Node — clean architecture, fast interfaces, accessibility.",
  url: "https://mohanddarwish.vercel.app",
  locale: "en_US",
  creator: "@mohand_darwish",
  authors: [
    {
      name: "Mohand Darwish",
      url: "https://mohanddarwish.vercel.app",
    },
  ],
  keywords: [
    "Mohand Darwish",
    "Software Engineer",
    "Frontend Engineer",
    "AI Product Builder",
    "Full-Stack Developer",
    "Next.js Developer",
    "React Developer",
    "TypeScript",
    "Node.js",
    "Portfolio",
    "Alexandria",
    "Egypt",
    "Remote developer",
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
  const resolvedTitle = title ?? siteConfig.name;
  const resolvedDescription = description ?? siteConfig.description;

  return {
    title,
    description: resolvedDescription,
    keywords: [...siteConfig.keywords],
    authors: [...siteConfig.authors],
    creator: siteConfig.name,
    publisher: siteConfig.name,
    category: "technology",
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: resolvedTitle,
      description: resolvedDescription,
      url,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: "website",
      // No explicit images here: the file-based `app/opengraph-image.tsx`
      // route auto-generates og:image tags for every segment. Passing an
      // explicit `image` overrides it (used by project pages if needed).
      ...(image
        ? {
            images: [
              {
                url: image,
                width: 1200,
                height: 630,
                alt: resolvedTitle,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description: resolvedDescription,
      creator: siteConfig.creator,
      ...(image ? { images: [image] } : {}),
    },
    robots: noIndex
      ? { index: false, follow: false }
      : {
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
}
