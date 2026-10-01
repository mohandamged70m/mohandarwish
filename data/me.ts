/**
 * Single source of truth for identity.
 *
 * SEO/GEO rule: the name, role, location and profile handles must be spelled
 * identically in metadata, JSON-LD, llms.txt, the nav and the page copy. Every
 * consumer reads from here so the site can never drift from itself.
 */
export const ME = {
  name: "Mohand Darwish",
  role: "Software Engineer | AI Product Builder",
  tagline: "Software Engineer | AI Product Builder. I build fast web apps that stay easy to change.",
  /**
   * GEO: one factual, self-contained, quotable sentence. Rendered as the first
   * line of the About section as plain server-rendered text (never inside an
   * animation, image, or client-only subtree) so answer engines can lift it
   * verbatim into a response with no surrounding context.
   */
  oneLiner:
    "Mohand Darwish is a software engineer and AI product builder based in Egypt who builds fast, accessible full-stack web applications using Next.js, TypeScript, and Node.js.",
  location: "Alexandria, Egypt",
  /** City only — use `${city}, ${country}` to avoid "Alexandria, Egypt, Egypt". */
  city: "Alexandria",
  country: "Egypt",
  countryCode: "EG",
  availability: "Available for new opportunities",
  timezone: "GMT+2",
  email: "mohandamged70m@gmail.com",
  cvUrl: "/cv.pdf",
  socials: {
    github: "https://github.com/mohandamged70m",
    linkedin: "https://www.linkedin.com/in/mohandamged",
    youtube: "https://www.youtube.com/@mohand.darwish",
    x: "https://x.com/mohand_darwish",
  },
} as const;

/** Ordered, labelled profile list. Drives nav, About, footer and `sameAs`. */
export const PROFILES = [
  { label: "GitHub", handle: "mohandamged70m", url: ME.socials.github },
  { label: "LinkedIn", handle: "mohandamged", url: ME.socials.linkedin },
  { label: "YouTube", handle: "@mohand.darwish", url: ME.socials.youtube },
  { label: "X", handle: "mohand_darwish", url: ME.socials.x },
] as const;

/** Flat list of profile URLs for schema.org `sameAs`. */
export const SAME_AS: readonly string[] = PROFILES.map((p) => p.url);

/**
 * `knowsAbout` for the Person entity and llms.txt. Kept factual and concrete:
 * these are the terms an answer engine would need to decide this profile is
 * relevant to a query.
 */
export const KNOWS_ABOUT = [
  "Next.js",
  "React",
  "TypeScript",
  "JavaScript",
  "Node.js",
  "Full-Stack Development",
  "Frontend Engineering",
  "AI Product Development",
  "Large Language Model Applications",
  "API Development",
  "Design Systems",
  "Web Accessibility",
  "Web Performance",
  "Technical SEO",
  "Structured Data",
] as const;

/** Portrait used for schema.org `image` and og:image fallbacks. */
export const PORTRAIT = {
  src: "/me/mohand-darwish.jpeg",
  width: 704,
  height: 1521,
  alt: "Portrait of Mohand Darwish, software engineer and AI product builder based in Egypt",
} as const;
