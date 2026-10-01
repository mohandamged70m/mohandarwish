/**
 * The visit recorder.
 *
 * Buffers everything in memory and POSTs numbered deltas to /api/track - on start,
 * every FLUSH_MS while something has actually happened, when the tab is hidden, and
 * once more on the way out. Nothing here writes analytics: the route holds the only
 * pen, and it adds our deltas rather than replacing a snapshot with whatever the
 * tab happened to hold.
 *
 * Deltas rather than snapshots: counters ship as "what changed since flush N" and
 * the server increments them, so two flushes racing cannot overwrite each other.
 * Values that are a state rather than a tally (the section they are on now, how far
 * they have read) ship absolute and the server just sets them.
 *
 * Every flush carries `seq`, counting up from 1 for the visit. The server drops
 * anything at or below the last number it applied, so a retry, a double-tap on a
 * reload, or a flush that lands twice over a flaky connection is counted once. That
 * is the whole reason this file carries a sequence number: without it the client
 * had to guess whether its own write landed.
 */

import type { EventKind, LinkTailor, SessionEvent } from "@/lib/analytics-types";

const ENDPOINT = "/api/track";

/** How often to ship a dirty buffer. */
const FLUSH_MS = 20_000;
/** No input for this long and the clock stops - an open tab is not attention. */
const IDLE_MS = 60_000;
/** A tab reopened after this gap is a new visit, not a continuation. */
const SESSION_GAP_MS = 30 * 60_000;
/** Timeline cap. ~500 events is a very busy visit and still a small document. */
const MAX_EVENTS = 500;
/** Per-visit flush ceiling, matching the server's. Stops a stuck tab writing forever. */
const MAX_FLUSHES = 300;
/** Scroll milestones worth recording, in percent. */
const SCROLL_STEPS = [25, 50, 75, 100];

const SID_KEY = "trails_sid";
const SID_AT_KEY = "trails_sid_at";
/** The last flush number sent for the tab's visit (see start()). */
const SEQ_KEY = "trails_sid_seq";
/** Set once the server has accepted the visit's opening (`hello`). */
const HELLO_KEY = "trails_sid_hello";
const VID_KEY = "trails_vid";
const VISITS_KEY = "trails_visits";

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/;
const PHONE_RE = /(?:\+?\d[\d\s()-]{7,}\d)/;
const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|preview|monitor|scrape|curl|wget|python-requests|axios|node-fetch/i;

interface ProjectDelta {
  opens: number;
  ms: number;
  live: number;
  github: number;
  download: number;
}
interface SocialDelta {
  clicks: number;
  awayMs: number;
}

interface Buffer {
  openMs: number;
  activeMs: number;
  idleMs: number;
  sections: Record<string, number>;
  projects: Record<string, ProjectDelta>;
  socials: Record<string, SocialDelta>;
  cvOpens: number;
  contactOpens: number;
  copies: number;
  rage: number;
  prints: number;
  events: SessionEvent[];
}

/**
 * Fold a buffer whose flush was refused back into the live one, so the next flush
 * carries it. The server never applied it (it only applies a flush it answered OK),
 * so nothing is counted twice.
 */
function mergeInto(into: Buffer, lost: Buffer): void {
  into.openMs += lost.openMs;
  into.activeMs += lost.activeMs;
  into.idleMs += lost.idleMs;
  for (const [k, v] of Object.entries(lost.sections)) into.sections[k] = (into.sections[k] || 0) + v;
  for (const [k, v] of Object.entries(lost.projects)) {
    const p = into.projects[k] || (into.projects[k] = { opens: 0, ms: 0, live: 0, github: 0, download: 0 });
    p.opens += v.opens;
    p.ms += v.ms;
    p.live += v.live;
    p.github += v.github;
    p.download += v.download;
  }
  for (const [k, v] of Object.entries(lost.socials)) {
    const s = into.socials[k] || (into.socials[k] = { clicks: 0, awayMs: 0 });
    s.clicks += v.clicks;
    s.awayMs += v.awayMs;
  }
  into.cvOpens += lost.cvOpens;
  into.contactOpens += lost.contactOpens;
  into.copies += lost.copies;
  into.rage += lost.rage;
  into.prints += lost.prints;
  into.events = [...lost.events, ...into.events].slice(0, MAX_EVENTS);
}

