"use client";

// Fire-and-forget page-view ping for Trails (no PII, public POST).
// Link-only mode: Trails records share-link visits alone, so the legacy
// direct ping is retired. Kept as a no-op so existing usages don't break.
export function TrackView({ path }: { path?: string }) {
  void path;
  return null;
}
