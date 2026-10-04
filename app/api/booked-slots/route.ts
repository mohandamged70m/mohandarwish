import { NextResponse } from "next/server";
import { convexQuery } from "@/lib/convex";
import { api } from "@/convex/_generated/api";

export async function GET() {
  try {
    const rows = await convexQuery<{ date: string; time: string }[]>(api.bookings.listSlots, {});
    return NextResponse.json({ slots: rows ?? [] });
  } catch {
    return NextResponse.json({ slots: [] });
  }
}
