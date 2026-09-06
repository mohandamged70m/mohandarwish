import { supabaseServer } from "@/lib/supabase/server";
import {
  mapDashboardDocToProject,
  sortProjects,
  type ContributorDirectory,
  type DashboardProjectRow,
  type Project,
  type TagDirectory,
} from "@/Data/projects";

async function getDirectories(): Promise<{ tags?: TagDirectory; contributors?: ContributorDirectory }> {
  const supabase = supabaseServer();
  const { data } = await supabase
    .from("dashboard_docs")
    .select("path,data")
    .in("path", ["Tags/Tags", "Tags/Contributors"]);
  let tags: TagDirectory | undefined;
  let contributors: ContributorDirectory | undefined;
  for (const row of (data ?? []) as { path: string; data: Record<string, unknown> }[]) {
    if (row.path === "Tags/Tags") tags = (row.data ?? {}) as TagDirectory;
    if (row.path === "Tags/Contributors") contributors = (row.data ?? {}) as ContributorDirectory;
  }
  return { tags, contributors };
}

export async function getProjectsServer(): Promise<Project[]> {
  const supabase = supabaseServer();
  // Paginate defensively; portfolios stay small.
  const rows: { path: string; data: DashboardProjectRow }[] = [];
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("dashboard_docs")
      .select("path,data")
      .like("path", "Projects/%")
      .range(from, from + page - 1);
    if (error) throw error;
    const batch = (data ?? []) as { path: string; data: DashboardProjectRow }[];
    for (const r of batch) {
      const rest = r.path.slice("Projects/".length);
      if (rest && !rest.includes("/")) rows.push(r);
    }
    if (batch.length < page) break;
    from += page;
  }
  const dirs = await getDirectories();
  const mapped = rows.map((r) => {
    const id = r.path.slice("Projects/".length);
    return mapDashboardDocToProject(id, r.data ?? {}, dirs);
  });
  return sortProjects(mapped);
}

export async function getProjectServer(id: string): Promise<Project | null> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("dashboard_docs")
    .select("data")
    .eq("path", `Projects/${id}`)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const dirs = await getDirectories();
  return mapDashboardDocToProject(id, (data.data ?? {}) as DashboardProjectRow, dirs);
}
