// Analytics types (replaces the old lib/analytics/types).
// Field names/casing match exactly what dashboard/D-Trails + M-Story read.

export interface TotalsDoc {
  Sessions?: number;
  Visitors?: number;
  LinkOpens?: number;
  Contacts?: number;
}

export interface LinkDoc {
  Code: string;
  Name: string;
  For: string;
  Created: number;
  Opens: number;
  Sessions: number;
  LastOpenAt: number | null;
  Notify?: boolean;
  Tailor: { AutoCv: boolean; Greeting: string; Pinned: string[] };
}

export interface SessionEvent {
  k: string;
  v?: string;
  t: number;
}

export interface SessionDoc {
  Id: string;
  StartedAt: number;
  LastSeenAt: number;
  Ended: boolean;
  ActiveMs: number;
  OpenMs: number;
  IdleMs: number;
  Owner: boolean;
  Visit: number;
  Legacy: boolean;
  EventsCut: boolean;
  Geo: { Country: string; Code: string };
  Device: {
    Type: string;
    Browser: string;
    OS: string;
    LocalTime: string;
    Timezone: string;
    Screen: string;
    Viewport: string;
    Language: string;
    Theme: string;
  };
  Link: { Id: string; Name: string; For: string };
  Entry: { Ref: string; Section: string; Utm: Record<string, string> };
  Source: { Name: string };
  Exit: { Section: string };
  Contact: { Opens: number; Sent: string };
  Cv: { Opens: number };
  Projects: Record<string, { Ms: number; Opens: number; Live: number; Github: number; Download: number }>;
  Socials: Record<string, { Clicks: number; AwayMs: number }>;
  Sections: Record<string, number>;
  Scroll: Record<string, number>;
  Events: SessionEvent[];
  Rage: number;
  Copies: number;
  Prints: number;
  Flushes: number;
  Perf: { LoadMs: number; LcpMs: number };
}

export const EVENT_LABEL: Record<string, string> = {
  out: "Left the site",
  scroll: "Scrolled",
  rage: "Rage click",
  copy: "Copied text",
  view: "Viewed section",
  click: "Clicked",
  contact: "Opened contact",
  cv: "Opened CV",
  project: "Viewed project",
  social: "Clicked social",
  dead: "Dead click",
  text: "Selected text",
};

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
