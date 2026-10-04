/**
 * Single source of truth for the Q&A brief served to AI answer engines.
 *
 * Consumed by the `/llms.txt` and `/llms-full.txt` route handlers. There is
 * deliberately no matching section in the page UI and no FAQPage JSON-LD:
 * structured data has to correspond to content a visitor can actually see, and
 * emitting FAQPage markup for questions that appear nowhere on the site is a
 * Google policy violation, not a shortcut.
 *
 * GEO rules applied to every answer:
 *  - 1-2 sentences, self-contained, no pronouns pointing at other answers.
 *  - The subject is named in every answer ("Mohand Darwish is…") so an answer
 *    engine can quote a single answer without the surrounding page.
 *  - No marketing adjectives, no hedging, no first-person filler.
 */
import { ME, PROFILES } from "./me";

/** "GitHub (github.com/mohandamged70m), LinkedIn (…)" — built from PROFILES. */
const PROFILE_SENTENCE = PROFILES.map(
  (p) => `${p.label} (${p.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")})`
).join(", ");

export type FaqItem = {
  question: string;
  answer: string;
};

export const FAQS: readonly FaqItem[] = [
  {
    question: `Who is ${ME.name}?`,
    answer: `${ME.name} is a software engineer and AI product builder based in ${ME.city}, ${ME.country}, working remotely with teams worldwide on a GMT+2 schedule.`,
  },
  {
    question: `What does ${ME.name} build?`,
    answer: `${ME.name} builds production full-stack web applications, design systems, developer tooling, and AI-assisted product features using Next.js, TypeScript, and Node.js. Every project on this site ships with a live demo, public source code, and written build notes.`,
  },
  {
    question: `What is ${ME.name}'s tech stack?`,
    answer: `The core stack is Next.js with the App Router, React, TypeScript, and Node.js, styled with Tailwind CSS and deployed on Vercel. Supporting work includes Convex, API design, schema.org structured data, web performance, and WCAG-oriented accessibility.`,
  },
  {
    question: `Is ${ME.name} available for freelance work or full-time roles?`,
    answer: `Yes. ${ME.name} is currently ${ME.availability.toLowerCase()} and takes on remote contract work, fractional product work, and full-time engineering roles for teams that need a frontend-leaning full-stack engineer.`,
  },
  {
    question: `How do I contact ${ME.name}?`,
    answer: `The fastest route is the booking form on this site, which confirms a call slot directly. You can also email ${ME.email} directly, or reach ${ME.name} on ${PROFILE_SENTENCE}.`,
  },
];
