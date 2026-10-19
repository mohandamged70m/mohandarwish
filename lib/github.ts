export const GITHUB_USERNAME = "mohandamged70m";

function authHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN ?? "";
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "portfolio-app",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

type CacheEntry = { data: unknown; expiresAt: number };

// Module-level in-memory cache. Survives across requests in the same
// server instance (dev + long-lived prod). 1 hour TTL cuts
// GitHub API calls: every visitor shares one cached response instead of
// each browser hitting api.github.com (60 req/hr unauthenticated limit).
const cache = new Map<string, CacheEntry>();
// 15 minutes: short enough that a fresh commit or a recovered token shows
// up quickly (stale zeros haunted the UI for an hour before), long enough
// that all visitors share a handful of GitHub calls per hour.
const TTL_MS = 15 * 60 * 1000;

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached(key: string, data: unknown, ttlMs = TTL_MS) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export async function githubFetch(path: string, init?: RequestInit) {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
    next: { revalidate: 3600 },
  });
}

export interface GitHubProfile {
  followers: number;
  publicRepos: number;
}

export interface GitHubRepo {
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

export async function fetchGitHubProfile(): Promise<GitHubProfile | null> {
  try {
    const res = await githubFetch(`/users/${GITHUB_USERNAME}`);
    if (!res.ok) return null;
    const user = await res.json();
    return {
      followers: typeof user.followers === "number" ? user.followers : 0,
      publicRepos: typeof user.public_repos === "number" ? user.public_repos : 0,
    };
  } catch {
    return null;
  }
}

export async function fetchAllGitHubRepos(): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  for (let page = 1; ; page++) {
    const res = await githubFetch(
      `/users/${GITHUB_USERNAME}/repos?per_page=100&type=owner&page=${page}`,
    );
    if (!res.ok) throw new Error(`GitHub repos page ${page}: ${res.status}`);
    const batch = await res.json();
    if (!Array.isArray(batch)) throw new Error("GitHub repos response malformed");
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos;
}

/** One day of GitHub's contribution calendar, passed through verbatim from
 *  the GraphQL response. Nothing here is recomputed or re-bucketed, so the
 *  counts, dates and level (shade) match github.com exactly. */
export interface ContributionDay {
  date: string;
  contributionCount: number;
  contributionLevel?: string;
}

/** GitHub's own week grouping (`contributionCalendar.weeks`). Columns are
 *  Sunday-first; the last column is usually short because the rolling window
 *  ends on "today". */
export interface ContributionCalendar {
  totalContributions: number;
  weeks: ContributionDay[][];
}

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
}

/** GitHub returns each day's level as a quartile *of the queried window*, so
 *  the value already answers "which of the 5 shades" for exactly the range we
 *  asked for. It maps onto the site's own `--commits-l0..l4` wine tokens
 *  (app/globals.css) — GitHub's green is deliberately not used. */
export const CONTRIBUTION_LEVELS: Record<string, 0 | 1 | 2 | 3 | 4> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

/** Day of week (0 = Sunday) for a `YYYY-MM-DD` key, computed in UTC so the
 *  answer never depends on the server's or the visitor's timezone.
 *  `new Date("2026-01-01").getDay()` is the classic bug here: it parses as UTC
 *  midnight, so readers west of UTC get Wednesday for a Thursday. */
export function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The exact window github.com's profile calendar covers: one year back from
 *  now (the GraphQL API rejects ranges longer than a year). GitHub snaps the
 *  start forward to a Sunday itself, so we send plain instants and let it
 *  decide the grid — that keeps us in lockstep with the profile page. */
export function contributionWindow(now: Date = new Date()): { from: string; to: string } {
  const from = new Date(now);
  from.setUTCFullYear(from.getUTCFullYear() - 1);
  return { from: from.toISOString(), to: now.toISOString() };
}

/** Local YYYY-MM-DD for `d`. GitHub buckets a contribution under the commit's
 *  local calendar date (not UTC) — verified: a 00:20 +0300 commit lands on
 *  that local date even though it is still "yesterday" in UTC. Streak math
 *  must therefore use viewer-local days, matching github.com's per-viewer
 *  rendering. */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Calendar day before `key` (YYYY-MM-DD). Noon-anchored so DST transitions
 *  (23/25-hour days) can never skip or repeat a date. */
function prevDateKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12);
  dt.setDate(dt.getDate() - 1);
  return toDateKey(dt);
}

export function computeStreakStats(days: ContributionDay[], todayKey: string = toDateKey(new Date())): StreakStats {
  const active = new Set<string>();
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  for (const d of sorted) if (d.contributionCount > 0) active.add(d.date);

  let start = todayKey;
  if (!active.has(start)) {
    // If today has 0 contributions but yesterday has some, the streak is
    // still alive — start counting from yesterday.
    start = prevDateKey(start);
  }

  let currentStreak = 0;
  let cursor = start;
  while (active.has(cursor)) {
    currentStreak++;
    cursor = prevDateKey(cursor);
  }

  let longestStreak = 0;
  let running = 0;
  for (const d of sorted) {
    if (d.contributionCount > 0) {
      running++;
      longestStreak = Math.max(longestStreak, running);
    } else {
      running = 0;
    }
  }

  return { currentStreak, longestStreak };
}

const CONTRIBUTION_CALENDAR_QUERY = `
  query($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              contributionLevel
              weekday
            }
          }
        }
      }
    }
  }
`;

