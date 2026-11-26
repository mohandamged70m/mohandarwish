"use client";

import type { SessionDoc } from "@/lib/analytics/types";
import { DeviceIcon, Flag, isLive } from "./Story";
import {
  absoluteTime,
  deviceIconType,
  flagEmoji,
  formatDuration,
  relativeTime,
  scrollDepth,
  storyLabel,
} from "./format";

interface VisitRowProps {
  session: SessionDoc;
  onOpen: (id: string) => void;
}

/**
 * One visit. Six fixed columns on desktop; the same data collapses into a
 * two-line card below 768px (see .trail-row in dashboard.css).
 */
export default function VisitRow({ session, onOpen }: VisitRowProps) {
  const started = Number(session.StartedAt) || 0;
  const depth = scrollDepth(session);
  const label = storyLabel(session);
  const activeMs = Number(session.ActiveMs) || 0;
  const engaged = activeMs >= 60_000;
  const country = session.Geo?.Country || "Somewhere";
  const code = session.Geo?.Code || "";
  const browser = session.Device?.Browser || "Unknown browser";
  const referrer = session.Entry?.Ref || "direct";
  const live = isLive(session);

  return (
    <li role="listitem">
      <button
        type="button"
        className="trail-row"
        onClick={() => onOpen(session.Id)}
        aria-label={`Open visit from ${country}, ${relativeTime(started)}, ${label.label}`}
      >
        {/* 1 — country badge, 40px */}
        <span className="trail-cell flex justify-center" title={`${country}${code ? ` (${code})` : ""}`}>
          <span className="w-10 h-10 rounded-sm grid place-items-center border border-dash-border bg-dash-surface-raised text-lg" aria-hidden="true">
            {flagEmoji(code)
              ? <Flag code={code} fallback={<DeviceIcon type={session.Device?.Type} size={16} />} />
              : <DeviceIcon type={session.Device?.Type} size={16} />}
          </span>
        </span>

        {/* 2 — time + referrer, flexible */}
        <span className="trail-cell flex flex-col gap-0.5">
          <span className="trail-primary flex items-center gap-2 min-w-0">
            <span className="truncate">{country}</span>
            {session.Link && (
              <span className="trail-chip trail-chip--link shrink-0" title={session.Link.Name}>
                {session.Link.Name}
              </span>
            )}
            {live && <span className="w-2 h-2 rounded-full bg-dash-success shrink-0 animate-pulse" aria-label="Reading now" />}
          </span>
          <span className="trail-secondary truncate" title={absoluteTime(started)}>
            {relativeTime(started)} · from {referrer}
          </span>
        </span>

        {/* 3 — story label, flexible */}
        <span className="trail-cell flex flex-col gap-1">
          <span className={`trail-chip trail-chip--${label.tone}`}>{label.label}</span>
          <span className="trail-secondary trail-mobile-meta">
            {depth}% read · {browser} · {formatDuration(activeMs)}
          </span>
        </span>

        {/* 4 — scroll depth, fixed 160px (always present) */}
        <span className="trail-cell" title={depth ? `Read ${depth}% of the way down` : "No scroll recorded"}>
          {depth > 0 ? (
            <span className="flex items-center gap-2">
              <span className="h-1.5 flex-1 rounded-sm overflow-hidden bg-dash-surface-raised">
                <span className="block h-full rounded-sm bg-dash-accent" style={{ width: `${Math.min(100, depth)}%` }} />
              </span>
              <span className="trail-secondary tabular-nums w-8 text-right">{depth}%</span>
            </span>
          ) : (
            <span className="trail-placeholder" aria-hidden="true" />
          )}
        </span>

        {/* 5 — browser / device, fixed 110px */}
        <span className="trail-cell flex items-center gap-1.5 trail-secondary" title={`${browser} · ${session.Device?.OS || "unknown OS"}`}>
          <DeviceIcon type={deviceIconType(session.Device?.Type)} size={14} />
          <span className="truncate">{browser}</span>
        </span>

        {/* 6 — duration, fixed 80px, right aligned */}
        <span className={`trail-cell text-right tabular-nums font-semibold ${engaged ? "text-dash-success" : "text-dash-text-2"}`}>
          {formatDuration(activeMs)}
        </span>
      </button>
    </li>
  );
}
