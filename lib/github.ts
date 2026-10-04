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

export function githubHeaders() {
  return authHeaders();
}

export function hasGithubToken(): boolean {
  return !!process.env.GITHUB_TOKEN;
}

type CacheEntry = { data: unknown; expiresAt: number };

// Module-level in-memory cache. Survives across requests in the same
// server instance (dev + long-lived prod). 1 hour TTL cuts
// GitHub API calls: every visitor shares one cached response instead of
// each browser hitting api.github.com (60 req/hr unauthenticated limit).
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000;

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

export interface ContributionDay {
  date: string;
  contributionCount: number;
  contributionLevel?: string;
}

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
}

export function toUtcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function computeStreakStats(days: ContributionDay[]): StreakStats {
  const active = new Set<string>();
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  for (const d of sorted) if (d.contributionCount > 0) active.add(d.date);

  const today = toUtcDateKey(new Date());
  let start = today;
  if (!active.has(start)) {
    // If today has 0 contributions but yesterday has some, the streak is
    // still alive — start counting from yesterday.
    start = toUtcDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  }

  let currentStreak = 0;
  let cursor = start;
  while (active.has(cursor)) {
    currentStreak++;
    cursor = toUtcDateKey(new Date(new Date(cursor + "T00:00:00Z").getTime() - 24 * 60 * 60 * 1000));
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

export async function fetchContributionCalendar(): Promise<ContributionDay[] | null> {
  const token = process.env.GITHUB_TOKEN ?? "";
  if (!token) return null;
  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                contributionLevel
              }
            }
          }
        }
      }
    }
  `;
  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { login: GITHUB_USERNAME } }),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const weeks = json?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
    if (!Array.isArray(weeks)) return null;
    const days: ContributionDay[] = [];
    for (const week of weeks) {
      for (const day of week?.contributionDays ?? []) {
        if (typeof day?.date === "string") {
          days.push({
            date: day.date,
            contributionCount: typeof day.contributionCount === "number" ? day.contributionCount : 0,
            contributionLevel: typeof day.contributionLevel === "string" ? day.contributionLevel : undefined,
          });
        }
      }
    }
    return days.sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return null;
  }
}

export interface GitHubStatsPayload {
  followers: number;
  totalStars: number;
  forksReceived: number;
  forkedRepos: number;
  repoCount: number;
  currentStreak: number;
  longestStreak: number;
}

export function computeGitHubStats(
  profile: GitHubProfile | null,
  repos: GitHubRepo[],
  contributionDays: ContributionDay[] | null,
): GitHubStatsPayload {
  const safeRepos = Array.isArray(repos) ? repos : [];
  const forkedRepos = safeRepos.filter((r) => r.fork === true).length;
  const forksReceived = safeRepos.reduce((sum, r) => sum + (typeof r.forks_count === "number" ? r.forks_count : 0), 0);
  const totalStars = safeRepos.reduce((sum, r) => sum + (typeof r.stargazers_count === "number" ? r.stargazers_count : 0), 0);
  const streaks = contributionDays ? computeStreakStats(contributionDays) : { currentStreak: 0, longestStreak: 0 };
  return {
    followers: profile?.followers ?? 0,
    totalStars,
    forksReceived,
    forkedRepos,
    repoCount: safeRepos.length,
    currentStreak: streaks.currentStreak,
    longestStreak: streaks.longestStreak,
  };
}

