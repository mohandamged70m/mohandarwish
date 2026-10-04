import { ConvexHttpClient } from "convex/browser";

// Server-side Convex HTTP client. Returns null when Convex is not configured,
// callers fall back to a no-backend state.

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
export async function convexQuery<T = any>(ref: any, args?: Record<string, unknown>): Promise<T | null> {
  const client = getConvexHttp();
  if (!client) return null;
  return (await client.query(ref, args ?? {})) as T;
}

export async function convexMutation<T = any>(ref: any, args?: Record<string, unknown>): Promise<T | null> {
  const client = getConvexHttp();
  if (!client) return null;
  return (await client.mutation(ref, args ?? {})) as T;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
