import "server-only";

/** Reject cross-site POST/PUT/PATCH/DELETE (CSRF guard for cookie sessions). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  // Browser writes always send Origin. A missing Origin on a write is treated
  // as cross-site rather than silently trusted.
  if (!origin) return req.method === "GET" || req.method === "HEAD";
  try {
    return origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}
