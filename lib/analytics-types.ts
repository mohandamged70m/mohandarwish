/**
 * The shape of a visit.
 *
 * One document per visit lives at `Analytics/Sessions/Items/{id}`, written only by
 * POST /api/track. The browser never writes analytics directly - it buffers a visit
 * and POSTs numbered deltas, which the route applies. Deltas rather than snapshots:
 * counters ship as "what changed since flush N" and the server adds them, so two
 * flushes racing cannot overwrite each other. Values that are a state rather than a
 * tally (the section they are on now, how far they have read) ship absolute and the
 * server just sets them.
 *
 * Field names are PascalCase to match the rest of the project's docs.
 */

/** Everything the timeline can record. Keep in step with EVENT_LABEL. */
export type EventKind =
  | "section"        // v = section name
  | "project"        // v = project id (opened)
  | "project_end"    // v = project id (closed)
  | "out"            // v = "<projectId>:live" | ":github" | ":download"
  | "social"         // v = social name
  | "social_back"    // v = social name
  | "cv"             // CV opened
  | "contact"        // contact modal opened
  | "contact_tab"    // v = "meeting" | "message"
  | "contact_sent"   // v = "message" | "meeting" | "book"
  | "copy"           // v = "email" | "phone" | "text"
  | "scroll"         // v = "<section>:<pct>" milestone
  | "idle"
  | "wake"
  | "hide"
  | "show"
  | "rage"           // v = "rapid" | "dead"
  | "print"
  | "end";

export interface SessionEvent {
  /** Milliseconds since the visit started. */
  t: number;
  k: EventKind;
  v?: string;
}

/**
 * The share link that produced this visit.
 *
 * `Id` is the link's Code - the one thing the visit actually carried, and what the
 * dashboard matches on when it filters stories by link. `DocId` is added server-side
 * so deleting a story can take its counts back off the link's own card.
 */
export interface SessionLink {
  Id: string;
  DocId?: string;
  Name: string;
  For: string;
}

export interface SessionEntry {
  Section: string;
  Path: string;
  /** Full referrer URL, or '' for a direct visit. */
  Referrer: string;
  /** Just the referrer's host, for grouping. */
  Ref: string;
  Utm: Record<string, string>;
}

export type SourceKind = "ai" | "search" | "social" | "mail" | "referral" | "direct";

/** Where the visit came from, resolved server-side from the referrer + query tags. */
export interface SessionSource {
  Name: string;
  /** 'ai' means an assistant sent them: the one worth watching on its own. */
  Kind: SourceKind;
}

export interface SessionDevice {
  Type: "phone" | "tablet" | "desktop";
  OS: string;
  Browser: string;
  Screen: string;
  Viewport: string;
  Language: string;
  Theme: "dark" | "light";
  Timezone: string;
  /** The visitor's own wall clock when they arrived, e.g. "23:41". */
  LocalTime: string;
  Touch: boolean;
}

export interface SessionProject {
  Ms: number;
  Opens: number;
  Live: number;
  Github: number;
  Download: number;
}

export interface SessionSocial {
  Clicks: number;
  AwayMs: number;
}

export interface SessionContact {
  Opens: number;
  /** Last tab they were on: the furthest step of the funnel they reached. */
  Tab: string;
  /** What they sent: 'message', or 'meeting' when a call was booked. */
  Sent: string;
}

