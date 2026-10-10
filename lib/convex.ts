import "server-only";
import { ConvexHttpClient } from "convex/browser";

// Server-side Convex client. Gateway calls fail closed if configuration is missing.

let _http: ConvexHttpClient | null = null;

export function convexEnabled(): boolean {
  return !!process.env.NEXT_PUBLIC_CONVEX_URL;
}

export function getConvexHttp(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  if (!_http) _http = new ConvexHttpClient(url);
  return _http;
}

// Convenience server wrappers around the generated api.
/* eslint-disable @typescript-eslint/no-explicit-any */
function isServerKeyValidationError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return (
    msg.includes("serverKey") &&
    (msg.includes("extra field") ||
      msg.includes("ArgumentValidationError") ||
      msg.includes("not in the validator"))
  );
}

export async function convexQuery<T = any>(
  ref: any,
  args?: Record<string, unknown>,
): Promise<T | null> {
  const client = getConvexHttp();
  if (!client) throw new Error("Convex not configured");
  const serverKey = process.env.CONVEX_SERVER_KEY;
  const withKey = serverKey ? { ...args, serverKey } : { ...args };
  try {
    return (await client.query(ref, withKey)) as T;
  } catch (e) {
    // The deployed Convex functions may predate the serverKey gate
    // (local convex/*.ts not yet deployed). Retry without the extra
    // field so public reads keep working until `npx convex deploy`.
    if (serverKey && isServerKeyValidationError(e)) {
      return (await client.query(ref, { ...args })) as T;
    }
    throw e;
  }
}

export async function convexMutation<T = any>(
  ref: any,
  args?: Record<string, unknown>,
): Promise<T | null> {
  const client = getConvexHttp();
  if (!client) throw new Error("Convex not configured");
  const serverKey = process.env.CONVEX_SERVER_KEY;
  const withKey = serverKey ? { ...args, serverKey } : { ...args };
  try {
    return (await client.mutation(ref, withKey)) as T;
  } catch (e) {
    if (serverKey && isServerKeyValidationError(e)) {
      return (await client.mutation(ref, { ...args })) as T;
    }
    throw e;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
