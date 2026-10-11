'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

type Health = {
  ok: boolean;
  message: string;
  visits?: number;
  lastVisitAt?: number;
  checks?: { notifications: boolean };
};
async function readHealth(signal?: AbortSignal): Promise<Health> {
  try {
    const res = await fetch('/api/dashboard/trails-health', { cache: 'no-store', signal });
    if (!res.ok) throw new Error('unavailable');
    return await res.json() as Health;
  } catch {
    return { ok: false, message: 'Could not check tracking. Sign in again or retry.' };
  }
}

export default function TrailsHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(true);
  const refresh = useCallback(async () => {
    setChecking(true);
    setHealth(await readHealth());
    setChecking(false);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void readHealth(controller.signal).then(next => {
      if (!controller.signal.aborted) { setHealth(next); setChecking(false); }
    });
    return () => controller.abort();
  }, []);

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg-surface px-4 py-3">
      <div className="min-w-0 flex-1 text-sm text-text-secondary" role="status" aria-live="polite">
        <p className="m-0 font-medium text-text-primary">{checking ? 'Checking visit storage…' : health?.message}</p>
        {!checking && health?.ok && (
          <p className="mt-1 mb-0 text-xs text-text-muted">
            {health.visits || 0} lifetime visits.
            {' '}Test in another browser: your signed-in owner visits are excluded.
            {health.checks?.notifications === false && ' Email notifications are not configured.'}
          </p>
        )}
      </div>
      <button type="button" onClick={() => void refresh()} disabled={checking}
        className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm text-text-secondary disabled:opacity-50">
        <RefreshCw size={14} aria-hidden="true" />
        {checking ? 'Checking…' : 'Check again'}
      </button>
    </div>
  );
}
