import { isAdminRequest } from "@/lib/admin";
import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/request";

// Callable: googleCalendar — { action: 'status' | 'connect' | 'disconnect' }
// Proxies the owner-only calendar bridge; no Google token ever reaches the
// browser. With no bridge configured this reports an honest failure instead of
// pretending a connection exists.

type Action = "status" | "connect" | "disconnect";

function isAction(v: unknown): v is Action {
  return v === "status" || v === "connect" || v === "disconnect";
}

export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await isAdminRequest(req)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: unknown = await req.json().catch(() => null);
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1
  )
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const action = (body as Record<string, unknown>).action;
  if (!isAction(action))
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const bridge = process.env.GOOGLE_CALENDAR_BRIDGE_URL;
  if (!bridge) {
    if (action === "status")
      return NextResponse.json({
        connected: false,
        account: null,
        connectedAt: null,
        broken: false,
        configured: false,
      });
    return NextResponse.json(
      { error: "Calendar integration is not configured" },
      { status: 503 },
    );
  }

  try {
    const r = await fetch(bridge, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
      cache: "no-store",
    });
    const payload = (await r.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!r.ok)
      return NextResponse.json(
        { error: typeof payload?.error === "string" ? payload.error : "Calendar bridge failed" },
        { status: 502 },
      );
    return NextResponse.json({
      ...(payload ?? {}),
      configured: true,
    });
  } catch (e) {
    console.error("[google-calendar] bridge failed", e);
    return NextResponse.json({ error: "Calendar bridge unavailable" }, { status: 502 });
  }
}
