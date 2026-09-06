"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "@/lib/dash-db";
import { db } from "@/lib/dash-db";
import {
  mapDashboardDocToProject,
  sortProjects,
  type ContributorDirectory,
  type DashboardProjectRow,
  type Project,
  type TagDirectory,
} from "@/Data/projects";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tagDir, setTagDir] = useState<TagDirectory | undefined>(undefined);
  const [contribDir, setContribDir] = useState<ContributorDirectory | undefined>(undefined);
  const [rows, setRows] = useState<{ id: string; data: DashboardProjectRow }[]>([]);

  useEffect(() => {
    const unsubTags = onSnapshot(
      doc(db, "Tags", "Tags"),
      (snap) => {
        if (snap.exists()) setTagDir(snap.data() as TagDirectory);
      },
      () => {},
    );
    const unsubContrib = onSnapshot(
      doc(db, "Tags", "Contributors"),
      (snap) => {
        if (snap.exists()) setContribDir(snap.data() as ContributorDirectory);
      },
      () => {},
    );
    return () => {
      unsubTags();
      unsubContrib();
    };
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "Projects"),
      (snap) => {
        try {
          setRows(snap.docs.map((d) => ({ id: d.id, data: (d.data() ?? {}) as DashboardProjectRow })));
          setError(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to load projects");
        }
      },
      (e) => {
        setError(e?.message ?? "Failed to load projects");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    try {
      const mapped = rows.map((r) => mapDashboardDocToProject(r.id, r.data, { tags: tagDir, contributors: contribDir }));
      setProjects(sortProjects(mapped));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [rows, tagDir, contribDir]);

  return { projects, loading, error };
}
