import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin";

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
  const supabase = supabaseServer();

  const [{ data: bookings }, { data: messages }, { data: avail }] = await Promise.all([
    supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("availability").select("*").eq("id", 1).maybeSingle(),
  ]);

  const readDoc = async (path: string) => {
    const { data } = await supabase.from("dashboard_docs").select("data").eq("path", path).maybeSingle();
    return ((data?.data as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  };
  const writeDoc = async (path: string, data: Record<string, unknown>) => {
    await supabase.from("dashboard_docs").upsert(
      { path, data, updated_at: new Date().toISOString() },
      { onConflict: "path" }
    );
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