const emptyBuffer = (): Buffer => ({
  openMs: 0,
  activeMs: 0,
  idleMs: 0,
  sections: {},
  projects: {},
  socials: {},
  cvOpens: 0,
  contactOpens: 0,
  copies: 0,
  rage: 0,
  prints: 0,
  events: [],
});

const safeLocal = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode - the visit still records, it just won't be recognised next time */
    }
  },
};
const safeSession = {
  get(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* see above */
    }
  },
  remove(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* private mode - nothing was stored */
    }
  },
};

const rand = (n: number): string => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(n);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < n; i++) out += chars[bytes[i] % chars.length];
    return out;
  }
  for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

/** Read the browser well enough to tell one visitor from another at a glance. */
function readDevice(): Record<string, unknown> {
  const ua = navigator.userAgent;
  const mobile = /Mobi|Android|iPhone|iPod/i.test(ua);
  const tablet = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobi/i.test(ua));

  let os = "Unknown";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Linux/.test(ua)) os = "Linux";

  // Order matters: Edge and Opera both claim Chrome, Chrome claims Safari.
  let browser = "Unknown";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua)) browser = "Safari";

  const now = new Date();
  return {
    Type: tablet ? "tablet" : mobile ? "phone" : "desktop",
    OS: os,
    Browser: browser,
    Screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    Viewport: `${window.innerWidth}x${window.innerHeight}`,
    Language: navigator.language || "",
    Theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
    Timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    LocalTime: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    Touch: (navigator.maxTouchPoints || 0) > 0,
  };
}

function readEntry(section: string): Record<string, unknown> {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((k) => {
    const v = params.get(k);
    if (v) utm[k.replace("utm_", "")] = v.slice(0, 80);
  });
  // Not everyone tags a link the same way. A bare ?ref= or ?source= is common, and
  // an ad click often carries nothing BUT its click id - which still says who sent
  // them. Collected raw; the server is what decides any of it means.
  ["ref", "source", "gclid", "fbclid"].forEach((k) => {
    const v = params.get(k);
    if (v && !utm[k]) utm[k] = v.slice(0, 80);
  });

  let ref = "";
  try {
    if (document.referrer) {
      const host = new URL(document.referrer).hostname;
      // Bouncing between our own pages is not a referral.
      if (host && host !== window.location.hostname) ref = host;
    }
  } catch {
    /* malformed referrer - leave it blank */
  }

  return {
    Section: section,
    Path: window.location.pathname.slice(0, 200),
    Referrer: (document.referrer || "").slice(0, 300),
    Ref: ref,
    Utm: utm,
  };
}

/** Obvious non-humans. Most never run JS at all; this catches the ones that do. */
function looksAutomated(): boolean {
  try {
    if (navigator.webdriver) return true;
    if (BOT_RE.test(navigator.userAgent)) return true;
    // A real browser reports at least one language and a non-zero screen.
    if (!navigator.languages || navigator.languages.length === 0) return true;
    if (!window.screen || window.screen.width === 0) return true;
  } catch {
    /* if we can't tell, assume human */
  }
  return false;
}

export interface CollectorOptions {
  /** The section the visit started in. */
  section: string;
  /** The share-link code, when the visit arrived through one. */
  code?: string;
  /** Re-checked before every flush, so a tab that becomes the owner's is caught. */
  isOwner?: () => boolean;
  onTailor?: (tailor: LinkTailor, link: { Name: string; For: string } | null) => void;
}

class Collector {
  private started = false;
  private stopped = false;
  private sessionId = "";
  private visitorId = "";
  private visit = 1;
  private startedAt = 0;

  private buf: Buffer = emptyBuffer();
  private seq = 0;
  private dirty = false;
  private sentFinal = false;
  private inFlight: Promise<unknown> | null = null;

  private section = "home";
  private scrollMax: Record<string, number> = {};
  private scrollSent: Record<string, number> = {};
  private openProject: string | null = null;
  private openProjectAt = 0;
  private awaySocial: string | null = null;
  private awaySocialAt = 0;
  private contactTab = "";
  private contactSent = "";
  private perf: { LoadMs: number; LcpMs: number } | null = null;

