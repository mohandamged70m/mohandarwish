import { NextResponse } from "next/server";
import { convexQuery, convexMutation } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { DEFAULT_AVAILABILITY, parseAvailabilityConfig } from "@/lib/availability";
import { isAdminRequest } from "@/lib/admin";
import { toAvailability } from "@/lib/convex-map";

// Live Convex-backed config — never execute at build time (CI/preview
// environments may have no env or network; page-data collection would fail).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const row = await convexQuery(api.availability.get, {});
    const data = toAvailability(row);
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
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null) as { workingDays?: number[]; hours?: number[]; timezone?: string } | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  await convexMutation(api.availability.upsert, {
    workingDays: body.workingDays ?? DEFAULT_AVAILABILITY.workingDays,
    hours: body.hours ?? DEFAULT_AVAILABILITY.hours,
    timezone: body.timezone ?? "UTC+02:00 (EET)",
  });
  return NextResponse.json({ ok: true });
}
