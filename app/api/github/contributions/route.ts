import { NextResponse } from "next/server";
import {
  buildContributionPayload,
  computeStreakStats,
  contributionWindow,
  fetchContributionCalendarRange,
  getCached,
  setCached,
} from "@/lib/github";

// Data cache for the upstream GraphQL call (one shared call per hour) and the
// ISR window for this response.
export const revalidate = 3600;

const CACHE_KEY = "gh:contributions:v4";

// Long s-maxage + a full day of stale-while-revalidate means Vercel's edge
// keeps answering from cache if GitHub ever errors or rate-limits, so visitors
// never see a broken or empty graph.
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};

/** GET /api/github/contributions — GitHub's own contribution calendar for the
 *  rolling last year, via the GraphQL API (the same source github.com uses).
 *
 *  Server-side only: GITHUB_TOKEN is read here and never reaches the browser.
 *  Needs a PAT with `read:user`; set it in Vercel → Settings → Environment
 *  Variables (and .env.local locally) as GITHUB_TOKEN.
 */
export async function GET() {
  const cached = getCached<unknown>(CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached, { headers: { ...CACHE_HEADERS, "X-Cache": "HIT" } });
  }

  const range = contributionWindow();
  const calendar = await fetchContributionCalendarRange(range.from, range.to);

  if (!calendar) {
    // Nothing cached and GitHub is unreachable: a 502 lets the client fall
    // back to its own last-known-good snapshot, or show its small
    // "couldn't load activity" state. Never a fake zero.
    return NextResponse.json(
      { error: "GitHub contributions unavailable." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  // `weeks` and `totalContributions` come straight from GitHub. The streak is
  // the only derived field; GitHub has no such concept.
  const payload = {
    ...buildContributionPayload(calendar, range),
    ...computeStreakStats(calendar.weeks.flat()),
    fetchedAt: Date.now(),
  };
  setCached(CACHE_KEY, payload);

  return NextResponse.json(payload, { headers: { ...CACHE_HEADERS, "X-Cache": "MISS" } });
}