  private lastTick = 0;
  private lastInput = 0;
  private idle = false;
  private hidden = false;

  private timer: ReturnType<typeof setInterval> | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private teardown: Array<() => void> = [];

  /** Whether the server has the visit's opening (device, entry, share-link code). */
  private helloAcked = false;
  /** The link code from the URL, resolved server-side on the first flush. */
  private code = "";
  private isOwner: () => boolean = () => false;
  private onTailor?: CollectorOptions["onTailor"];

  isRunning(): boolean {
    return this.started && !this.stopped;
  }
  id(): string {
    return this.sessionId;
  }
  visitNumber(): number {
    return this.visit;
  }

  start(opts: CollectorOptions): void {
    if (this.started || typeof window === "undefined") return;
    if (looksAutomated()) return;

    this.started = true;
    this.section = opts.section;
    this.code = opts.code || "";
    this.isOwner = opts.isOwner || (() => false);
    this.onTailor = opts.onTailor;

    const now = Date.now();

    // Resume the tab's visit unless it has been sitting untouched long enough that
    // coming back is really a new one.
    const prevId = safeSession.get(SID_KEY);
    const prevAt = Number(safeSession.get(SID_AT_KEY) || 0);
    const resumable = prevId && prevAt && now - prevAt < SESSION_GAP_MS;

    this.sessionId = resumable ? prevId : `${now.toString(36)}-${rand(8)}`;
    this.startedAt = resumable ? prevAt : now;
    safeSession.set(SID_KEY, this.sessionId);
    safeSession.set(SID_AT_KEY, String(this.startedAt));
    // A resumed visit carries on from its last flush number. The server drops any
    // flush numbered at or below the last it applied, so a fresh page (a reload, or
    // moving between / and a modal) that restarted at 1 lost everything it recorded
    // until its count caught up with the page before it.
    this.seq = resumable ? Number(safeSession.get(SEQ_KEY) || 0) || 0 : 0;
    safeSession.set(SEQ_KEY, String(this.seq));
    this.helloAcked = resumable ? safeSession.get(HELLO_KEY) === "1" : false;
    safeSession.set(HELLO_KEY, this.helloAcked ? "1" : "0");

    this.visitorId = safeLocal.get(VID_KEY) || `v-${rand(12)}`;
    safeLocal.set(VID_KEY, this.visitorId);
    if (!resumable) {
      this.visit = Number(safeLocal.get(VISITS_KEY) || 0) + 1;
      safeLocal.set(VISITS_KEY, String(this.visit));
    } else {
      this.visit = Number(safeLocal.get(VISITS_KEY) || 1);
    }

    this.lastTick = now;
    this.lastInput = now;
    this.hidden = document.visibilityState === "hidden";

    this.attach();
    this.ticker = setInterval(() => this.tick(), 1000);
    this.timer = setInterval(() => {
      if (this.dirty) this.flush(false);
    }, FLUSH_MS);

    this.push("section", this.section);
    // Go out immediately rather than waiting for the first interval: a link visit
    // needs its tailoring back before the hero finishes, and the open notification
    // is worth nothing twenty seconds late.
    this.flush(false, true);
  }

  stop(): void {
    if (!this.started || this.stopped) return;
    this.stopped = true;
    this.flush(true, true, this.isOwner());
    this.detach();
    // The visit is over: drop the resume keys so the next page starts a new one
    // rather than continuing a session that already reported itself ended.
    safeSession.remove(HELLO_KEY);
  }

  // ── what the app tells us ────────────────────────────────────────────
  setSection(next: string): void {
    if (!this.isRunning() || next === this.section) return;
    this.tick(); // bank the time under the old section first
    this.section = next;
    this.push("section", next);
  }

  projectOpen(id: string): void {
    if (!this.isRunning() || !id) return;
    this.closeProject();
    this.openProject = id;
    this.openProjectAt = Date.now();
    this.project(id).opens += 1;
    this.push("project", id);
  }

  projectClose(): void {
    if (!this.isRunning()) return;
    const id = this.openProject;
    this.closeProject();
    if (id) this.push("project_end", id);
  }

