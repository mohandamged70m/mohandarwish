import { allowRequest } from "@/lib/rate-limit";
import { parseAvailabilityConfig } from "@/lib/availability";
import { NextResponse } from "next/server";
import { convexQuery, convexMutation } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import {
  EMAIL_RE,
  getOffsetFromUTCString,
  formatDateDDMMYYYY,
} from "@/lib/booking";
import { sanitizeText } from "@/lib/sanitize";
import { isAdminRequest } from "@/lib/admin";
import { parseJsonBody } from "@/lib/validate";
import { bookingGuestHtml, bookingOwnerHtml } from "@/lib/email";
import { Resend } from "resend";
import { getResendFrom, sendSafe } from "@/lib/resend";
import { toBooking } from "@/lib/convex-map";

type Body = {
  name?: string;
  email?: string;
  reason?: string;
  startTime?: string;
  endTime?: string;
  userTimezone?: number;
  selectedTime?: string;
};

export async function POST(req: Request) {
  const body = await parseJsonBody<Body>(req);
  if (!body)
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const name = sanitizeText(body.name, 120);
  const email = body.email?.trim() ?? "";
  const reason = sanitizeText(body.reason, 2000);
  const startTime = body.startTime?.trim() ?? "";
  const endTime = body.endTime?.trim() ?? "";
  const selectedTime = body.selectedTime?.trim() ?? "";
  const userTimezone =
    typeof body.userTimezone === "number" ? body.userTimezone : null;

  if (!name)
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!email || !EMAIL_RE.test(email))
    return NextResponse.json(
      { error: "Valid email required" },
      { status: 400 },
    );
  if (!startTime || !endTime)
    return NextResponse.json({ error: "Time required" }, { status: 400 });

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  )
    return NextResponse.json({ error: "Invalid time" }, { status: 400 });
  if (start.getTime() < Date.now() + 30 * 60 * 1000)
    return NextResponse.json(
      { error: "Slot must be at least 30 minutes ahead" },
      { status: 400 },
    );

  let avail: Record<string, unknown> | null;
  let hostOffset: number;
  try {
    if (!(await allowRequest(req, "booking")))
      return NextResponse.json(
        { error: "Please try again later" },
        { status: 429 },
      );
    avail = await convexQuery<Record<string, unknown>>(
      api.availability.get,
      {},
    );
    hostOffset = getOffsetFromUTCString(
      typeof avail?.timezone === "string" ? avail.timezone : "UTC+02:00",
    );
  } catch {
    return NextResponse.json(
      { error: "Booking service unavailable" },
      { status: 503 },
    );
  }
  // derive host date/time from same instant (cross-midnight fix)
  const hostInstant = new Date(start.getTime() + hostOffset * 3600000);
  const dateStr = formatDateDDMMYYYY(
    new Date(
      Date.UTC(
        hostInstant.getUTCFullYear(),
        hostInstant.getUTCMonth(),
        hostInstant.getUTCDate(),
      ),
    ),
  );
  // hostInstant is already shifted, so get UTCHours
  const h = hostInstant.getUTCHours();
  const m = hostInstant.getUTCMinutes();
  const period = h >= 12 ? "PM" : "AM";
  const dh = h % 12 || 12;
  const timeStr = `${dh.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${period}`;

  const config = parseAvailabilityConfig(avail);
  if (
    !config.workingDays.includes(hostInstant.getUTCDay()) ||
    !config.hours.includes(h) ||
    (m !== 0 && (!config.hours.includes(h + 1) || h === 23)) ||
    end.getTime() - start.getTime() !== 3600_000
  )
    return NextResponse.json(
      { error: "Choose an available one-hour slot" },
      { status: 400 },
    );
  let insertedId: string | null;
  try {
    insertedId = await convexMutation<string>(api.bookings.create, {
      date: dateStr,
      time: timeStr,
      userLocalTime: selectedTime || undefined,
      userTimezone: userTimezone ?? undefined,
      name,
      email,
      reason: reason || undefined,
    });
    if (!insertedId) throw new Error();
  } catch (e) {
    const conflict = e instanceof Error && e.message.includes("SLOT_TAKEN");
    return NextResponse.json(
      {
        error: conflict
          ? "That slot is already booked. Please pick another."
          : "Could not reserve your call",
      },
      { status: conflict ? 409 : 503 },
    );
  }
  // call Apps Script to create calendar event
  const syncUrl = process.env.MEETING_SYNC_URL;
  let meetLink = "";
  let googleEventId = "";
  if (syncUrl) {
    try {
      const r = await fetch(syncUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          name,
          email,
          reason,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        status?: string;
        link?: string;
        id?: string;
        message?: string;
      };
      if (!r.ok || j.status !== "success" || !j.id)
        throw new Error(j.message || "Calendar sync failed");
      meetLink = j.link || "";
      googleEventId = j.id || "";
    } catch (e) {
      await convexMutation(api.bookings.remove, { id: insertedId }).catch(
        () => {},
      );
      const msg = e instanceof Error ? e.message : "Calendar sync failed";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  } else {
    // no sync url: create without calendar (dev mode) — still save
    meetLink = "";
  }

  try {
    await convexMutation(api.bookings.updateFields, {
      id: insertedId,
      patch: {
        status: "confirmed",
        expiresAt: 0,
        meetingLink: meetLink,
        googleEventId,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not confirm your booking. Contact me before retrying." },
      { status: 503 },
    );
  }
  const inserted = { id: insertedId };
  // Await notification attempts; a delivery failure does not undo a saved booking.
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const resend = new Resend(resendKey);
    const owner = process.env.OWNER_EMAIL || "mohandamged70m@gmail.com";
    const from = getResendFrom();
    const guestHtml = bookingGuestHtml({
      name,
      date: dateStr,
      time: timeStr,
      meetingLink: meetLink,
    });
    const ownerHtml = bookingOwnerHtml({
      name,
      email,
      date: dateStr,
      time: timeStr,
      reason,
      meetingLink: meetLink,
    });
    // Guest delivery may be skipped until the sending domain is verified.
    await (async () => {
      const ownerRes = await sendSafe(resend, {
        from,
        to: owner,
        subject: "New booking: " + name + " — " + dateStr,
        html: ownerHtml,
        replyTo: email,
      });
      const guestRes = await sendSafe(resend, {
        from,
        to: email,
        subject: "Your call is booked — " + dateStr + " " + timeStr,
        html: guestHtml,
      });
      if (ownerRes.skipped || guestRes.skipped) {
        console.log(
          "[booking] saved but email skipped (Resend test mode) — verify domain at resend.com/domains",
          {
            id: inserted?.id,
            date: dateStr,
            time: timeStr,
            toOwner: owner,
            toGuest: email,
          },
        );
      }
    })().catch((e) => console.error("[booking] notification failed", e));
  } else {
    console.log("[booking] created", {
      id: inserted?.id,
      date: dateStr,
      time: timeStr,
      name,
      email,
    });
  }

  return NextResponse.json({
    ok: true,
    id: inserted?.id,
    link: meetLink,
    date: dateStr,
    time: timeStr,
  });
}

export async function GET(req: Request) {
  if (!isAdminRequest(req)) {
    // public not allowed to list PII
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await convexQuery<Record<string, unknown>[]>(
    api.bookings.list,
    {},
  );
  return NextResponse.json({ bookings: (rows ?? []).map(toBooking) });
}
