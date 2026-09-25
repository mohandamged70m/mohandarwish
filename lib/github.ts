export const GITHUB_USERNAME = "mohandamged70m";

function authHeaders(): Record<string, string> {
  const token =
    process.env.GITHUB_TOKEN ??
    process.env.GH_TOKEN ??
    process.env.GITHUB_PAT ??
    "";
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
  return !!(
    process.env.GITHUB_TOKEN ??
    process.env.GH_TOKEN ??
    process.env.GITHUB_PAT
  );
}

type CacheEntry = { data: unknown; expiresAt: number };

// Module-level in-memory cache. Survives across requests in the same
// server instance (dev + long-lived prod). 30 min TTL drastically cuts
// GitHub API calls: every visitor shares one cached response instead of
// each browser hitting api.github.com (60 req/hr unauthenticated limit).
const cache = new Map<string, CacheEntry>();
const TTL_MS = 30 * 60 * 1000;

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
    next: { revalidate: 1800 },
  });
}
