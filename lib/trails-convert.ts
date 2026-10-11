import "server-only";
import { convexMutation } from "@/lib/convex";
import { api } from "@/convex/_generated/api";

// Server-confirmed Trails conversions. Booking/message routes call this AFTER
// their own persistence succeeds, attaching the visitor's session id and the
// stable submission id the client generated for that submit click. Retried
// deliveries confirm once (Convex dedupes by submission id); failures never
// break the booking/message response — the submission stays saved, only the
// story annotation is missing.

const SID_RE = /^[a-z0-9]{1,14}-[a-z0-9]{4,20}$/i;
const SUB_RE = /^[A-Za-z0-9-]{8,64}$/;

export async function confirmTrailsConversion(
  sid: unknown,
  sub: unknown,
  kind: "message" | "meeting" | "book",
): Promise<boolean> {
  try {
    if (typeof sid !== "string" || typeof sub !== "string") return false;
    if (!SID_RE.test(sid) || !SUB_RE.test(sub)) return false;
    const result = (await convexMutation(api.trails.confirmConversion, {
      sessionId: sid,
      sub,
      kind,
    })) as { confirmed?: boolean } | null;
    return result?.confirmed === true;
  } catch {
    return false;
  }
}
