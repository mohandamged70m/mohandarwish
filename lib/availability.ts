export interface AvailabilityConfig {
  workingDays: number[];
  hours: number[];
}

export const DEFAULT_AVAILABILITY: AvailabilityConfig = {
  workingDays: [0, 1, 2, 3, 4, 5, 6],
  hours: [9, 10, 11, 12, 14, 15, 16, 17],
};

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const ALL_HOURS: number[] = Array.from({ length: 24 }, (_, h) => h);

function sanitizeHours(arr: unknown[]): number[] {
  return [...new Set(arr.filter((h): h is number => typeof h === "number" && Number.isInteger(h) && h >= 0 && h <= 23))].sort(
    (a, b) => a - b
  );
}

function deriveLegacyHours(data: Record<string, unknown>): number[] | null {
  const sh = data.startHour,
    eh = data.endHour;
  if (typeof sh !== "number" || typeof eh !== "number") return null;
  const bs = typeof data.breakStart === "number" ? data.breakStart : null;
  const be = typeof data.breakEnd === "number" ? data.breakEnd : null;
  const out: number[] = [];
  for (let h = sh; h <= eh; h++) {
    if (bs !== null && be !== null && h >= bs && h < be) continue;
    if (h >= 0 && h <= 23) out.push(h);
  }
  return out.length ? out : null;
}

export function parseAvailabilityConfig(
  data: Record<string, unknown> | undefined | null
): AvailabilityConfig {
  if (!data) return DEFAULT_AVAILABILITY;
  const rawDays = Array.isArray(data.workingDays) ? data.workingDays : null;
  const workingDays = rawDays
    ? [...new Set(rawDays.filter((d): d is number => typeof d === "number" && d >= 0 && d <= 6))].sort((a, b) => a - b)
    : DEFAULT_AVAILABILITY.workingDays;
  let hours: number[];
  if (Array.isArray(data.hours)) {
    hours = sanitizeHours(data.hours);
  } else {
    hours = deriveLegacyHours(data) ?? DEFAULT_AVAILABILITY.hours;
  }
  if (hours.length === 0 && Array.isArray(data.hours) && data.hours.length === 0) hours = [];
  return { workingDays, hours };
}

export function formatHourSlot(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 || 12;
  return `${display.toString().padStart(2, "0")}:00 ${period}`;
}

export function buildHostSlots(cfg: AvailabilityConfig): string[] {
  return [...cfg.hours].sort((a, b) => a - b).map(formatHourSlot);
}

export function isWorkingDay(cfg: AvailabilityConfig, date: Date): boolean {
  return cfg.workingDays.includes(date.getDay());
}
