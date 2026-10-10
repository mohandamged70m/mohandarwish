import { createHmac, timingSafeEqual } from "node:crypto";
export const OWNER_COOKIE = "owner_session";
type Session = { role: "owner"; exp: number };
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32)
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  return s;
}
export function equalSecret(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function signSession(session: Session) {
  const p = Buffer.from(JSON.stringify(session)).toString("base64url");
  return p + "." + createHmac("sha256", secret()).update(p).digest("base64url");
}
export function readSession(token: string | undefined): Session | null {
  try {
    if (!token) return null;
    const [p, s, extra] = token.split(".");
    if (!p || !s || extra) return null;
    if (
      !equalSecret(
        s,
        createHmac("sha256", secret()).update(p).digest("base64url"),
      )
    )
      return null;
    const v = JSON.parse(Buffer.from(p, "base64url").toString());
    return v.role === "owner" && Number.isFinite(v.exp) && v.exp > Date.now()
      ? v
      : null;
  } catch {
    return null;
  }
}
export function cookieValue(req: Request, name: string) {
  return (req.headers.get("cookie") || "")
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(name + "="))
    ?.slice(name.length + 1);
}
export function sameOrigin(req: Request) {
  const o = req.headers.get("origin");
  return !o || o === new URL(req.url).origin;
}
export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};
