import { NextResponse } from "next/server";
import {
  GITHUB_USERNAME,
  getCached,
  setCached,
  githubFetch,
} from "@/lib/github";

export const revalidate = 1800; // 30 min ISR

interface GhRepoMini {
  stargazers_count: number;
  forks_count: number;
  fork: boolean;
}

// GET /api/github/stats — aggregated overview for the Developer section.
// Server-side fetch = one shared cached response for all visitors instead
// of every browser calling api.github.com (unauthenticated limit is only
// 60 req/hr per IP, which is what caused the 403s).
export async function GET() {
  const CACHE_KEY = "gh:stats";

  try {
    const cached = getCached(CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
          "X-Cache": "HIT",
        },
      });
    }

    const [userRes, reposRes] = await Promise.all([
      githubFetch(`/users/${GITHUB_USERNAME}`),
      githubFetch(`/users/${GITHUB_USERNAME}/repos?per_page=100`),
    ]);

    // Surface GitHub rate-limiting as 429 so the client can show a
    // proper message instead of hanging on a skeleton forever.
    if (userRes.status === 403 || reposRes.status === 403) {
      return NextResponse.json(
        { error: "GitHub API rate limit exceeded. Try again shortly." },
        {
          status: 429,
          headers: { "Cache-Control": "public, s-maxage=60" },
        },
      );
    }
    if (userRes.status === 404 || reposRes.status === 404) {
      return NextResponse.json(
        { error: `GitHub user "@${GITHUB_USERNAME}" not found.` },
        { status: 404 },
      );
    }
    if (!userRes.ok || !reposRes.ok) {
      return NextResponse.json(
        { error: `GitHub API error (${userRes.status}/${reposRes.status}).` },
        { status: 502 },
      );
    }

    const user = await userRes.json();
    const repos: GhRepoMini[] = await reposRes.json();

    const ownRepos = Array.isArray(repos)
      ? repos.filter((r) => !r.fork)
      : [];
    const payload = {
      followers: user.followers ?? 0,
      totalStars: ownRepos.reduce((s, r) => s + (r.stargazers_count ?? 0), 0),
      totalForks: ownRepos.reduce((s, r) => s + (r.forks_count ?? 0), 0),
      repoCount: ownRepos.length,
    };

    setCached(CACHE_KEY, payload);

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        "X-Cache": "MISS",
      },
    });
  } catch (e) {
    // Network/timeout — let the client fall back to its localStorage cache.
    const cached = getCached(CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "X-Cache": "STALE" },
      });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load GitHub stats." },
      { status: 502 },
    );
  }
}
