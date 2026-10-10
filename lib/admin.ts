import { OWNER_COOKIE, cookieValue, readSession, sameOrigin } from "./session";
export function isAdminRequest(req: Request): boolean {
  if (!["GET", "HEAD"].includes(req.method) && !sameOrigin(req)) return false;
  return readSession(cookieValue(req, OWNER_COOKIE)) !== null;
}
