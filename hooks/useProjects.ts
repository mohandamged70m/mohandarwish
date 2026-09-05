"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "@/lib/dash-db";
import { db } from "@/lib/dash-db";
import {
  mapDashboardDocToProject,
  sortProjects,
  type DashboardProjectRow,
  type Project,
} from "@/Data/projects";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "Projects"),
      (snap) => {
        try {
          const mapped = snap.docs.map((d) =>
            mapDashboardDocToProject(d.id, (d.data() ?? {}) as DashboardProjectRow)
          );
          setProjects(sortProjects(mapped));
          setError(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to load projects");
        } finally {
          setLoading(false);
        }
      },
      (e) => {
        setError(e?.message ?? "Failed to load projects");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return { projects, loading, error };
}
