"use client";

import { useEffect, useState } from "react";
import { EMPTY_TAILOR, type LinkTailor } from "@/lib/analytics-types";

// What the site does differently for someone arriving on a specific share link.
//
// The landing page (/mohanddarwish/<code>) looks the link up, hands the visitor to
// `/` with the tailoring stashed here, and the portfolio picks it up. It lives in
// sessionStorage rather than a prop because the hand-off is a client-side navigation:
// the layout persists across it, so state set before the change would survive, but a
// server component on `/` can never see it — sessionStorage is the one channel that
// works for both the client components that read it and a refresh.

const KEY = "trails_tailor";

export interface Tailor extends LinkTailor {
  LinkName: string;
  LinkFor: string;
}

/** Stash what a link asks for. The landing page owns this; nothing else writes it. */
export function stashTailor(tailor: LinkTailor, link: { Name: string; For: string }): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...EMPTY_TAILOR, ...tailor, ...link }));
  } catch {
    /* private mode - the link just gets the default experience */
  }
}

/** Drop it once the visitor has had it: a refresh minutes later is a fresh visit. */
export function clearTailor(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function readTailor(): Tailor | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<Tailor>;
    if (!o || typeof o !== "object") return null;
    const Greeting = typeof o.Greeting === "string" ? o.Greeting.slice(0, 160) : "";
    const Pinned = Array.isArray(o.Pinned) ? o.Pinned.filter((p): p is string => typeof p === "string").slice(0, 12) : [];
    // Nothing set = nothing to tailor. Not worth a special case anywhere.
    if (!o.AutoCv && !Greeting && !Pinned.length) return null;
    return {
      AutoCv: o.AutoCv === true,
      Greeting,
      Pinned,
      LinkName: typeof o.LinkName === "string" ? o.LinkName.slice(0, 120) : "",
      LinkFor: typeof o.LinkFor === "string" ? o.LinkFor.slice(0, 120) : "",
    };
  } catch {
    return null;
  }
}

/** Fired whenever the tailoring changes, so already-mounted sections can react. */
export const TAILOR_EVENT = "trails:tailor";

/** Announce new tailoring to anything already mounted. */
export function announceTailor(detail: Tailor | null): void {
  try {
    window.dispatchEvent(new CustomEvent<Tailor | null>(TAILOR_EVENT, { detail }));
  } catch {
    /* ignore */
  }
}

/**
 * Read the tailoring once per mount, and keep up with any change.
 *
 * Returns null on the server and on the first client render, then the real value — so
 * a page that shows a tailored hero does not flash the default one in a hydration
 * mismatch. Listens for TAILOR_EVENT because the tailoring can arrive after mount (the
 * tracker's own flush resolves the link) or be revoked while the page is up (the
 * visitor leaves the share link in the same tab).
 */
export function useTailor(): Tailor | null {
  // Read during the first render rather than in an effect: sessionStorage is a
  // synchronous read, and doing it here means no cascading second render. Guarded
  // because there is no storage on the server — that render gets null and the
  // client's hydration pass reads the real value.
  const [tailor, setTailor] = useState<Tailor | null>(() =>
    typeof window === "undefined" ? null : readTailor()
  );

  useEffect(() => {
    const onChange = (e: Event) => {
      setTailor((e as CustomEvent<Tailor | null>).detail ?? null);
    };
    window.addEventListener(TAILOR_EVENT, onChange);
    return () => window.removeEventListener(TAILOR_EVENT, onChange);
  }, []);
  return tailor;
}