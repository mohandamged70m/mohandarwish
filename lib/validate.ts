// Shared request validation (fix, not delete).
// This module is the neutral home for shared validators so contact/booking/
// dashboard routes share one implementation. `lib/booking.ts` re-exports
// EMAIL_RE so its existing importers keep working.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(v: unknown): boolean {
  return typeof v === "string" && EMAIL_RE.test(v.trim());
}

export async function parseJsonBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
