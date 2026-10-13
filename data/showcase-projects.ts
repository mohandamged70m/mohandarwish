import { mapDashboardDocToProject, sortProjects, type DashboardProjectRow, type Project } from "@/data/projects";

/** Source-backed project entries. A matching dashboard record takes precedence. */
const tarteeb: DashboardProjectRow = {
  Description: "An AI-assisted workspace for freelancers that turns pasted client messages into editable orders and actionable checklists. Review the scope, clarify missing details, and confirm before any order is created.",
  Problem: "Client requests arrive across WhatsApp, email, and DMs. Missing details and scattered task lists make it easy to lose track of the agreed scope.",
  Role: "Product design and full-stack engineering: intake workflow, authentication, data model, AI integration, order lifecycle, and deployment preparation.",
  Highlights: [
    "A conversational intake that asks for missing requirements before confirmation.",
    "Editable proposals with explicit and suggested tasks kept distinct.",
    "Client records, searchable orders, task progress, and activity history in one workspace.",
    "Encrypted user-supplied AI keys and a clearly labeled offline assistant.",
    "English and Egyptian Arabic requests with timezone-aware deadlines.",
  ],
  "Repository Link": "https://github.com/mohandamged70m/Tarteeb",
  "Live Link": "https://tarteeb-indol.vercel.app",
  "Project Icon": "/projects/tarteeb-icon.svg",
  "Project Images": ["/projects/tarteeb-intake.png", "/projects/tarteeb-order.png"],
  Stack: ["Full-Stack", "Next.js", "TypeScript", "React", "Tailwind CSS", "Supabase", "PostgreSQL", "Zod", "Vitest"].map((Name) => ({ Name })),
  Contributors: [{ "Contributor Name": "Mohand Darwish", "Role at Project": "Product builder & full-stack engineer" }],
  Listing: 1,
};

export const SHOWCASE_PROJECTS = [mapDashboardDocToProject("Tarteeb", tarteeb)];
export function getShowcaseProject(id: string): Project | null {
  return SHOWCASE_PROJECTS.find((p) => p.id.toLowerCase() === id.toLowerCase()) ?? null;
}
export function withShowcaseProjects(projects: Project[]): Project[] {
  const ids = new Set(projects.map((p) => p.id.toLowerCase()));
  return sortProjects([...projects, ...SHOWCASE_PROJECTS.filter((p) => !ids.has(p.id.toLowerCase()))]);
}
