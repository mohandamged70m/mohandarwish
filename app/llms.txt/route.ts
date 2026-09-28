import { siteConfig } from "@/lib/metadata";
import { ME } from "@/data/me";
import { getProjectsServer } from "@/lib/projects-server";

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const base = siteConfig.url.replace(/\/$/, "");
  let projectLines = "";
  try {
    const projects = await getProjectsServer();
    projectLines = projects
      .slice(0, 30)
      .map((p) => `- ${p.title} (${p.category}): ${base}${p.href}`)
      .join("\n");
  } catch {
    projectLines = `- Full archive: ${base}/projects`;
  }

  const body = `# ${ME.name}
> ${ME.tagline}

${siteConfig.description}

## Facts
- Name: ${ME.name}
- Role: ${ME.role}
- Location: ${ME.location} · ${ME.timezone}
- Availability: ${ME.availability}
- Email: ${ME.email}
- Website: ${base}
- Profiles: ${ME.socials.github} · ${ME.socials.linkedin} · ${ME.socials.x}

## Expertise
Next.js, React, TypeScript, Node.js, full-stack product development,
design systems, web performance, accessibility.

## Pages
- Home: ${base}/
- All projects: ${base}/projects
- CV: ${base}${ME.cvUrl}

## Selected projects
${projectLines}

## Contact
Book a call via the booking section on the site (${base}/#booking),
message via the contact form, or email ${ME.email} directly.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
