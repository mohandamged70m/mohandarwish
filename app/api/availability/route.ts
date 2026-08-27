import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { DEFAULT_AVAILABILITY, parseAvailabilityConfig } from "@/lib/availability";

export async function GET() {
  try {
    const supabase = supabaseServer();
    const { data, error } = await supabase.from("availability").select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({
        workingDays: DEFAULT_AVAILABILITY.workingDays,
        hours: DEFAULT_AVAILABILITY.hours,
        timezone: "UTC+02:00 (EET)",
      });
    }
    const cfg = parseAvailabilityConfig({
      workingDays: data.working_days,
      hours: data.hours,
    });
    return NextResponse.json({ ...cfg, timezone: data.timezone ?? "UTC+02:00 (EET)" });
  } catch {
    return NextResponse.json({
      ...DEFAULT_AVAILABILITY,
      timezone: "UTC+02:00 (EET)",
    });
  }
}

export async function PUT(req: Request) {
  const token = req.headers.get("x-admin-token");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    // also allow OWNER email check via body? simple token guard
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null) as { workingDays?: number[]; hours?: number[]; timezone?: string } | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const supabase = supabaseServer();
  const { error } = await supabase.from("availability").upsert({
    id: 1,
    working_days: body.workingDays ?? DEFAULT_AVAILABILITY.workingDays,
    hours: body.hours ?? DEFAULT_AVAILABILITY.hours,
    timezone: body.timezone ?? "UTC+02:00 (EET)",
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
