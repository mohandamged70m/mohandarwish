import { NextResponse } from "next/server";
import {
  getCached,
  setCached,
  fetchGitHubProfile,
  fetchAllGitHubRepos,
  fetchContributionCalendar,
  computeGitHubStats,
} from "@/lib/github";

export const revalidate = 3600; // 1 hour ISR

// GET /api/github/stats — aggregated overview for the Developer section.
// Server-side fetch = one shared cached response for all visitors instead
// of every browser calling api.github.com (unauthenticated limit is only
// 60 req/hr per IP, which is what caused the 403s).
export async function GET() {
  const CACHE_KEY = "gh:stats:v2";

  try {
    const cached = getCached(CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
          "X-Cache": "HIT",
        },
      });
    }

    const [profile, repos, contributionDays] = await Promise.all([
      fetchGitHubProfile(),
      fetchAllGitHubRepos(),
      fetchContributionCalendar(),
    ]);

    const payload = computeGitHubStats(profile, repos, contributionDays);
    setCached(CACHE_KEY, payload);

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
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
