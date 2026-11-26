/**
 * Compatibility layer for the Canary/Settings code that expects the older
 * named-zone booking rules. The portfolio's canonical rules live in
 * `./booking-rules`; everything they export is re-exported here, with the
 * zone-aware helpers those screens need layered on top.
 */
export * from "./booking-rules";

import {
  DAY_MS,
  parseTimeLabel,
  utcOffsetHours,
  wallClock,
} from "./booking-rules";

const HOUR_MS = 3_600_000;
const QUARTER_MS = 900_000;

/** An IANA zone name / "UTC+HH:MM" label, or a fixed offset in hours. */
export type HostZone = string | number;

/** True when the value is a name `Intl` can resolve to a real time zone. */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function localOffset(): number {
  if (typeof window === "undefined") return 0;
  try {
    return -(new Date().getTimezoneOffset() / 60);
  } catch {
    return 0;
  }
}

/** Offset east of UTC for an IANA name at a given instant. */
function ianaOffset(zone: string, ms: number): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(ms));
    const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    const asUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
    const diff = asUtc - Math.floor(ms / 1000) * 1000;
    return Math.round(diff / QUARTER_MS) * 0.25;
  } catch {
    return 0;
  }
}

/** The host's current offset in hours, from a zone name or a fixed offset. */
export function offsetAt(zone: HostZone, nowMs: number = Date.now()): number {
  if (typeof zone === "number") return Number.isFinite(zone) ? zone : 0;
  if (isTimeZone(zone)) return ianaOffset(zone, nowMs);
  return utcOffsetHours(zone);
}

/** The host zone recorded on Settings/Availability: a name, else a fixed offset. */
export function hostZone(data: Record<string, unknown> | undefined | null): HostZone {
  if (!data) return localOffset();
  if (isTimeZone(data.timeZone)) return data.timeZone as string;
  const label = data["Current Time"];
  if (typeof label === "string" && /UTC[+-]\d{2}:\d{2}/.test(label)) return utcOffsetHours(label);
  return localOffset();
}

function offsetLabel(hours: number): string {
  const abs = Math.abs(hours);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `UTC${hours < 0 ? "-" : "+"}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Fields to write on a meeting so the host clock it was picked on is kept. */
export function zoneRecord(zone: HostZone): Record<string, string> {
  return { TimeZone: typeof zone === "number" ? offsetLabel(zone) : zone };
}

export function isoInstant(ms: number): string {
  return new Date(ms).toISOString();
}

/** The UTC instant from a stored meeting's `start` string, or null. */
export function slotStart(slot: { start?: unknown } | null | undefined): number | null {
  const raw = slot?.start;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  // Meetings store ISO instants with milliseconds (isoInstant()). Anything else
  // is legacy, ambiguous local input — never guess a calendar event from it.
  if (
    typeof raw !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(raw)
  )
    return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

/** A host-clock "hh:mm AM/PM" on a day index, as a UTC instant. */
export function hostTimeToInstant(day: number, label: string, zone: HostZone): number | null {
  const minutes = parseTimeLabel(label);
  if (minutes === null) return null;
  const wall = day * DAY_MS + minutes * 60_000;
  // One refinement pass is enough across a DST change (offsets are whole quarters).
  let ms = wall - offsetAt(zone, wall) * HOUR_MS;
  ms = wall - offsetAt(zone, ms) * HOUR_MS;
  return ms;
}

/** A UTC instant shown on the host's clock, in the stored Date/Time shape. */
export function hostWallClock(ms: number, zone: HostZone): { date: string; time: string; weekday: number } {
  return wallClock(ms, offsetAt(zone, ms));
}

/**
 * Whether a one-hour slot starting at `startMs` overlaps a stored meeting.
 * Meetings are passed as `{ start: <ISO instant> }`.
 */
export function isTaken(startMs: number, meetings: Array<{ start?: unknown }>): boolean {
  return meetings.some((meeting) => {
    const other = slotStart(meeting);
    return other !== null && Math.abs(other - startMs) < HOUR_MS;
  });
}
