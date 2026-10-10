export function requireServer(serverKey: string): void {
  const expected = process.env.CONVEX_SERVER_KEY;
  if (!expected || serverKey !== expected) throw new Error("Unauthorized");
}
