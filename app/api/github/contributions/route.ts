import { NextResponse } from "next/server";
import {
  fetchContributionCalendar,
  computeStreakStats,
  getCached,
  setCached,
} from "@/lib/github";

export const revalidate = 3600; // 1 hour ISR

const LEVEL_BY_API: Record<string, number> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

// GET /api/github/contributions — real contribution calendar via GitHub GraphQL.
// Server-side only; GITHUB_TOKEN never reaches the browser.
export async function GET() {
  const CACHE_KEY = "gh:contributions:v3";
  try {
    const cached = getCached(CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200", "X-Cache": "HIT" },
      });
    }

    const days = await fetchContributionCalendar();
    if (!days) {
      return NextResponse.json({ error: "GitHub contributions unavailable." }, { status: 502 });
    }

    const contributions = days.map((d) => ({
      date: d.date,
      count: d.contributionCount,
      level: LEVEL_BY_API[d.contributionLevel ?? "NONE"] ?? 0,
    }));
    const total: Record<string, number> = {};
    for (const d of days) {
      const y = d.date.slice(0, 4);
      total[y] = (total[y] ?? 0) + d.contributionCount;
    }

    const payload = {
      contributions,
      total,
      ...computeStreakStats(days),
    };
    setCached(CACHE_KEY, payload);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200", "X-Cache": "MISS" },
    });
  } catch (e) {
    const cached = getCached(CACHE_KEY);
    if (cached) return NextResponse.json(cached, { headers: { "X-Cache": "STALE" } });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load GitHub contributions." },
      { status: 502 },
    );
  }
}
