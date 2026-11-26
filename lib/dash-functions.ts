// Firebase-functions compatible shim.
//
// dashboard/ calls Cloud Functions: syncMeeting, sendReply, sendReceipt,
// googleCalendar, retryMailJob. They are re-implemented as Next API routes;
// this module keeps the httpsCallable(fn)(payload) -> { data } call shape.

export function getFunctions(
  _app?: unknown,
  _region?: string,
): { region: string } {
  return { region: typeof _region === "string" ? _region : "us-central1" };
}

type Callable<TPayload = Record<string, unknown>, TResult = unknown> = (
  payload: TPayload,
) => Promise<{ data: TResult }>;

const ROUTES: Record<string, string> = {
  syncMeeting: "/api/dashboard/sync-meeting",
  sendReply: "/api/dashboard/send-reply",
  sendReceipt: "/api/dashboard/send-receipt",
  googleCalendar: "/api/dashboard/google-calendar",
  retryMailJob: "/api/dashboard/retry-mail-job",
};

export function httpsCallable<
  TPayload = Record<string, unknown>,
  TResult = unknown,
>(_fns: unknown, name: string): Callable<TPayload, TResult> {
  const route = ROUTES[name] ?? `/api/dashboard/${name}`;
  return async (payload: TPayload) => {
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
    return { data: data as TResult };
  };
}
