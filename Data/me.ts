export const ME = {
  name: "Mohand Darwish",
  role: "Software Engineer — Full-Stack, Frontend-leaning",
  tagline: "Full-stack engineer leaning frontend: clean architecture, performant web apps, and systems that scale.",
  location: "Alexandria, Egypt",
  availability: "Available for new opportunities",
  timezone: "GMT+2",
  email: "mohandamged70m@gmail.com",
  cvUrl: "/cv.pdf",
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