/** Fetch GitHub's contribution calendar for an explicit window. Server-only:
 *  the request carries GITHUB_TOKEN and the response is a plain passthrough of
 *  GitHub's own day list (no re-bucketing, no local-timezone math).
 *
 *  `revalidate: 3600` puts every visitor behind one shared upstream call per
 *  hour, which keeps the free-tier quota and GitHub's rate limit comfortable. */
export async function fetchContributionCalendarRange(
  from: string,
  to: string,
): Promise<ContributionCalendar | null> {
  const token = process.env.GITHUB_TOKEN ?? "";
  if (!token) return null;
  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        query: CONTRIBUTION_CALENDAR_QUERY,
        variables: { login: GITHUB_USERNAME, from, to },
      }),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const calendar = json?.data?.user?.contributionsCollection?.contributionCalendar;
    if (!calendar || !Array.isArray(calendar.weeks)) return null;

    const weeks: ContributionDay[][] = [];
    for (const week of calendar.weeks) {
      const days: ContributionDay[] = [];
      for (const day of week?.contributionDays ?? []) {
        if (typeof day?.date !== "string") continue;
        days.push({
          date: day.date,
          contributionCount: typeof day.contributionCount === "number" ? day.contributionCount : 0,
          contributionLevel: typeof day.contributionLevel === "string" ? day.contributionLevel : undefined,
        });
      }
      if (days.length > 0) weeks.push(days);
    }
    if (weeks.length === 0) return null;

    return {
      totalContributions:
        typeof calendar.totalContributions === "number" ? calendar.totalContributions : 0,
      weeks,
    };
  } catch {
    return null;
  }
}

/** Flat, date-ordered day list for the rolling year. Used by the stats route,
 *  which only needs the streak. */
export async function fetchContributionCalendar(): Promise<ContributionDay[] | null> {
  const { from, to } = contributionWindow();
  const calendar = await fetchContributionCalendarRange(from, to);
  if (!calendar) return null;
  return calendar.weeks.flat();
}

/** A layout-ready calendar cell. `date` and `count` are GitHub's values. */
export interface ContributionCell {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface ContributionCalendarPayload {
  login: string;
  /** The instants actually queried (UTC). */
  range: { from: string; to: string };
  /** GitHub's own total for the window — never re-added from the cells. */
  totalContributions: number;
  /** Sunday-first columns, each padded to 7 slots with `null`. */
  weeks: (ContributionCell | null)[][];
  currentStreak: number;
  longestStreak: number;
  fetchedAt: number;
}

/** Turn GitHub's weeks into fixed-height columns so the client never has to do
 *  date arithmetic to lay the grid out. */
export function buildContributionWeeks(
  weeks: ContributionDay[][],
): (ContributionCell | null)[][] {
  let first = true;
  return weeks
    .filter((week) => week.length > 0)
    .map((week) => {
      const cells: (ContributionCell | null)[] = week.map((day) => ({
        date: day.date,
        count: day.contributionCount,
        level: CONTRIBUTION_LEVELS[day.contributionLevel ?? "NONE"] ?? 0,
      }));
      // A short opening week means the window began mid-week: pad the top of
      // the column instead of letting every later row shift by a day.
      if (first) {
        first = false;
        for (let i = 0; i < weekdayOf(week[0].date); i++) cells.unshift(null);
      }
      while (cells.length < 7) cells.push(null);
      return cells.slice(0, 7);
    });
}

export function buildContributionPayload(
  calendar: ContributionCalendar,
  range: { from: string; to: string },
): Omit<ContributionCalendarPayload, "currentStreak" | "longestStreak" | "fetchedAt"> {
  return {
    login: GITHUB_USERNAME,
    range,
    totalContributions: calendar.totalContributions,
    weeks: buildContributionWeeks(calendar.weeks),
  };
}

export interface GitHubStatsPayload {
  followers: number;
  totalStars: number;
  forksReceived: number;
  forkedRepos: number;
  repoCount: number;
  currentStreak: number;
  longestStreak: number;
  // False when the contribution calendar failed to load: streak numbers are
  // unknown, not zero. Clients must render "unavailable", never "0 days".
  contributionsOk: boolean;
  fetchedAt: number;
}

export function computeGitHubStats(
  profile: GitHubProfile | null,
  repos: GitHubRepo[],
  contributionDays: ContributionDay[] | null,
  todayKey?: string,
): GitHubStatsPayload {
  const safeRepos = Array.isArray(repos) ? repos : [];
  const forkedRepos = safeRepos.filter((r) => r.fork === true).length;
  const forksReceived = safeRepos.reduce((sum, r) => sum + (typeof r.forks_count === "number" ? r.forks_count : 0), 0);
  const totalStars = safeRepos.reduce((sum, r) => sum + (typeof r.stargazers_count === "number" ? r.stargazers_count : 0), 0);
  const streaks = contributionDays
    ? computeStreakStats(contributionDays, todayKey ?? toDateKey(new Date()))
    : { currentStreak: 0, longestStreak: 0 };
  return {
    followers: profile?.followers ?? 0,
    totalStars,
    forksReceived,
    forkedRepos,
    repoCount: safeRepos.length,
    currentStreak: streaks.currentStreak,
    longestStreak: streaks.longestStreak,
    contributionsOk: contributionDays !== null,
    fetchedAt: Date.now(),
  };
}

