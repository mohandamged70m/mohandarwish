export function requireServer(serverKey: string): void {
  const expected = process.env.CONVEX_SERVER_KEY;
  if (!expected || typeof serverKey !== "string") throw new Error("Unauthorized");
  // Constant-time comparison to avoid leaking the secret via timing.
  if (serverKey.length !== expected.length) throw new Error("Unauthorized");
  let diff = 0;
  for (let i = 0; i < serverKey.length; i++) {
    diff |= serverKey.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) throw new Error("Unauthorized");
}
