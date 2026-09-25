import { NextResponse } from "next/server";
import {
  GITHUB_USERNAME,
  getCached,
  setCached,
  githubFetch,
} from "@/lib/github";

export const revalidate = 1800; // 30 min ISR

interface GhRepo {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  html_url: string;
  updated_at?: string;
  fork?: boolean;
  archived?: boolean;
}

const pick = (r: GhRepo): GhRepo => ({
  name: r.name,
  description: r.description,
  language: r.language,
  stargazers_count: r.stargazers_count,
  forks_count: r.forks_count,
  html_url: r.html_url,
  updated_at: r.updated_at,
  fork: r.fork,
  archived: r.archived,
});

// GET /api/github/repos?names=a,b,c  — handpicked repos (public Developer page)
// GET /api/github/repos?top=3        — top repos by stars (fallback)
// GET /api/github/repos?all=1        — full list for the dashboard picker
export async function GET(req: Request) {
  const url = new URL(req.url);
  const namesParam = url.searchParams.get("names") ?? "";
  const topParam = url.searchParams.get("top");
  const allParam = url.searchParams.get("all");

  const names = namesParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);

  const cacheKey = names.length
    ? `gh:repos:names:${names.join(",").toLowerCase()}`
    : allParam === "1"
      ? "gh:repos:all"
      : `gh:repos:top:${topParam ?? "3"}`;

  try {
    const cached = getCached<GhRepo[]>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
          "X-Cache": "HIT",
        },
      });
    }

    // Handpicked: fetch each repo individually (preserves dashboard order).
    if (names.length > 0) {
      const results = await Promise.all(
        names.map(async (name) => {
          try {
            const res = await githubFetch(
              `/repos/${GITHUB_USERNAME}/${encodeURIComponent(name)}`,
            );
            if (!res.ok) return null;
            return pick(await res.json());
          } catch {
            return null;
          }
        }),
      );
      // Preserve requested order; drop missing/failed repos.
      const data = results.filter((r): r is GhRepo => r !== null);
      if (data.length > 0) setCached(cacheKey, data);
      return NextResponse.json(data, {
        headers: {
          "Cache-Control":
            "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      });
    }

    // Top-N or full list: single list call.
    const listRes = await githubFetch(
      `/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=100`,
    );

    if (listRes.status === 403) {
      return NextResponse.json(
        { error: "GitHub API rate limit exceeded. Try again shortly." },
        { status: 429, headers: { "Cache-Control": "public, s-maxage=60" } },
      );
    }
    if (listRes.status === 404) {
      return NextResponse.json(
        { error: `GitHub user "@${GITHUB_USERNAME}" not found.` },
        { status: 404 },
      );
    }
    if (!listRes.ok) {
      return NextResponse.json(
        { error: `GitHub API error (${listRes.status}).` },
        { status: 502 },
      );
    }

    const all: GhRepo[] = await listRes.json();

    if (allParam === "1") {
      const data = all
        .map(pick)
        .sort(
          (a, b) =>
            b.stargazers_count - a.stargazers_count ||
            new Date(b.updated_at ?? 0).getTime() -
              new Date(a.updated_at ?? 0).getTime(),
        );
      setCached(cacheKey, data);
      return NextResponse.json(data, {
        headers: {
          "Cache-Control":
            "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      });
    }

    const top = Math.max(
      1,
      Math.min(10, parseInt(topParam ?? "3", 10) || 3),
    );
    const data = all
      .filter((r) => r.name.toLowerCase() !== GITHUB_USERNAME.toLowerCase() && !r.fork && !r.archived)
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, top)
      .map(pick);

    setCached(cacheKey, data);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch (e) {
    const cached = getCached<GhRepo[]>(cacheKey);
    if (cached) return NextResponse.json(cached, { headers: { "X-Cache": "STALE" } });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load GitHub repos." },
      { status: 502 },
    );
  }
}
