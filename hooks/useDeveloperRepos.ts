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
          const results = await Promise.all(
            names.map(async (name) => {
              try {
                const res = await fetch(
                  `https://api.github.com/repos/${GITHUB_USERNAME}/${name}`
                );
                if (!res.ok) {
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
                const j = await res.json();
                return {
                  name: j.name ?? name,
                  description: j.description ?? null,
                  language: j.language ?? null,
                  stars: j.stargazers_count ?? 0,
                  forks: j.forks_count ?? 0,
                  updatedAt: j.updated_at ?? "",
                  url: j.html_url ?? `https://github.com/${GITHUB_USERNAME}/${name}`,
                } satisfies DeveloperRepo;
              } catch {
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
            })
          );
          if (cancelled) return;
          // keep dashboard order
          const order = new Map(names.map((n, i) => [n.toLowerCase(), i]));
          results.sort(
            (a, b) =>
              (order.get(a.name.toLowerCase()) ?? 99) -
              (order.get(b.name.toLowerCase()) ?? 99)
          );
          setRepos(results);
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
