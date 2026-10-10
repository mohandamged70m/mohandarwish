import { createHmac } from "node:crypto";
import { api } from "@/convex/_generated/api";
import { convexMutation } from "./convex";

// Durable per-visitor rate limits backed by Convex. Visitor addresses are
// hashed with a server-only secret (RATE_LIMIT_SECRET, falling back to
// AUTH_SECRET) so raw IPs never leave the server.
function rateLimitSecret(): string {
  const secret = process.env.RATE_LIMIT_SECRET || process.env.AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error(
      "Rate limiting needs RATE_LIMIT_SECRET (or AUTH_SECRET) with at least 32 characters",
    );
  return secret;
}

export async function allowRequest(
  req: Request,
  action: string,
  limit = 5,
  windowMs = 600_000,
): Promise<boolean> {
  const address =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = createHmac("sha256", rateLimitSecret())
    .update(action + ":" + address)
    .digest("hex");
  return (
    (await convexMutation<boolean>(api.rateLimits.consume, {
      key,
      limit,
      windowMs,
    })) === true
  );
}
