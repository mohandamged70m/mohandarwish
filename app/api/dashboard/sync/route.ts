import { NextResponse } from "next/server";
import { convexQuery, convexMutation } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { isAdminRequest } from "@/lib/admin";
import { toBooking, toMessage, toAvailability } from "@/lib/convex-map";

// Admin: mirror the site's real tables (bookings, messages, availability)
// into the dashboard_docs the copy-pasted Canary UI reads:
//   Settings/Canary { Meetings, Emails }  (extra doc fields preserved)
//   Settings/Availability { workingDays, hours }
// Called by the dashboard shell on mount + interval.

function checkAuth(req: Request): boolean {
  return isAdminRequest(req);
}

type Booking = {
  id: string;
  date: string;
  time: string;
  name: string;
  email: string;
  reason: string | null;
  meeting_link: string | null;
  google_event_id: string | null;
  user_timezone: number | null;
};

type Message = {
  id: string;
  name: string;
  email: string;
  message: string;
  number: string | null;
  has_whatsapp: boolean;
  files: { name: string; url: string }[] | null;
  created_at: string;
};

export async function POST(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [bookingRows, messageRows, availRow] = await Promise.all([
    convexQuery<Record<string, unknown>[]>(api.bookings.list, {}),
    convexQuery<Record<string, unknown>[]>(api.messages.list, {}),
    convexQuery<Record<string, unknown>>(api.availability.get, {}),
  ]);
  const bookings = (bookingRows ?? []).map(toBooking) as unknown as Booking[];
  const messages = (messageRows ?? []).map(toMessage) as unknown as Message[];
  const avail = toAvailability(availRow);

  const readDoc = async (path: string) => {
    const data = await convexQuery<Record<string, unknown> | null>(api.docs.getDoc, { path });
    return (data ?? {}) as Record<string, unknown>;
  };
  const writeDoc = async (path: string, data: Record<string, unknown>) => {
    await convexMutation(api.docs.setDoc, { path, data });
  };

  // --- Canary ---
  const canary = await readDoc("Settings/Canary");
  const prevMeetings = ((canary.Meetings as Record<string, Record<string, unknown>>) ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const prevEmails = ((canary.Emails as Record<string, Record<string, unknown>>) ?? {}) as Record<
    string,
    Record<string, unknown>
  >;

  const OWNED = new Set(["Name", "Time", "Date", "Email", "MeetingLink", "What For", "UserTimezone", "GoogleEventId"]);
  const meetings: Record<string, Record<string, unknown>> = {};
  for (const b of ((bookings ?? []) as Booking[])) {
    const prev = prevMeetings[b.id] ?? {};
    meetings[b.id] = {
      Name: b.name,
      Time: b.time,
      Date: b.date,
      Email: b.email,
      MeetingLink: b.meeting_link ?? undefined,
      "What For": b.reason ?? undefined,
      UserTimezone: b.user_timezone ?? undefined,
      GoogleEventId: b.google_event_id ?? undefined,
      // preserve dashboard-only extras (Category, manual edits)
      ...Object.fromEntries(Object.entries(prev).filter(([k]) => !OWNED.has(k))),
    };
  }
  const emails: Record<string, Record<string, unknown>> = {};
  for (const m of ((messages ?? []) as Message[])) {
    const prev = prevEmails[m.id] ?? {};
    emails[m.id] = {
      Name: m.name,
      Email: m.email,
      Message: m.message,
      Number: m.number ?? "",
      Whatsapp: !!m.has_whatsapp,
      Timestamp: new Date(m.created_at).getTime(),
      "Files Attached": Array.isArray(m.files) ? m.files : [],
      RepliedAt: typeof prev.RepliedAt === "number" ? prev.RepliedAt : undefined,
    };
  }
  await writeDoc("Settings/Canary", { ...canary, Meetings: meetings, Emails: emails });

  // --- Availability (table wins for workingDays/hours; keep 'Current Time' etc.) ---
  if (avail) {
    const doc = await readDoc("Settings/Availability");
    await writeDoc("Settings/Availability", {
      ...doc,
      workingDays: (avail as { working_days: number[] }).working_days,
      hours: (avail as { hours: number[] }).hours,
    });
  }

  return NextResponse.json({
    ok: true,
    meetings: Object.keys(meetings).length,
    emails: Object.keys(emails).length,
  });
}
