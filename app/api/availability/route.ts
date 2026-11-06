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
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null) as { workingDays?: number[]; hours?: number[]; timezone?: string } | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const workingDays = Array.isArray(body.workingDays)
    ? [...new Set(body.workingDays.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))]
    : DEFAULT_AVAILABILITY.workingDays;
  const hours = Array.isArray(body.hours)
    ? [...new Set(body.hours.filter((n) => Number.isInteger(n) && n >= 0 && n <= 23))]
    : DEFAULT_AVAILABILITY.hours;
  const timezone =
    typeof body.timezone === "string" && /^[A-Za-z0-9_+()\- :]{1,64}$/.test(body.timezone)
      ? body.timezone
      : "UTC+02:00 (EET)";
  await convexMutation(api.availability.upsert, { workingDays, hours, timezone });
  return NextResponse.json({ ok: true });
}
