// Central admin guard (fix, not delete).
// Old code compared `x-admin-token` inline in every route with slight drift
// (header-only vs header+?admin). Use this everywhere so auth stays in sync.
// Accepts, in order: `x-admin-token` header, `dashboard_token` cookie (set by
// the dashboard shell alongside localStorage), `?admin=` query (legacy GET).

export function getAdminTokenFromRequest(req: Request): string {
  const header = req.headers.get("x-admin-token")?.trim() ?? "";
  if (header) return header;
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(/(?:^|;\s*)dashboard_token=([^;]+)/);
  if (m) {
    try {
      return decodeURIComponent(m[1]).trim();
    } catch {
      return m[1].trim();
    }
  }
  try {
    const q = new URL(req.url).searchParams.get("admin")?.trim() ?? "";
    if (q) return q;
  } catch {
    // non-URL input (tests) — ignore
  }
  return "";
}

export function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  return getAdminTokenFromRequest(req) === expected;
}
