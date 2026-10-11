'use client';

import { useEffect, useRef, useState } from 'react';

const KEY = 'trails_cv_pending';
const EVENT = 'trails:cv-arrival';
const MAX_AGE_MS = 30_000;

/** The persistent modal host consumes this after the portfolio route commits. */
export function requestCvOnArrival(): void {
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* event fallback */ }
  window.dispatchEvent(new Event(EVENT));
}

export function useCvArrival(pathname: string | null, onArrival: () => void): void {
  const pending = useRef(false);
  const [request, setRequest] = useState(0);
  useEffect(() => {
    const receive = () => { pending.current = true; setRequest(n => n + 1); };
    window.addEventListener(EVENT, receive);
    return () => window.removeEventListener(EVENT, receive);
  }, []);
  useEffect(() => {
    if (pathname !== '/') return;
    let at = 0;
    try { at = Number(sessionStorage.getItem(KEY) || 0); } catch { /* event fallback */ }
    const fresh = at > 0 && Date.now() >= at && Date.now() - at <= MAX_AGE_MS;
    if (!pending.current && !fresh) return;
    let cancelled = false;
    // A commit-bound microtask survives the landing's unmount; Strict Mode's
    // cancelled setup never consumes the request intended for the next setup.
    queueMicrotask(() => {
      if (cancelled) return;
      pending.current = false;
      try { sessionStorage.removeItem(KEY); } catch { /* private mode */ }
      onArrival();
    });
    return () => { cancelled = true; };
  }, [pathname, request, onArrival]);
}
