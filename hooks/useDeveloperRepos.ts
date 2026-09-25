"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "@/lib/dash-db";
import { db } from "@/lib/dash-db";

const GITHUB_USERNAME = "mohandamged70m";

export type DeveloperRepo = {
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  updatedAt: string;
  url: string;
};

export function useDeveloperRepos() {
  const [repos, setRepos] = useState<DeveloperRepo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const unsub = onSnapshot(
      doc(db, "Settings", "Developer"),
      async (snap) => {
        const names: string[] = snap.exists()
          ? (snap.data().featuredRepos as string[] | undefined) ?? []
          : [];
        if (!names.length) {
          if (!cancelled) {
            setRepos([]);
            setLoading(false);
          }
          return;
        }
        if (!cancelled) setLoading(true);
        try {
          // Same-origin proxy: server-side GitHub fetch with shared cache,
          // so the dashboard never hits api.github.com rate limits directly.
          const res = await fetch(
            `/api/github/repos?names=${names.map(encodeURIComponent).join(",")}`
          );
          if (!res.ok) throw new Error(`GitHub proxy error (${res.status})`);
          const items = (await res.json()) as Array<{
            name: string;
            description: string | null;
            language: string | null;
            stargazers_count: number;
            forks_count: number;
            updated_at?: string;
            html_url: string;
          }>;
          const byName = new Map(
            items.map((j) => [j.name.toLowerCase(), j])
          );
          const results: DeveloperRepo[] = names.map((name) => {
            const j = byName.get(name.toLowerCase());
            if (!j) {
              return {
                name,
                description: null,
                language: null,
                stars: 0,
                forks: 0,
                updatedAt: "",
                url: `https://github.com/${GITHUB_USERNAME}/${name}`,
              } satisfies DeveloperRepo;
            }
            return {
              name: j.name ?? name,
              description: j.description ?? null,
              language: j.language ?? null,
              stars: j.stargazers_count ?? 0,
              forks: j.forks_count ?? 0,
              updatedAt: j.updated_at ?? "",
              url: j.html_url ?? `https://github.com/${GITHUB_USERNAME}/${name}`,
            } satisfies DeveloperRepo;
          });
          if (cancelled) return;
          // keep dashboard order
          const order = new Map(names.map((n, i) => [n.toLowerCase(), i]));
          results.sort(
            (a, b) =>
              (order.get(a.name.toLowerCase()) ?? 99) -
              (order.get(b.name.toLowerCase()) ?? 99)
          );
          setRepos(results);
        } catch {
          // Proxy failed (rate-limit/offline): show placeholder entries so
          // the dashboard still lists the chosen names instead of empty.
          if (!cancelled) {
            setRepos(
              names.map(
                (name) =>
                  ({
                    name,
                    description: null,
                    language: null,
                    stars: 0,
                    forks: 0,
                    updatedAt: "",
                    url: `https://github.com/${GITHUB_USERNAME}/${name}`,
                  }) satisfies DeveloperRepo,
              ),
            );
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      },
      () => {
        if (!cancelled) setLoading(false);
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return { repos, loading };
}
