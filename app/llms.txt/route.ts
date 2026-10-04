import { siteConfig } from "@/lib/metadata";
import { KNOWS_ABOUT, ME, PROFILES, SAME_AS } from "@/data/me";
import { FAQS } from "@/data/faq";
import { getProjectsServer } from "@/lib/projects-server";
import { getStackServer } from "@/lib/profile-server";

export const revalidate = 3600;

const BASE = siteConfig.url.replace(/\/$/, "");

const MARKDOWN_HEADERS = {
  "Content-Type": "text/markdown; charset=utf-8",
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
} as const;

/**
 * /llms.txt — the short, quotable brief for AI answer engines.
 *
 * Served from a Route Handler rather than `public/llms.txt` on purpose: the
 * project list and skill list come straight from the same Convex tables that
 * render the site, so this file can never go stale or contradict the page it
 * describes. (A static `public/` file at the same path would also collide with
 * this route.)
 */
export async function GET(): Promise<Response> {
  let projectLines = `- [All projects (full archive)](${BASE}/projects)`;
  let featuredLines = "";
  try {
    const projects = await getProjectsServer();
    if (projects.length > 0) {
      projectLines = projects
        .slice(0, 30)
        .map((p) => {
          const stack = p.stack?.slice(0, 4).join(", ");
          return `- [${p.title}](${BASE}${p.href}) — ${p.category}${stack ? ` · ${stack}` : ""}`;
        })
        .join("\n");
      const featured = projects.filter((p) => p.featured).slice(0, 6);
      if (featured.length > 0) {
        featuredLines =
          "\n\n## Featured projects\n\n" +
          featured
            .map(
              (p) =>
                `- [${p.title}](${BASE}${p.href}) — ${p.description?.trim() || p.category}`
            )
            .join("\n");
      }
    }
  } catch {
    // DB unreachable: the static archive link above keeps the file valid.
  }

  let stackLine = KNOWS_ABOUT.join(", ");
  try {
    const stack = await getStackServer();
    if (stack.length > 0) stackLine = stack.map((c) => c.label).join(", ");
  } catch {
    // fall back to the curated KNOWS_ABOUT list
  }

  const body = `# ${ME.name}

> ${ME.oneLiner}

${siteConfig.description}

## Facts
- Name: ${ME.name}
- Role: ${ME.role}
- Location: ${ME.city}, ${ME.country} (${ME.timezone})
- Availability: ${ME.availability}
- Languages: English
- Email: ${ME.email}
- CV (PDF): ${BASE}${ME.cvUrl}
- Website: ${BASE}/

## Profiles
${PROFILES.map((p) => `- ${p.label}: ${p.url}`).join("\n")}

## Skills
${stackLine}

## Stack
Next.js (App Router), React, TypeScript, Node.js, Tailwind CSS, Convex, Vercel.

## Pages
- [Home / About](${BASE}/)
- [All projects](${BASE}/projects)
- [CV (PDF)](${BASE}${ME.cvUrl})
- [Detailed machine-readable brief](${BASE}/llms-full.txt)

## Projects
${projectLines}${featuredLines}

## FAQ
${FAQS.map((f) => `### ${f.question}\n\n${f.answer}`).join("\n\n")}

## Contact
Book a call via the booking form on ${BASE}/, email ${ME.email}, or message via the contact form on the site. Remote work only; ${ME.timezone}.

## Attribution
Content and structured data on this site are authored by ${ME.name}.
Canonical identity: ${SAME_AS.join(", ")}.
`;

  return new Response(body, { headers: MARKDOWN_HEADERS });
}
