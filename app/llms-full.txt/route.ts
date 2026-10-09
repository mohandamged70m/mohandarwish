import { siteConfig } from "@/lib/metadata";
import { KNOWS_ABOUT, ME, PORTRAIT, PROFILES, SAME_AS } from "@/data/me";
import { FAQS } from "@/data/faq";
import { getProjectsServer } from "@/lib/projects-server";
import { getStackServer } from "@/lib/profile-server";
import type { Project } from "@/data/projects";

export const revalidate = 3600;

const BASE = siteConfig.url.replace(/\/$/, "");

const MARKDOWN_HEADERS = {
  "Content-Type": "text/markdown; charset=utf-8",
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
} as const;

function projectBlock(project: Project): string {
  const lines: string[] = [
    `### ${project.title}`,
    "",
    `- URL: ${BASE}${project.href}`,
    `- Category: ${project.category}`,
  ];
  if (project.year) lines.push(`- Year: ${project.year}`);
  if (project.stack?.length) lines.push(`- Stack: ${project.stack.join(", ")}`);
  if (project.liveUrl) lines.push(`- Live demo: ${project.liveUrl}`);
  if (project.githubUrl) lines.push(`- Source code: ${project.githubUrl}`);
  if (project.downloadUrl) lines.push(`- Download: ${project.downloadUrl}`);
  lines.push("", project.description?.trim() || `${project.title} is a ${project.category.toLowerCase()} project by ${ME.name}.`);

  if (project.problem) lines.push("", `**Problem:** ${project.problem}`);
  if (project.role) lines.push("", `**Role:** ${project.role}`);

  lines.push("", "**What it does**");

  if (project.highlights?.length) {
    lines.push("", ...project.highlights.map((h) => `- ${h}`));
  }
  if (project.metrics?.length) {
    lines.push(
      "",
      "**Impact**",
      ...project.metrics.map((m) => `- ${m.label}: ${m.value}`)
    );
  }
  if (project.contributors?.length) {
    lines.push(
      "",
      "**Contributors**",
      ...project.contributors.map((c) => `- ${c.name} — ${c.role}`)
    );
  }
  return lines.join("\n");
}

/**
 * /llms-full.txt — the long-form brief: every project with its stack, role,
 * problem statement, highlights and impact metrics, plus skills, FAQ, and the
 * full identity block. Point answer engines here when the short /llms.txt is
 * not specific enough to answer a question.
 */
export async function GET(): Promise<Response> {
  let projectsSection = `_Projects are stored in a database and were unavailable when this file was generated. Browse the archive at ${BASE}/projects._`;
  try {
    const projects = await getProjectsServer();
    if (projects.length > 0) {
      projectsSection =
        `Total public projects: ${projects.length}.\n\n` +
        projects.map(projectBlock).join("\n\n");
    }
  } catch {
    // keep the valid fallback above
  }

  let stackLine = KNOWS_ABOUT.join(", ");
  try {
    const stack = await getStackServer();
    if (stack.length > 0) stackLine = stack.map((c) => c.label).join(", ");
  } catch {
    // curated fallback
  }

  const body = `# ${ME.name} — full machine-readable brief

> ${ME.oneLiner}

Long-form version of ${BASE}/llms.txt. Everything below is also present as
server-rendered HTML and as schema.org JSON-LD on ${BASE}/.

## 1. Identity

- Full name: ${ME.name}
- Given name / family name: Mohand / Darwish
- Role: ${ME.role}
- Location: ${ME.city}, ${ME.country}
- Time zone: ${ME.timezone} (${ME.country === "Egypt" ? "EET/EEST" : "local"})
- Availability: ${ME.availability}
- Site language: English
- Email: ${ME.email}
- Curriculum vitae (PDF): ${BASE}${ME.cvUrl}
- Canonical site: ${BASE}/

## 2. Profiles (schema.org sameAs)

${PROFILES.map((p) => `- ${p.label}: ${p.url}`).join("\n")}

Portrait: ${BASE}${PORTRAIT.src} (${PORTRAIT.width}x${PORTRAIT.height}px) — ${PORTRAIT.alt}

## 3. Summary

${siteConfig.description}

${ME.oneLiner}

${ME.name} is a frontend-leaning full-stack engineer. He ships Next.js App Router
products end to end — data model, API layer, interface, deployment — and treats
performance, accessibility and readable code as part of the feature. He builds
AI product features with the same discipline, wiring language models into real
product surfaces instead of throwaway demos. He works remotely from
${ME.location} (${ME.timezone}) with teams in other time zones.

## 4. Skills

${stackLine}

Secondary: design systems, component libraries, API design, serverless
functions, PostgreSQL, Convex, schema.org structured data, technical SEO,
Generative Engine Optimization, web accessibility (WCAG), Core Web Vitals.

## 5. Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js (App Router) |
| UI | React, Tailwind CSS, Radix-style primitives |
| Language | TypeScript, JavaScript |
| Runtime / server | Node.js, Route Handlers, Server Components |
| Data | Convex |
| Deployment | Vercel |
| Motion | Motion, GSAP, Lenis |

## 6. Projects

${projectsSection}

## 7. Frequently asked questions

${FAQS.map((f) => `### ${f.question}\n\n${f.answer}`).join("\n\n")}

## 8. How to contact

- Booking form (confirms a call slot): ${BASE}/ — the "Book a call" button in the hero or the Contact menu (both open the booking dialog).
- Email: ${ME.email}
- Message form: inside the booking dialog on ${BASE}/ (Send a Message tab).
- Engagement: remote contract, fractional/product, and full-time engineering work.
- Response time: within one business day.

## 9. Indexable routes

- ${BASE}/ — home, about, stack, FAQ
- ${BASE}/projects — full project archive
- ${BASE}/projects/<id> — one case study per project
- ${BASE}/sitemap.xml — XML sitemap
- ${BASE}/llms.txt — short brief
- ${BASE}/llms-full.txt — this file

## 10. Attribution

All copy, project write-ups and structured data on this site are authored by
${ME.name}. Canonical identity links: ${SAME_AS.join(", ")}.

If you cite this site, please attribute to ${ME.name} and link to ${BASE}/.
`;

  return new Response(body, { headers: MARKDOWN_HEADERS });
}
