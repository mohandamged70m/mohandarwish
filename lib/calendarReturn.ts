/**
 * Outcome of the Google Calendar OAuth round trip. The callable sends the owner
 * to Google and back to the dashboard; the result is parked here until the
 * Calendar panel mounts and can show it.
 */
export type CalendarReturn = "connected" | "denied" | "expired" | "permissions" | "failed";

const STORAGE_KEY = "dashboard.calendarReturn";
const RESULTS: readonly string[] = ["connected", "denied", "expired", "permissions", "failed"];

function isReturn(value: unknown): value is CalendarReturn {
  return typeof value === "string" && RESULTS.includes(value);
}

function session(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null; // storage can be blocked by the browser
  }
}

function fromUrl(): CalendarReturn | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("calendar") ?? params.get("calendarReturn") ?? params.get("result");
    return isReturn(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Park the return Google left in the URL (or read one already parked) and return it. */
export function parkCalendarReturn(): CalendarReturn | null {
  const incoming = fromUrl();
  const store = session();
  try {
    if (incoming) {
      store?.setItem(STORAGE_KEY, incoming);
      return incoming;
    }
    if (store) {
      const parked = store.getItem(STORAGE_KEY);
      return isReturn(parked) ? parked : null;
    }
  } catch {
    /* keep going: a blocked store just means no return to show */
  }
  return null;
}

/**
 * Lazy `useState` initializer for the Calendar panel: reads the parked result
 * once on mount, and yields `null` while nothing is waiting.
 */
export function waitingCalendarReturn(): CalendarReturn | null {
  const store = session();
  try {
    const parked = store?.getItem(STORAGE_KEY) ?? null;
    return isReturn(parked) ? parked : null;
  } catch {
    return null;
  }
}

export function clearCalendarReturn(): void {
  const store = session();
  try {
    store?.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}