  projectOutbound(id: string, kind: "live" | "github" | "download"): void {
    if (!this.isRunning() || !id) return;
    this.project(id)[kind] += 1;
    this.push("out", `${id}:${kind}`);
  }

  socialClick(name: string): void {
    if (!this.isRunning() || !name) return;
    this.social(name).clicks += 1;
    this.awaySocial = name;
    this.awaySocialAt = Date.now();
    this.push("social", name);
  }

  socialReturn(name: string, awayMs?: number): void {
    if (!this.isRunning() || !name) return;
    const ms =
      typeof awayMs === "number" && awayMs > 0
        ? awayMs
        : this.awaySocial === name
          ? Date.now() - this.awaySocialAt
          : 0;
    this.social(name).awayMs += Math.min(ms, 60 * 60_000);
    this.awaySocial = null;
    this.push("social_back", name);
  }

  cvOpen(): void {
    if (!this.isRunning()) return;
    this.buf.cvOpens += 1;
    this.push("cv");
  }

  contactOpen(): void {
    if (!this.isRunning()) return;
    this.buf.contactOpens += 1;
    this.push("contact");
  }

  contactTabChange(tab: string): void {
    if (!this.isRunning() || tab === this.contactTab) return;
    this.contactTab = tab;
    this.push("contact_tab", tab);
  }

  /** The end of the funnel: they actually sent something. */
  contactSubmit(kind: "meeting" | "message" | "book"): void {
    if (!this.isRunning()) return;
    this.contactSent = kind;
    this.push("contact_sent", kind);
    this.flush(false, true); // never risk losing this one to a hard close
  }

  /** Test/diagnostic hook: force a flush and wait for it. */
  async flushNow(): Promise<void> {
    this.flush(false, true);
    await this.inFlight;
  }

  // ── internals ────────────────────────────────────────────────────────
  private project(id: string): ProjectDelta {
    const key = id.slice(0, 80);
    if (!this.buf.projects[key]) this.buf.projects[key] = { opens: 0, ms: 0, live: 0, github: 0, download: 0 };
    this.dirty = true;
    return this.buf.projects[key];
  }

  private social(name: string): SocialDelta {
    const key = name.slice(0, 40);
    if (!this.buf.socials[key]) this.buf.socials[key] = { clicks: 0, awayMs: 0 };
    this.dirty = true;
    return this.buf.socials[key];
  }

  private closeProject(): void {
    if (!this.openProject) return;
    const ms = Date.now() - this.openProjectAt;
    if (ms > 0) this.project(this.openProject).ms += Math.min(ms, 60 * 60_000);
    this.openProject = null;
  }

  private push(k: EventKind, v?: string): void {
    if (this.buf.events.length >= MAX_EVENTS) return;
    this.buf.events.push({
      t: Math.max(0, Date.now() - this.startedAt),
      k,
      ...(v ? { v: v.slice(0, 120) } : {}),
    });
    this.dirty = true;
  }

  /** One second of wall clock, split between open / active / idle. */
  private tick(): void {
    if (!this.isRunning()) return;
    const now = Date.now();
    const delta = Math.min(now - this.lastTick, 5000); // a slept laptop is not attention
    this.lastTick = now;
    if (delta <= 0) return;

    this.buf.openMs += delta;

    const wasIdle = this.idle;
    this.idle = now - this.lastInput > IDLE_MS;
    if (this.idle && !wasIdle) this.push("idle");
    if (!this.idle && wasIdle) this.push("wake");

    if (this.idle || this.hidden) {
      this.buf.idleMs += delta;
      // Someone still in front of the page counts as present even with the input
      // clock stopped - reading is precisely when nobody touches the mouse. Without
      // this the flush timer (which only fires on a dirty buffer) went quiet after a
      // minute, LastSeenAt froze, and a reader dropped out of "Reading now" while
      // they were still reading. A HIDDEN tab is genuinely nobody, so it stays silent
      // and correctly leaves the live list.
      if (!this.hidden) this.dirty = true;
      return;
    }

    this.buf.activeMs += delta;
    this.buf.sections[this.section] = (this.buf.sections[this.section] || 0) + delta;
    if (this.openProject) {
      this.project(this.openProject).ms += delta;
      this.openProjectAt = now; // already banked, don't double-count on close
    }
    this.dirty = true;
    safeSession.set(SID_AT_KEY, String(this.startedAt));
  }

