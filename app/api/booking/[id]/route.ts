import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function checkAuth(req: Request): boolean {
  const token = req.headers.get("x-admin-token") || new URL(req.url).searchParams.get("admin");
  return !!process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN;
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const supabase = supabaseServer();
  const { data: booking } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
  const syncUrl = process.env.MEETING_SYNC_URL;
  if (booking?.google_event_id && syncUrl) {
    try {
      await fetch(syncUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          eventId: booking.google_event_id,
          email: booking.email,
          name: booking.name,
          startTime: new Date().toISOString(),
        }),
      });
    } catch {}
  }
  const { error } = await supabase.from("bookings").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    startTime?: string;
    endTime?: string;
    name?: string;
    reason?: string;
    date?: string;
    time?: string;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const supabase = supabaseServer();
  const { data: existing } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const syncUrl = process.env.MEETING_SYNC_URL;
  if (body.startTime && body.endTime && existing.google_event_id && syncUrl) {
    try {
      const r = await fetch(syncUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          eventId: existing.google_event_id,
          name: body.name ?? existing.name,
          email: existing.email,
          reason: body.reason ?? existing.reason,
          startTime: new Date(body.startTime).toISOString(),
          endTime: new Date(body.endTime).toISOString(),
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { status?: string; message?: string; link?: string; id?: string };
      if (j.status === "error") throw new Error(j.message);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 502 });
    }
  }

  const patch: Record<string, unknown> = {};
  if (body.date) patch.date = body.date;
  if (body.time) patch.time = body.time;
  if (body.name) patch.name = body.name;
  if (body.reason !== undefined) patch.reason = body.reason;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("bookings").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
