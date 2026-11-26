import type { SessionDoc } from "@/lib/analytics/types";
import { sawBookPage } from "@/lib/analytics/types";

/** 8.7s, 4m 50s — never "0ms". */
export function formatDuration(ms: number): string {
  const safe = Math.max(0, Math.round(ms || 0));
  if (safe < 1000) return "<1s";
  if (safe < 60_000) return `${(safe / 1000).toFixed(1)}s`;
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.round((safe % 60_000) / 1000);
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

export function relativeTime(ts: number): string {
  if (!ts) return "Earlier";
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function absoluteTime(ts: number): string {
  if (!ts) return "Before the rewrite";
  return new Date(ts).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dayLabel(ts: number): string {
  if (!ts) return "Earlier";
  const date = new Date(ts);
  const today = new Date();
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = start(today) - start(date);
  if (diff === 0) return "Today";
  if (diff === 86_400_000) return "Yesterday";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function flagEmoji(code?: string): string {
  if (!code || code.length !== 2) return "";
  try {
    return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
  } catch {
    return "";
  }
}

export type StoryTone = "cv" | "contact" | "book" | "link" | "quiet";

export interface StoryLabel {
  label: string;
  tone: StoryTone;
}

/** One meaningful label per visit, in priority order. */
export function storyLabel(session: SessionDoc): StoryLabel {
  if ((session.Cv?.Opens || 0) > 0) return { label: "Read the CV", tone: "cv" };
  if (session.Contact?.Sent) return { label: "Reached contact", tone: "contact" };
  if (sawBookPage(session)) return { label: "Viewed book page", tone: "book" };
  if (session.Link) return { label: "Came from a link", tone: "link" };
  return { label: "Just looked around", tone: "quiet" };
}

export function scrollDepth(session: SessionDoc): number {
  const values = Object.values(session.Scroll || {}).map((v) => Number(v) || 0);
  return values.length ? Math.round(Math.max(...values)) : 0;
}

export function deviceIconType(type?: string): "desktop" | "phone" | "tablet" {
  return type === "phone" || type === "tablet" ? type : "desktop";
}