export interface SessionDoc {
  Id: string;
  /** Stable per-browser id. Lets the server tell a first visit from a return. */
  Visitor: string;
  /** 1 for a first-time visitor, 2 for their second visit, and so on. */
  Visit: number;
  /** Highest flush number applied. Anything at or below it is a replay: dropped. */
  Seq: number;
  StartedAt: number;
  LastSeenAt: number;
  EndedAt: number | null;
  Ended: boolean;
  /** Wall-clock time the tab was open. */
  OpenMs: number;
  /** Tab visible AND the visitor was doing something. The honest number. */
  ActiveMs: number;
  IdleMs: number;
  Link: SessionLink | null;
  Entry: SessionEntry;
  Source: SessionSource;
  Exit: { Section: string };
  Device: SessionDevice;
  Geo: { Country: string; Code: string };
  Sections: Record<string, number>;
  Scroll: Record<string, number>;
  Projects: Record<string, SessionProject>;
  Socials: Record<string, SessionSocial>;
  Cv: { Opens: number };
  Contact: SessionContact;
  Copies: number;
  Rage: number;
  Prints: number;
  Perf: { LoadMs: number; LcpMs: number };
  Events: SessionEvent[];
  /** True when the timeline hit its cap and stopped appending. */
  EventsCut: boolean;
  Flushes: number;
  /** Set when the visit came from the owner's own browser - hidden by default. */
  Owner: boolean;
  /** Set on rows rebuilt from the pre-rewrite blobs. */
  Legacy: boolean;
}

/** `Analytics/Days/Items/{YYYY-MM-DD}` - one rollup per day. */
export interface DayDoc {
  Sessions: number;
  Visitors: number;
  Returning: number;
  ActiveMs: number;
  Projects: number;
  Socials: number;
  Contacts: number;
  Cv: number;
  LinkOpens: number;
  Countries: Record<string, number>;
  Devices: Record<string, number>;
}

/** `Analytics/Totals` - the lifetime counters. */
export interface TotalsDoc {
  Sessions: number;
  /** Distinct people: one per visitor's first visit, ever. */
  Visitors: number;
  /** Visits by someone who had been here before. Never a new person. */
  Returning: number;
  Events: number;
  Projects: number;
  Socials: number;
  Contacts: number;
  Cv: number;
  LinkOpens: number;
  LastAt: number;
}

/** What the site does differently for someone arriving on a specific link. */
export interface LinkTailor {
  /** Pops the CV open once the hero finishes - the old "Interviewer mode". */
  AutoCv: boolean;
  /** Shown in place of the default hero line. Empty = no override. */
  Greeting: string;
  /** Project ids to float to the top of the grid. */
  Pinned: string[];
}

export const EMPTY_TAILOR: LinkTailor = { AutoCv: false, Greeting: "", Pinned: [] };

/** `Analytics/Links/Items/{id}` - the link itself plus how it has been used. */
export interface LinkDoc {
  Code: string;
  Name: string;
  For: string;
  Created: number;
  Opens: number;
  Sessions: number;
  LastOpenAt: number | null;
  /** Email me the moment somebody opens this one. Defaults on. */
  Notify: boolean;
  Tailor: LinkTailor;
}

/** `Analytics/Socials/Items/{name}`. One document per network, canonical name. */
export interface SocialStatsDoc {
  Clicks: number;
  AwayMs: number;
  LastAt: number | null;
}

/** Human labels for the timeline. Keep in step with EventKind. */
export const EVENT_LABEL: Record<EventKind, string> = {
  section: "Moved to",
  project: "Opened project",
  project_end: "Closed project",
  out: "Followed link",
  social: "Left for",
  social_back: "Came back from",
  cv: "Opened the CV",
  contact: "Opened contact",
  contact_tab: "Switched to",
  contact_sent: "Submitted",
  copy: "Copied",
  scroll: "Read down to",
  idle: "Went idle",
  wake: "Came back",
  hide: "Left the tab",
  show: "Returned to the tab",
  rage: "Clicked something dead",
  print: "Printed the page",
  end: "Left",
};

/**
 * What a visit sent, in words. The two booking paths are kept apart on purpose: a
 * booking made in the contact modal is a detour from the portfolio, one made on the
 * booking page is a purpose for arriving.
 */
export function sentLabel(sent: string): string {
  if (sent === "book") return "booked on the booking page";
  if (sent === "meeting") return "booked a call";
  return "sent a message";
}

/** Format a duration the way the dashboard shows it everywhere. */
export function formatMs(ms: number): string {
  const n = Math.max(0, Math.round(ms || 0));
  if (n < 1000) return `${n}ms`;
  const s = n / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  const rest = Math.round(s % 60);
  if (m < 60) return rest ? `${m}m ${rest}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}