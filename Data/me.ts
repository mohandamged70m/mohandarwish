export const ME = {
  name: "Mohand Darwish",
  role: "Software Engineer",
  tagline: "Software Engineer — Next.js / TypeScript / Node.js",
  location: "Cairo, Egypt",
  email: "mohand.darwish@example.com",
  // Update these to real URLs when available
  socials: {
    linkedin: "https://www.linkedin.com/in/mohand-darwish",
    github: "https://github.com/mohand-darwish",
    x: "https://x.com/mohand_darwish",
  },
} as const;

export const CONTACT = {
  email: ME.email,
  linkedin: ME.socials.linkedin,
  github: ME.socials.github,
  x: ME.socials.x,
} as const;

export const SITE_META = {
  title: "Mohand Darwish | Software Engineer",
  description:
    "Personal website and portfolio of Mohand Darwish, a software engineer focused on clean architecture, performant web apps, and delightful UX.",
} as const;
