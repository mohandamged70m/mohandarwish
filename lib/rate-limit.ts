import { createHmac } from "node:crypto";
import { api } from "@/convex/_generated/api";
import { convexMutation } from "./convex";
export async function allowRequest(
  req: Request,
  action: string,
  limit = 5,
  windowMs = 600_000,
): Promise<boolean> {
  const address =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("Session secret missing");
  const key = createHmac("sha256", secret)
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
