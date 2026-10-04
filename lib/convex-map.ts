// Maps Convex rows (camelCase, _id, epoch createdAt) back to the snake_case
// object shape the public pages, admin UI and Canary sync have always used.

/* eslint-disable @typescript-eslint/no-explicit-any */

export function toBooking(r: any): Record<string, unknown> {
  if (!r) return r;
  return {
    id: r._id,
    date: r.date,
    time: r.time,
    user_local_time: r.userLocalTime ?? null,
    user_timezone: r.userTimezone ?? null,
    name: r.name,
    email: r.email,
    reason: r.reason ?? null,
    meeting_link: r.meetingLink ?? null,
    google_event_id: r.googleEventId ?? null,
    created_at: r.createdAt ? new Date(r.createdAt).toISOString() : null,
  };
}

export function toMessage(r: any): Record<string, unknown> {
  if (!r) return r;
  return {
    id: r._id,
    name: r.name,
    email: r.email,
    number: r.number ?? null,
    has_whatsapp: !!r.hasWhatsapp,
    message: r.message,
    files: r.files ?? [],
    created_at: r.createdAt ? new Date(r.createdAt).toISOString() : null,
  };
}

export function toAvailability(r: any): Record<string, unknown> | null {
  if (!r) return null;
  return {
    id: 1,
    working_days: r.workingDays,
    hours: r.hours,
    timezone: r.timezone,
    updated_at: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
  };
}
