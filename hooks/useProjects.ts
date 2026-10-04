"use client";

import { useEffect, useState } from "react";
import {
  mapDashboardDocToProject,
  sortProjects,
  type ContributorDirectory,
  type DashboardProjectRow,
  type Project,
  type TagDirectory,
} from "@/data/projects";

// Live Firestore-style subscriptions, but the Convex transport
// (@/lib/dash-db) is imported lazily inside
// the effects so it never lands in the initial bundle or blocks TTI.
// Pass server-rendered `initial` (see getProjectsServer) for instant
// first paint; the subscriptions still attach ~after mount and keep the
// page live exactly as before.
export function useProjects(initial?: Project[]) {
  const [projects, setProjects] = useState<Project[]>(initial ?? []);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const [tagDir, setTagDir] = useState<TagDirectory | undefined>(undefined);
  const [contribDir, setContribDir] = useState<ContributorDirectory | undefined>(undefined);
  const [rows, setRows] = useState<{ id: string; data: DashboardProjectRow }[]>([]);
  const [hasLive, setHasLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const unsubs: Array<() => void> = [];
    void (async () => {
      const { doc, onSnapshot, db } = await import("@/lib/dash-db");
      if (cancelled) return;
      unsubs.push(
        onSnapshot(
          doc(db, "Tags", "Tags"),
          (snap) => {
            if (snap.exists()) setTagDir(snap.data() as TagDirectory);
          },
          () => {},
        ),
        onSnapshot(
          doc(db, "Tags", "Contributors"),
          (snap) => {
            if (snap.exists()) setContribDir(snap.data() as ContributorDirectory);
          },
          () => {},
        ),
      );
    })();
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    void (async () => {
      const { collection, onSnapshot, db } = await import("@/lib/dash-db");
      if (cancelled) return;
      unsub = onSnapshot(
        collection(db, "Projects"),
        (snap) => {
          try {
            setRows(snap.docs.map((d) => ({ id: d.id, data: (d.data() ?? {}) as DashboardProjectRow })));
            setHasLive(true);
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
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  useEffect(() => {
    // Before the first live snapshot, keep server-provided `initial`
    // (or the loading state when there is none) untouched.
    if (!hasLive) return;
    try {
      const mapped = rows.map((r) => mapDashboardDocToProject(r.id, r.data, { tags: tagDir, contributors: contribDir }));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjects(sortProjects(mapped));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [rows, tagDir, contribDir, hasLive]);

  return { projects, loading, error };
}
