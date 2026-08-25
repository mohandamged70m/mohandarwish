import { NextResponse } from "next/server";

type Body = {
  name?: string;
  email?: string;
  message?: string;
  preferredDate?: string;
  preferredTime?: string;
  timezone?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const ALLOWED_TIMES = new Set<string>([
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
]);

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const message = body.message?.trim() ?? "";
  const preferredDate = body.preferredDate?.trim() ?? "";
  const preferredTime = body.preferredTime?.trim() ?? "";
  const timezone = body.timezone?.trim() ?? "";

  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!email || !EMAIL_RE.test(email))
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  if (!message || message.length < 10)
    return NextResponse.json({ error: "Message must be at least 10 characters." }, { status: 400 });

  // Validate scheduling if provided (optional feature)
  let scheduledAt: string | null = null;
  if (preferredDate || preferredTime) {
    if (!preferredDate || !preferredTime) {
      return NextResponse.json({ error: "Both date and time are required for scheduling." }, { status: 400 });
    }
    if (!DATE_RE.test(preferredDate)) {
      return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD." }, { status: 400 });
    }
    if (!TIME_RE.test(preferredTime) || !ALLOWED_TIMES.has(preferredTime)) {
      return NextResponse.json({ error: "Invalid time slot. Choose 09:00–18:00 in 30-min increments." }, { status: 400 });
    }
    const parsed = new Date(`${preferredDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid date." }, { status: 400 });
    }
    // Must be at least tomorrow
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const check = new Date(parsed);
    check.setHours(0, 0, 0, 0);
    if (check < tomorrow) {
      return NextResponse.json({ error: "Please choose a date from tomorrow onwards." }, { status: 400 });
    }
    // Past check for today+time is already covered by tomorrow rule
    scheduledAt = `${preferredDate} ${preferredTime}${timezone ? ` (${timezone})` : ""}`;
  }

  // TODO: wire to real email provider (Resend, SendGrid, etc.)
  // For now we just log and return success — keeps the portfolio functional
  // without requiring env vars. Replace with actual send if CONTACT_EMAIL is set.
  console.log("[contact] message", {
    name,
    email,
    message: message.slice(0, 500),
    scheduledAt,
    timezone: timezone || undefined,
  });

  // Optional: if RESEND_API_KEY is configured, you could send here.
  // Keeping no-op success avoids breaking builds when env is missing.

  return NextResponse.json({ ok: true });
}
