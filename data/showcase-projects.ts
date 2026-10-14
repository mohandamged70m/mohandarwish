import { sortProjects, type Project } from "@/data/projects";

/** Source-backed project entries. Empty: portfolio is now 100% dashboard-driven. */
export const SHOWCASE_PROJECTS: Project[] = [];
export function getShowcaseProject(id: string): Project | null {
  return SHOWCASE_PROJECTS.find((p) => p.id.toLowerCase() === id.toLowerCase()) ?? null;
}
export function withShowcaseProjects(projects: Project[]): Project[] {
  const ids = new Set(projects.map((p) => p.id.toLowerCase()));
  return sortProjects([...projects, ...SHOWCASE_PROJECTS.filter((p) => !ids.has(p.id.toLowerCase()))]);
}
