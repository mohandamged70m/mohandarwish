import "server-only";

/** Reject cross-site POST/PUT/PATCH/DELETE (CSRF guard for cookie sessions). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}
