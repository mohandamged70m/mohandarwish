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
export async function convexQuery<T = any>(
  ref: any,
  args?: Record<string, unknown>,
): Promise<T | null> {
  const client = getConvexHttp();
  if (!client) throw new Error("Convex not configured");
  const serverKey = process.env.CONVEX_SERVER_KEY;
  if (!serverKey) throw new Error("Convex server key missing");
  return (await client.query(ref, { ...args, serverKey })) as T;
}

export async function convexMutation<T = any>(
  ref: any,
  args?: Record<string, unknown>,
): Promise<T | null> {
  const client = getConvexHttp();
  if (!client) throw new Error("Convex not configured");
  const serverKey = process.env.CONVEX_SERVER_KEY;
  if (!serverKey) throw new Error("Convex server key missing");
  return (await client.mutation(ref, { ...args, serverKey })) as T;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
