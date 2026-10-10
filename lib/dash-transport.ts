export async function dataCall<T>(
  operation: string,
  args: Record<string, unknown>,
): Promise<T> {
  const r = await fetch("/api/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation, args }),
    cache: "no-store",
  });
  const b = await r.json();
  if (!r.ok) throw new Error(b.error || "Data request failed");
  return b.data as T;
}
export async function storageCall<T>(
  operation: string,
  args: Record<string, unknown>,
): Promise<T> {
  const r = await fetch("/api/dashboard/storage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation, args }),
    cache: "no-store",
  });
  const b = await r.json();
  if (!r.ok) throw new Error(b.error || "Storage request failed");
  return b.data as T;
}
