import { supabaseServer } from "@/lib/supabase/server";
import {
  mapDashboardDocToProject,
  sortProjects,
  type DashboardProjectRow,
  type Project,
} from "@/Data/projects";

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
  const mapped = rows.map((r) => {
    const id = r.path.slice("Projects/".length);
    return mapDashboardDocToProject(id, r.data ?? {});
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
  return mapDashboardDocToProject(id, (data.data ?? {}) as DashboardProjectRow);
}