  private attach(): void {
    const on = (
      target: EventTarget,
      type: string,
      fn: EventListenerOrEventListenerObject,
      opts?: AddEventListenerOptions
    ) => {
      target.addEventListener(type, fn, opts);
      this.teardown.push(() => target.removeEventListener(type, fn, opts));
    };

    const markInput = () => {
      this.lastInput = Date.now();
    };
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach((t) => on(window, t, markInput, { passive: true }));

    // Pointer moves are the noisiest signal on the page - sample them.
    let moveGate = 0;
    on(
      window,
      "pointermove",
      () => {
        const now = Date.now();
        if (now - moveGate < 2000) return;
        moveGate = now;
        this.lastInput = now;
      },
      { passive: true }
    );

    on(document, "visibilitychange", () => {
      const hidden = document.visibilityState === "hidden";
      if (hidden === this.hidden) return;
      this.tick();
      this.hidden = hidden;
      this.push(hidden ? "hide" : "show");
      // Hiding is the most reliable "they're leaving" signal mobile gives us.
      if (hidden) this.flush(false);
      else this.lastInput = Date.now();
    });

    // Capture phase so this also sees the app's inner scroll containers, which are
    // what actually scroll on desktop.
    on(
      document,
      "scroll",
      (e: Event) => {
        this.lastInput = Date.now();
        this.trackScroll(e.target);
      },
      { passive: true, capture: true } as AddEventListenerOptions
    );

    on(document, "copy", () => {
      let text = "";
      try {
        text = String(window.getSelection() || "").trim();
      } catch {
        /* nothing selected we can read */
      }
      if (!text) return;
      this.buf.copies += 1;
      const what = EMAIL_RE.test(text) ? "email" : PHONE_RE.test(text) ? "phone" : "text";
      this.push("copy", what);
    });

    on(window, "beforeprint", () => {
      this.buf.prints += 1;
      this.push("print");
    });

    // Frustration: three fast clicks in the same spot, or a click on something that
    // only looks clickable.
    const clicks: Array<{ t: number; x: number; y: number }> = [];
    on(
      window,
      "click",
      (e: Event) => {
        const ev = e as MouseEvent;
        const now = Date.now();
        clicks.push({ t: now, x: ev.clientX, y: ev.clientY });
        while (clicks.length && now - clicks[0].t > 800) clicks.shift();
        if (clicks.length >= 3) {
          const near = clicks.every((c) => Math.abs(c.x - ev.clientX) < 40 && Math.abs(c.y - ev.clientY) < 40);
          if (near) {
            clicks.length = 0;
            this.buf.rage += 1;
            this.push("rage", "rapid");
            return;
          }
        }
        const el = ev.target as Element | null;
        const interactive = el?.closest?.(
          'a,button,input,select,textarea,label,summary,[role="button"],[role="link"],[role="tab"],[tabindex],[contenteditable]'
        );
        if (!interactive) {
          this.buf.rage += 1;
          this.push("rage", "dead");
        }
      },
      { passive: true }
    );

    const leave = () => this.flush(true, true);
    on(window, "pagehide", leave);
    on(window, "beforeunload", leave);

    this.readPerf();
  }

  private detach(): void {
    this.teardown.forEach((fn) => {
      try {
        fn();
      } catch {
        /* listener already gone */
      }
    });
    this.teardown = [];
    if (this.timer) clearInterval(this.timer);
    if (this.ticker) clearInterval(this.ticker);
    this.timer = null;
    this.ticker = null;
  }

