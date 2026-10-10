import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import {
  OWNER_COOKIE,
  equalSecret,
  signSession,
  sessionCookieOptions,
  sameOrigin,
} from "@/lib/session";
import { allowRequest } from "@/lib/rate-limit";
export async function GET(req: Request) {
  return NextResponse.json(
    { authenticated: isAdminRequest(req) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    if (!(await allowRequest(req, "owner-login", 5, 900_000)))
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 },
      );
    const b = await req.json().catch(() => null),
      expected = process.env.ADMIN_TOKEN;
    if (
      !expected ||
      typeof b?.token !== "string" ||
      !equalSecret(b.token, expected)
    )
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    const r = NextResponse.json({ authenticated: true });
    r.cookies.set(
      OWNER_COOKIE,
      signSession({ role: "owner", exp: Date.now() + 86400_000 }),
      { ...sessionCookieOptions, maxAge: 86400 },
    );
    return r;
  } catch {
    return NextResponse.json(
      { error: "Sign-in unavailable. Check server configuration." },
      { status: 503 },
    );
  }
}
export async function DELETE(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const r = NextResponse.json({ ok: true });
  r.cookies.set(OWNER_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return r;
}
