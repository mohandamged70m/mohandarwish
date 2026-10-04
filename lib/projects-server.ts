import { convexQuery } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import {
  mapDashboardDocToProject,
  sortProjects,
  type ContributorDirectory,
  type DashboardProjectRow,
  type Project,
  type TagDirectory,
} from "@/data/projects";

async function getDirectories(): Promise<{ tags?: TagDirectory; contributors?: ContributorDirectory }> {
  const rows =
    (await convexQuery<{ path: string; data: Record<string, unknown> }[]>(api.docs.getDocsByPaths, {
      paths: ["Tags/Tags", "Tags/Contributors"],
    })) ?? [];
  let tags: TagDirectory | undefined;
  let contributors: ContributorDirectory | undefined;
  for (const row of rows) {
    if (row.path === "Tags/Tags") tags = (row.data ?? {}) as TagDirectory;
    if (row.path === "Tags/Contributors") contributors = (row.data ?? {}) as ContributorDirectory;
  }
  return { tags, contributors };
}

export async function getProjectsServer(): Promise<Project[]> {
  const rows =
    (await convexQuery<{ path: string; data: DashboardProjectRow }[]>(api.docs.listCollection, {
      prefix: "Projects",
    })) ?? [];
  const dirs = await getDirectories();
  const mapped = rows.map((r) => {
    const id = r.path.slice("Projects/".length);
    return mapDashboardDocToProject(id, r.data ?? {}, dirs);
  });
  return sortProjects(mapped);
}

export async function getProjectServer(id: string): Promise<Project | null> {
  const data = await convexQuery<Record<string, unknown> | null>(api.docs.getDoc, {
    path: `Projects/${id}`,
  });
  if (!data) return null;
  const dirs = await getDirectories();
  return mapDashboardDocToProject(id, data as DashboardProjectRow, dirs);
}
