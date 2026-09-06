import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { EMAIL_RE, getOffsetFromUTCString, formatDateDDMMYYYY } from "@/lib/booking";
import { bookingGuestHtml, bookingOwnerHtml } from "@/lib/email";
import { Resend } from "resend";
import { getResendFrom, sendSafe } from "@/lib/resend";

type Body = {
  name?: string;
  email?: string;
  reason?: string;
  startTime?: string;
  endTime?: string;
  userTimezone?: number;
  selectedTime?: string;
};

const RATE_LIMIT_MS = 5 * 60 * 1000; // global 5 min like revil 300s

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const reason = body.reason?.trim() ?? "";
  const startTime = body.startTime?.trim() ?? "";
  const endTime = body.endTime?.trim() ?? "";
  const selectedTime = body.selectedTime?.trim() ?? "";
  const userTimezone = typeof body.userTimezone === "number" ? body.userTimezone : null;

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!email || !EMAIL_RE.test(email)) return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  if (!startTime || !endTime) return NextResponse.json({ error: "Time required" }, { status: 400 });

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start)
    return NextResponse.json({ error: "Invalid time" }, { status: 400 });
  if (start.getTime() < Date.now() + 30 * 60 * 1000)
    return NextResponse.json({ error: "Slot must be at least 30 minutes ahead" }, { status: 400 });

  const supabase = supabaseServer();

  // fetch availability for hostOffset
  let hostOffset = 2;
  try {
    const { data } = await supabase.from("availability").select("timezone").eq("id", 1).maybeSingle();
    if (data?.timezone) {
      hostOffset = getOffsetFromUTCString(data.timezone);
    }
  } catch {}

  // rate limit: last booking within 5 min
  try {
    const { data: last } = await supabase.from("bookings").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (last?.created_at && Date.now() - new Date(last.created_at).getTime() < RATE_LIMIT_MS) {
      return NextResponse.json({ error: "Another booking just came in — please wait a few minutes and try again." }, { status: 429 });
    }
  } catch {}

  // derive host date/time from same instant (cross-midnight fix)
  const hostInstant = new Date(start.getTime() + hostOffset * 3600000);
  const dateStr = formatDateDDMMYYYY(new Date(Date.UTC(hostInstant.getUTCFullYear(), hostInstant.getUTCMonth(), hostInstant.getUTCDate())));
  // hostInstant is already shifted, so get UTCHours
  const h = hostInstant.getUTCHours();
  const m = hostInstant.getUTCMinutes();
  const period = h >= 12 ? "PM" : "AM";
  const dh = h % 12 || 12;
  const timeStr = `${dh.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${period}`;

  // check slot not already taken
  try {
    const { data: existing } = await supabase.from("bookings").select("id").eq("date", dateStr).eq("time", timeStr).limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "That slot is already booked. Please pick another." }, { status: 409 });
    }
  } catch {}

  // call Apps Script to create calendar event
  const syncUrl = process.env.MEETING_SYNC_URL;
  let meetLink = "";
  let googleEventId = "";
  if (syncUrl) {
    try {
      const r = await fetch(syncUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, reason, startTime: start.toISOString(), endTime: end.toISOString() }),
      });
      const j = (await r.json().catch(() => ({}))) as { status?: string; link?: string; id?: string; message?: string };
      if (j.status === "error") throw new Error(j.message || "Calendar error");
      meetLink = j.link || "";
      googleEventId = j.id || "";
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Calendar sync failed";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  } else {
    // no sync url: create without calendar (dev mode) — still save
    meetLink = "";
  }

  // insert booking
  const { data: inserted, error: insertErr } = await supabase
    .from("bookings")
    .insert({
      date: dateStr,
      time: timeStr,
      user_local_time: selectedTime || null,
      user_timezone: userTimezone,
      name,
      email,
      reason: reason || null,
      meeting_link: meetLink || null,
      google_event_id: googleEventId || null,
    })
    .select()
    .single();

  if (insertErr) {
    // rollback calendar
    if (googleEventId && syncUrl) {
      try {
        await fetch(syncUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel", eventId: googleEventId, email, name, startTime: start.toISOString() }),
        });
      } catch {}
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // emails (non-blocking, test-mode safe — guest send skipped until domain verified)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const resend = new Resend(resendKey);
    const owner = process.env.OWNER_EMAIL || "mohandamged70m@gmail.com";
    const from = getResendFrom();
    const guestHtml = bookingGuestHtml({ name, date: dateStr, time: timeStr, meetingLink: meetLink });
    const ownerHtml = bookingOwnerHtml({ name, email, date: dateStr, time: timeStr, reason, meetingLink: meetLink });
    // fire and forget — never fail the booking even if Resend is in test mode (403)
    void (async () => {
      const ownerRes = await sendSafe(resend, { from, to: owner, subject: "New booking: " + name + " — " + dateStr, html: ownerHtml, replyTo: email });
      const guestRes = await sendSafe(resend, { from, to: email, subject: "Your call is booked — " + dateStr + " " + timeStr, html: guestHtml });
      if (ownerRes.skipped || guestRes.skipped) {
        console.log("[booking] saved but email skipped (Resend test mode) — verify domain at resend.com/domains", { id: inserted?.id, date: dateStr, time: timeStr, toOwner: owner, toGuest: email });
      }
    })();
  } else {
    console.log("[booking] created", { id: inserted?.id, date: dateStr, time: timeStr, name, email });
  }

  return NextResponse.json({ ok: true, id: inserted?.id, link: meetLink, date: dateStr, time: timeStr });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("admin");
  const headerToken = req.headers.get("x-admin-token");
  const adminToken = headerToken || token;
  if (!process.env.ADMIN_TOKEN || adminToken !== process.env.ADMIN_TOKEN) {
    // public not allowed to list PII
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = supabaseServer();
  const { data, error } = await supabase.from("bookings").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bookings: data });
}
