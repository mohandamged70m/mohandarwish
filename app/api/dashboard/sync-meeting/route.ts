import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/dash-admin";

// Callable: syncMeeting — calendar sync via the Apps Script bridge
// (same protocol the booking API route already uses).
// Payloads (from D-Canary):
//   cancel: { action:'cancel', eventId?, email?, name?, startTime }
//   update: { action:'update', eventId?, name?, email?, reason?, startTime, endTime }
//   create: { action:'create', name?, email?, reason?, startTime, endTime }

export async function POST(req: Request) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.action) return NextResponse.json({ error: "action required" }, { status: 400 });

  const syncUrl = process.env.MEETING_SYNC_URL;
  if (!syncUrl) {
    // Dev mode without calendar bridge: pretend success so dashboard flows work.
    if (body.action === "cancel" || body.action === "update") return NextResponse.json({ status: "success" });
    return NextResponse.json({ status: "success", id: "", link: "" });
  }

  try {
    const r = await fetch(syncUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = (await r.json().catch(() => ({}))) as { status?: string; link?: string; id?: string; message?: string };
    if (j.status === "error") return NextResponse.json({ error: j.message || "Calendar error" }, { status: 502 });
    return NextResponse.json({ status: "success", id: j.id ?? "", link: j.link ?? "" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Calendar sync failed" }, { status: 502 });
  }
}
