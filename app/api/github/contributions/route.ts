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

const CACHE_KEY = "gh:contributions:v5";

// s-maxage is for the shared cache (Vercel's edge holds the payload for an
// hour). max-age=0 + must-revalidate is for the visitor's own cache: it forces
// a cheap 304 revalidation instead of letting a stale copy linger after a
// deploy changes what the calendar means. stale-while-revalidate keeps the edge
// answering from cache if GitHub ever errors, so the graph is never empty.
const CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=0, must-revalidate, s-maxage=3600, stale-while-revalidate=86400",
};

/** GET /api/github/contributions — GitHub's own contribution calendar for the
 *  current calendar year (Jan 1 - Dec 31), via the GraphQL API. GitHub returns
 *  the whole span, so days after today come back as 0 rather than being cut off.
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
