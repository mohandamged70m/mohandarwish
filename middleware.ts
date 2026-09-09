import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Server-side admin guard for dashboard APIs (fix, not delete).
// The dashboard page keeps its client token gate (localStorage + cookie);
// this is defense-in-depth so /api/dashboard/* rejects unauthenticated calls
// even before route handlers run. Header, cookie, and ?admin= are all honored
// via the same comparison as lib/admin.ts.

function requestToken(req: NextRequest): string {
  const header = req.headers.get("x-admin-token")?.trim() ?? "";
  if (header) return header;
  const cookie = req.cookies.get("dashboard_token")?.value?.trim() ?? "";
  if (cookie) return cookie;
  return req.nextUrl.searchParams.get("admin")?.trim() ?? "";
}

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/api/dashboard/")) return NextResponse.next();
  const expected = process.env.ADMIN_TOKEN;
  if (expected && requestToken(req) === expected) return NextResponse.next();
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export const config = {
  matcher: ["/api/dashboard/:path*"],
};
