import { NextResponse } from "next/server";
import {
  getCached,
  setCached,
  fetchGitHubProfile,
  fetchAllGitHubRepos,
  fetchContributionCalendar,
  computeGitHubStats,
} from "@/lib/github";

export const revalidate = 900; // 15 min ISR (matches the server cache TTL)

// GET /api/github/stats — aggregated overview for the Developer section.
// Server-side fetch = one shared cached response for all visitors instead
// of every browser calling api.github.com (unauthenticated limit is only
// 60 req/hr per IP, which is what caused the 403s).
export async function GET(req: Request) {
  // Viewer-local "today" (YYYY-MM-DD): the server may run in UTC while the
  // visitor is in UTC+N, and the streak must be counted for the visitor's
  // day — same date GitHub buckets the commits under. Falls back to the
  // server's local day when absent/invalid. Part of the cache key so a
  // payload computed for one date is never served as another date's streak.
  const url = new URL(req.url);
  const todayParam = url.searchParams.get("today");
  const todayKey = /^\d{4}-\d{2}-\d{2}$/.test(todayParam ?? "") ? (todayParam as string) : undefined;
  const CACHE_KEY = `gh:stats:v3:${todayKey ?? "server"}`;

  try {
    const cached = getCached(CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
          "X-Cache": "HIT",
        },
      });
    }

    const [profile, repos, contributionDays] = await Promise.all([
      fetchGitHubProfile(),
      fetchAllGitHubRepos(),
      fetchContributionCalendar(),
    ]);

    const payload = computeGitHubStats(profile, repos, contributionDays, todayKey);
    setCached(CACHE_KEY, payload);

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
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
