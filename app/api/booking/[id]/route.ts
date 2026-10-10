import { isAdminRequest } from "@/lib/admin";
import { NextResponse } from "next/server";
import { convexQuery, convexMutation } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { toBooking } from "@/lib/convex-map";

const checkAuth = isAdminRequest;

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!checkAuth(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const booking = toBooking(
    await convexQuery<Record<string, unknown>>(api.bookings.get, { id }),
  );
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
  await convexMutation(api.bookings.remove, { id });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!checkAuth(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    startTime?: string;
    endTime?: string;
    name?: string;
    reason?: string;
    date?: string;
    time?: string;
    meetingLink?: string;
    googleEventId?: string;
  } | null;
  if (!body)
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  if (body.startTime || body.endTime) {
    const start = new Date(body.startTime ?? "");
    const end = new Date(body.endTime ?? "");
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      end.getTime() - start.getTime() !== 3_600_000 ||
      !body.date ||
      !body.time
    ) {
      return NextResponse.json(
        { error: "Supply a valid one-hour range and matching host date/time" },
        { status: 400 },
      );
    }
  }

  const existing = toBooking(
    await convexQuery<Record<string, unknown>>(api.bookings.get, { id }),
  );
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (body.date) patch.date = body.date;
  if (body.time) patch.time = body.time;
  if (body.name) patch.name = body.name;
  if (body.reason !== undefined) patch.reason = body.reason;
  if (body.meetingLink !== undefined) patch.meetingLink = body.meetingLink;
  if (body.googleEventId !== undefined)
    patch.googleEventId = body.googleEventId;

  if (Object.keys(patch).length > 0) {
    try {
      await convexMutation(api.bookings.updateFields, { id, patch });
    } catch (error) {
      const conflict =
        error instanceof Error && error.message.includes("SLOT_TAKEN");
      return NextResponse.json(
        {
          error: conflict
            ? "That slot is already booked"
            : "Could not update booking",
        },
        { status: conflict ? 409 : 503 },
      );
    }
  }

  const syncUrl = process.env.MEETING_SYNC_URL;
  if (body.startTime && body.endTime && existing.google_event_id && syncUrl) {
    try {
      const r = await fetch(syncUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15_000),
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
      const j = (await r.json().catch(() => ({}))) as {
        status?: string;
        message?: string;
        link?: string;
        id?: string;
      };
      if (!r.ok || j.status !== "success")
        throw new Error(j.message || "Calendar update failed");
    } catch {
      // Best-effort compensation; a competing reservation can prevent restoring the old slot.
      const rollback: Record<string, unknown> = {};
      const keys: Record<string, string> = {
        date: "date",
        time: "time",
        name: "name",
        reason: "reason",
        meetingLink: "meeting_link",
        googleEventId: "google_event_id",
      };
      for (const key of Object.keys(patch))
        rollback[key] = existing[keys[key]] ?? "";
      try {
        if (Object.keys(rollback).length)
          await convexMutation(api.bookings.updateFields, {
            id,
            patch: rollback,
          });
      } catch {
        return NextResponse.json(
          {
            error:
              "Calendar update and rollback failed. Review the booking before retrying.",
          },
          { status: 503 },
        );
      }
      return NextResponse.json(
        {
          error: "Calendar update failed. Check the calendar before retrying.",
        },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
