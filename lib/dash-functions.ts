// Firebase-functions compatible shim.
//
// dashboard/ calls three Cloud Functions: syncMeeting, sendReply, sendReceipt.
// They are re-implemented as Next API routes below; this module keeps the
// httpsCallable(fn)(payload) -> { data } call shape unchanged.

export function getFunctions(
  _app?: unknown,
  _region?: string,
): { region: string } {
  return { region: typeof _region === "string" ? _region : "us-central1" };
}

type Callable = (
  payload: Record<string, unknown>,
) => Promise<{ data: unknown }>;

const ROUTES: Record<string, string> = {
  syncMeeting: "/api/dashboard/sync-meeting",
  sendReply: "/api/dashboard/send-reply",
  sendReceipt: "/api/dashboard/send-receipt",
};

export function httpsCallable(_fns: unknown, name: string): Callable {
  const route = ROUTES[name] ?? `/api/dashboard/${name}`;
  return async (payload: Record<string, unknown>) => {
    const r = await fetch(route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });
    const data = (await r.json().catch(() => ({}))) as unknown;
    if (!r.ok) {
      const msg =
        (data as { error?: string })?.error ||
        `Function ${name} failed (${r.status})`;
      throw new Error(msg);
    }
    return { data };
  };
}
