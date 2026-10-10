import "server-only";
import { auth } from "@/auth";
import { isOwnerSession } from "./owner";
import { sameOrigin } from "./request";

// Central owner guard. Reads the Auth.js session (never a custom cookie or
// token) and re-checks the configured owner email on every call.

export async function isAdminRequest(req: Request): Promise<boolean> {
  if (!["GET", "HEAD"].includes(req.method) && !sameOrigin(req)) return false;
  try {
    return isOwnerSession(await auth());
  } catch {
    // Expired or undecryptable sessions fail closed.
    return false;
  }
}
