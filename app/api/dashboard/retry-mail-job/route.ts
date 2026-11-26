import { isAdminRequest } from "@/lib/admin";
import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/request";

// Callable: retryMailJob — { id: string }. Asks the server-side outbox worker
// to retry one failed mail job. No backend configured -> honest error, not a
// fake success.

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
  const id = (body as Record<string, unknown>).id;
  if (typeof id !== "string" || !id.trim() || id.length > 200)
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });

  const retryUrl = process.env.MAIL_JOB_RETRY_URL;
  if (!retryUrl)
    return NextResponse.json(
      { error: "Mail job retry is not configured" },
      { status: 503 },
    );

  try {
    const r = await fetch(retryUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
      cache: "no-store",
    });
    const payload = (await r.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!r.ok)
      return NextResponse.json(
        {
          error:
            typeof payload?.error === "string"
              ? payload.error
              : "Mail job retry failed",
        },
        { status: 502 },
      );
    return NextResponse.json(payload ?? { status: "queued" });
  } catch (e) {
    console.error("[retry-mail-job] retry failed", e);
    return NextResponse.json({ error: "Mail job retry unavailable" }, { status: 502 });
  }
}