  private trackScroll(target: EventTarget | null): void {
    let top = 0;
    let height = 0;
    let client = 0;
    if (!target || target === document || target === document.documentElement || target === window) {
      const el = document.scrollingElement || document.documentElement;
      top = el.scrollTop;
      height = el.scrollHeight;
      client = el.clientHeight;
    } else if (target instanceof Element) {
      top = target.scrollTop;
      height = target.scrollHeight;
      client = target.clientHeight;
    }
    const scrollable = height - client;
    if (scrollable < 80) return; // not a real scroll surface

    const pct = Math.min(100, Math.round(((top + client) / height) * 100));
    const key = this.section;
    if (pct <= (this.scrollMax[key] || 0)) return;
    this.scrollMax[key] = pct;
    this.dirty = true;

    // Only the milestones make the timeline; the exact maximum still ships.
    const step = SCROLL_STEPS.filter((s) => pct >= s).pop();
    if (step && step > (this.scrollSent[key] || 0)) {
      this.scrollSent[key] = step;
      this.push("scroll", `${key}:${step}`);
    }
  }

  private readPerf(): void {
    try {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const loadMs = nav ? Math.round(nav.duration) : 0;
      this.perf = { LoadMs: loadMs, LcpMs: 0 };
      if (typeof PerformanceObserver === "undefined") return;
      const po = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last && this.perf) {
          this.perf.LcpMs = Math.round(last.startTime);
          this.dirty = true;
        }
      });
      po.observe({ type: "largest-contentful-paint", buffered: true });
      this.teardown.push(() => po.disconnect());
    } catch {
      /* not supported here - perf just stays empty */
    }
  }

  // ── shipping ─────────────────────────────────────────────────────────
  private flush(final: boolean, force = false, owner = false): void {
    if (!this.started) return;
    if (final && this.sentFinal) return; // pagehide and beforeunload both fire
    if (!force && !this.dirty) return;
    if (this.seq >= MAX_FLUSHES) return;
    if (final) this.sentFinal = true;

    this.tick();
    this.closeProject();

    const buf = this.buf;
    this.buf = emptyBuffer();
    this.dirty = false;
    this.seq += 1;
    safeSession.set(SEQ_KEY, String(this.seq));

    const body: Record<string, unknown> = {
      v: 2,
      id: this.sessionId,
      seq: this.seq,
      visitor: this.visitorId,
      visit: this.visit,
      add: {
        openMs: Math.round(buf.openMs),
        activeMs: Math.round(buf.activeMs),
        idleMs: Math.round(buf.idleMs),
        sections: buf.sections,
        projects: buf.projects,
        socials: buf.socials,
        cvOpens: buf.cvOpens,
        contactOpens: buf.contactOpens,
        copies: buf.copies,
        rage: buf.rage,
        prints: buf.prints,
      },
      set: {
        exitSection: this.section,
        scroll: this.scrollMax,
        contactTab: this.contactTab,
        contactSent: this.contactSent,
        ...(this.perf ? { perf: this.perf } : {}),
      },
      events: buf.events,
    };

    // The opening details ride along until the server confirms it has them. They used
    // to go on flush 1 only: when that one was refused, the visit was still recorded
    // from flush 2 on, but with no device, no entry and no share-link code, so a link
    // visit turned up as an anonymous one and the link never counted the open.
    if (!this.helloAcked) {
      body.hello = {
        startedAt: this.startedAt,
        entry: readEntry(this.section),
        device: readDevice(),
        ...(this.code ? { code: this.code } : {}),
      };
    }
    if (final) body.end = true;
    if (owner || this.isOwner()) body.owner = true;

    const send = () => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      return fetch(ENDPOINT, { method: "POST", headers, body: JSON.stringify(body), keepalive: true })
        .then((r) => {
          if (r.ok) {
            if (body.hello) {
              this.helloAcked = true;
              safeSession.set(HELLO_KEY, "1");
            }
            return r.json();
          }
          // Refused (a 5xx, a dropped connection): keep what it carried for the next
          // flush. A 409 means the visit itself is gone server-side; drop it.
          if (r.status !== 409 && r.status !== 429 && !final) {
            mergeInto(this.buf, buf);
            this.dirty = true;
          }
          return null;
        })
        .then(
          (data: { tailor?: LinkTailor; link?: { Name: string; For: string } } | null) => {
            if (data?.tailor && this.onTailor) this.onTailor(data.tailor, data.link || null);
          }
        )
        .catch(() => {
          // Offline: the same as a refusal, the next flush carries it.
          if (!final) {
            mergeInto(this.buf, buf);
            this.dirty = true;
          }
        });
    };

    this.inFlight = send();
  }
}

export const analytics = new Collector();