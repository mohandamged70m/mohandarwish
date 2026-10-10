/**
 * The visit recorder.
 *
 * Buffers everything in memory and POSTs immutable numbered batches to
 * /api/track - on start, every FLUSH_MS while something happened, when the
 * tab hides, and once more on the way out.
 *
 * Transport (fixes the old double-count / drop races):
 * - Every flush is an immutable batch {seq, batchId, payload}. A failed
 *   batch is retried with the SAME seq+batchId; new data always goes into a
 *   NEW batch. The server dedupes by batchId and drops seq replays, so a
 *   committed request whose response was lost can never double-count, and
 *   concurrent requests cannot silently drop an earlier delta.
 * - Delivery is serialized (one request in flight) with bounded backoff.
 * - hello is acked only by the server's {ok, hello:true} — never by HTTP 200
 *   alone. Opening entry/device/UTM metadata is captured once and immutable.
 */

import type { EventKind, LinkTailor, SessionEvent } from "@/lib/analytics-types";

const ENDPOINT = "/api/track";

/** How often to ship a dirty buffer. */
const FLUSH_MS = 20_000;
/** No input for this long and the clock stops - an open tab is not attention. */
const IDLE_MS = 60_000;
/** Gap of inactivity after which coming back is a new visit, not a continuation. */
const SESSION_GAP_MS = 30 * 60_000;
/** Timeline cap. ~500 events is a very busy visit and still a small document. */
const MAX_EVENTS = 500;
/** Per-visit flush ceiling, matching the server's. Stops a stuck tab writing forever. */
const MAX_FLUSHES = 300;
/** Scroll milestones worth recording, in percent. */
const SCROLL_STEPS = [25, 50, 75, 100];
/** keepalive bodies must stay small; trim events before crossing this. */
const MAX_BODY_BYTES = 55_000;
/** Persisted outbox: at most this many unsent batches survive a reload. */
const MAX_QUEUED_BATCHES = 5;

const SID_KEY = "trails_sid";
const SID_START_KEY = "trails_sid_start";
const SID_ACTIVE_KEY = "trails_sid_at";
/** The last flush number sent for the tab's visit (see start()). */
const SEQ_KEY = "trails_sid_seq";
/** The visit's current share-link code (for link A -> link B switching). */
const SID_CODE_KEY = "trails_sid_code";
/** Set once the server has accepted the visit's opening (`hello`). */
const HELLO_KEY = "trails_sid_hello";
/** Set once a final `end` batch was acked: the visit must not resume. */
const ENDED_KEY = "trails_sid_ended";
const VID_KEY = "trails_vid";
const VISITS_KEY = "trails_visits";
const LINK_KEY = "trails_link";
const LINK_AT_KEY = "trails_link_at";
const QUEUE_KEY = "trails_queue";

const BOT_RE =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|preview|monitor|scrape|curl|wget|python-requests|axios|node-fetch/i;

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

interface PendingBatch {
  seq: number;
  batchId: string;
  body: Record<string, unknown>;
  tries: number;
  nextAt: number;
}

type Dict = Record<string, unknown>;

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
  for (let i = 0; i < n; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};
const batchIdOf = (): string => {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto)
      return crypto.randomUUID().replace(/[^a-z0-9-]/gi, "").slice(0, 36).toLowerCase();
  } catch {
    /* fall through */
  }
  return `b-${Date.now().toString(36)}-${rand(10)}`;
};

/** Read the browser well enough to tell one visitor from another at a glance. */
function readDevice(): Record<string, unknown> {
  const ua = navigator.userAgent;
  const mobile = /Mobi|Android|iPhone|iPod/i.test(ua);
  const tablet =
    /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobi/i.test(ua));

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
  // Prefer the landing page's preserved query string: the share-link redirect
  // replaces the URL with `/`, so reading location.search here alone would
  // lose the original campaign metadata.
  let search = window.location.search;
  let storedReferrer = "";
  try {
    const raw = sessionStorage.getItem("trails_entry");
    if (raw) {
      const o = JSON.parse(raw) as { search?: unknown; referrer?: unknown };
      if (typeof o.search === "string" && o.search) search = o.search;
      if (typeof o.referrer === "string") storedReferrer = o.referrer;
    }
  } catch {
    /* backup unreadable - fall back to the live URL */
  }
  const params = new URLSearchParams(search);
  const utm: Record<string, string> = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach(
    (k) => {
      const v = params.get(k);
      if (v) utm[k.replace("utm_", "")] = v.slice(0, 80);
    },
  );
  ["ref", "source", "gclid", "fbclid"].forEach((k) => {
    const v = params.get(k);
    if (v && !utm[k]) utm[k] = v.slice(0, 80);
  });

  let ref = "";
  let referrer = document.referrer || storedReferrer;
  try {
    if (referrer) {
      const host = new URL(referrer).hostname;
      if (host && host !== window.location.hostname) ref = host;
      // Internal navigation is not an external referral: a same-host
      // referrer must never become a "source" row for our own domain.
      else referrer = "";
    }
  } catch {
    /* malformed referrer - leave it blank */
  }

  return {
    Section: section,
    Path: window.location.pathname.slice(0, 200),
    Referrer: referrer.slice(0, 300),
    Ref: ref,
    Utm: utm,
  };
}

/** Obvious non-humans. Most never run JS at all; this catches the ones that do. */
function looksAutomated(): boolean {
  try {
    if (navigator.webdriver) return true;
    if (BOT_RE.test(navigator.userAgent)) return true;
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
  /** Client hint only; the server resolves ownership authoritatively. */
  isOwner?: () => boolean;
  onTailor?: (
    tailor: LinkTailor,
    link: { Name: string; For: string } | null,
  ) => void;
}

class Collector {
  private started = false;
  private stopped = false;
  private terminal = false;
  private sessionId = "";
  private visitorId = "";
  private visit = 1;
  private startedAt = 0;

  private buf: Buffer = emptyBuffer();
  private seq = 0;
  private dirty = false;
  private queue: PendingBatch[] = [];
  private sending = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

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
  /** Immutable opening metadata, captured once at start. */
  private hello: Record<string, unknown> | null = null;
  /** The link code from the URL, resolved server-side on the first flush. */
  private code = "";
  private isOwner: () => boolean = () => false;
  private onTailor?: CollectorOptions["onTailor"];

  isRunning(): boolean {
    return this.started && !this.stopped && !this.terminal;
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

    const now = Date.now();
    const code = (opts.code || "").slice(0, 120);

    // Link A -> link B in the same tab ends the previous visit's attribution:
    // a new code never inherits the old session.
    const prevCode = safeSession.get(SID_CODE_KEY) || "";
    const prevId = safeSession.get(SID_KEY);
    const prevStart = Number(safeSession.get(SID_START_KEY) || 0);
    const prevActive = Number(safeSession.get(SID_ACTIVE_KEY) || 0);
    const prevEnded = safeSession.get(ENDED_KEY) === "1";
    if (prevCode && code && prevCode !== code && prevId) {
      this.endPreviousVisit(prevId);
    }

    // Resume the tab's visit only when the tab was recently active. The gap
    // is measured against LAST ACTIVITY (not the original start), and an
    // ended visit never resumes.
    const resumable =
      prevId &&
      prevStart > 0 &&
      prevActive > 0 &&
      !prevEnded &&
      now - prevActive < SESSION_GAP_MS &&
      (!prevCode || !code || prevCode === code);

    this.started = true;
    this.section = opts.section;
    this.code = code;
    this.isOwner = opts.isOwner || (() => false);
    this.onTailor = opts.onTailor;

    if (resumable && prevId) {
      this.sessionId = prevId;
      this.startedAt = prevStart;
    } else {
      this.sessionId = `${now.toString(36)}-${rand(8)}`;
      this.startedAt = now;
      safeSession.remove(ENDED_KEY);
    }
    safeSession.set(SID_KEY, this.sessionId);
    safeSession.set(SID_START_KEY, String(this.startedAt));
    safeSession.set(SID_ACTIVE_KEY, String(now));
    safeSession.set(SID_CODE_KEY, code);
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

    // Immutable opening: captured once, retried verbatim until acked.
    if (!this.helloAcked) {
      this.hello = {
        startedAt: this.startedAt,
        entry: readEntry(this.section),
        device: readDevice(),
        ...(code ? { code } : {}),
      };
    }

    this.lastTick = now;
    this.lastInput = now;
    this.hidden = document.visibilityState === "hidden";

    this.restoreQueue();
    this.attach();
    this.ticker = setInterval(() => this.tick(), 1000);
    this.timer = setInterval(() => {
      if (this.dirty) this.enqueue(false);
    }, FLUSH_MS);

    this.push("section", this.section);
    this.enqueue(true);
  }

  stop(): void {
    if (!this.started || this.stopped) return;
    this.stopped = true;
    this.enqueue(true, true);
    this.detach();
    // The visit is over: a later start() must open a new visit rather than
    // continuing one that already reported itself ended.
    safeSession.set(ENDED_KEY, "1");
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
    this.bankProjectTime();
    this.openProject = id;
    this.openProjectAt = Date.now();
    this.project(id).opens += 1;
    this.push("project", id);
  }

  projectClose(): void {
    if (!this.isRunning()) return;
    const id = this.openProject;
    this.bankProjectTime();
    this.openProject = null;
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
    this.enqueue(true); // never risk losing this one to a hard close
  }

  /** Test/diagnostic hook: force a flush and wait for it. */
  async flushNow(): Promise<void> {
    this.enqueue(true);
    await this.drain();
  }

  /**
   * Open a new visit under a different share-link code in the same tab
   * (direct visit -> share link, or link A -> link B). The previous visit is
   * ended honestly via beacon, then a fresh visit starts: a new code never
   * inherits the old session, its greeting, or its events.
   */
  restartWithCode(code: string, section: string): void {
    const clean = (code || "").slice(0, 120);
    if (!this.started || this.terminal) {
      if (!this.started) this.start({ section, code: clean, isOwner: this.isOwner, onTailor: this.onTailor });
      return;
    }
    if (!clean || clean === this.code) return;
    try {
      const body = JSON.stringify({
        v: 2,
        id: this.sessionId,
        seq: this.seq + 1,
        batchId: batchIdOf(),
        visitor: this.visitorId,
        visit: this.visit,
        end: true,
        add: {},
        set: { exitSection: this.section },
        events: [],
      });
      navigator.sendBeacon?.(ENDPOINT, body);
    } catch {
      /* best effort */
    }
    this.detach();
    this.started = false;
    this.stopped = false;
    this.buf = emptyBuffer();
    this.queue = [];
    this.seq = 0;
    this.dirty = false;
    this.sessionId = "";
    this.section = "home";
    this.scrollMax = {};
    this.scrollSent = {};
    this.openProject = null;
    this.openProjectAt = 0;
    this.awaySocial = null;
    this.contactTab = "";
    this.contactSent = "";
    this.perf = null;
    this.helloAcked = false;
    this.hello = null;
    safeSession.remove(SID_KEY);
    safeSession.remove(SID_START_KEY);
    safeSession.remove(SID_ACTIVE_KEY);
    safeSession.remove(SEQ_KEY);
    safeSession.remove(HELLO_KEY);
    safeSession.remove(ENDED_KEY);
    safeSession.remove(QUEUE_KEY);
    this.start({ section, code: clean, isOwner: this.isOwner, onTailor: this.onTailor });
  }

  // ── internals ────────────────────────────────────────────────────────
  private project(id: string): ProjectDelta {
    const key = id.slice(0, 80);
    if (!this.buf.projects[key])
      this.buf.projects[key] = { opens: 0, ms: 0, live: 0, github: 0, download: 0 };
    this.dirty = true;
    return this.buf.projects[key];
  }

  private social(name: string): SocialDelta {
    const key = name.slice(0, 40);
    if (!this.buf.socials[key]) this.buf.socials[key] = { clicks: 0, awayMs: 0 };
    this.dirty = true;
    return this.buf.socials[key];
  }

  /**
   * Bank the open project's elapsed time WITHOUT closing it, so a routine
   * flush does not stop the clock. Idle/hidden stretches are never counted
   * as engagement: only active visible time accrues.
   */
  private bankProjectTime(): void {
    if (!this.openProject) return;
    const now = Date.now();
    const elapsed = now - this.openProjectAt;
    this.openProjectAt = now;
    if (elapsed <= 0) return;
    if (this.idle || this.hidden) return;
    this.project(this.openProject).ms += Math.min(elapsed, 60 * 60_000);
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
      if (!this.hidden) this.dirty = true;
      safeSession.set(SID_ACTIVE_KEY, String(now));
      return;
    }

    this.buf.activeMs += delta;
    this.buf.sections[this.section] = (this.buf.sections[this.section] || 0) + delta;
    if (this.openProject) {
      this.project(this.openProject).ms += delta;
      this.openProjectAt = now; // already banked, don't double-count on close
    }
    this.dirty = true;
    safeSession.set(SID_ACTIVE_KEY, String(now));
  }

  private attach(): void {
    const on = (
      target: EventTarget,
      type: string,
      fn: EventListenerOrEventListenerObject,
      opts?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, fn, opts);
      this.teardown.push(() => target.removeEventListener(type, fn, opts));
    };

    const markInput = () => {
      this.lastInput = Date.now();
    };
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach((t) =>
      on(window, t, markInput, { passive: true }),
    );

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
      { passive: true },
    );

    on(document, "visibilitychange", () => {
      const hidden = document.visibilityState === "hidden";
      if (hidden === this.hidden) return;
      this.tick();
      this.hidden = hidden;
      this.push(hidden ? "hide" : "show");
      if (hidden) this.enqueue(false);
      else {
        this.lastInput = Date.now();
        // Returning from a social link: measure time away, don't claim it
        // as time spent on that site — only time away from the portfolio.
        if (this.awaySocial) this.socialReturn(this.awaySocial);
      }
    });
    on(window, "focus", () => {
      if (this.awaySocial) this.socialReturn(this.awaySocial);
    });

    on(
      document,
      "scroll",
      (e: Event) => {
        this.lastInput = Date.now();
        this.trackScroll(e.target);
      },
      { passive: true, capture: true } as AddEventListenerOptions,
    );

    on(document, "copy", () => {
      // Count the copy, never the contents: clipboard text is PII.
      let hasText = false;
      try {
        hasText = String(window.getSelection() || "").trim().length > 0;
      } catch {
        hasText = true;
      }
      if (!hasText) return;
      this.buf.copies += 1;
      this.push("copy", "text");
    });

    on(window, "beforeprint", () => {
      this.buf.prints += 1;
      this.push("print");
    });

    // Frustration: three fast clicks in the same spot. Plain clicks on
    // non-interactive content are ordinary reading, not rage.
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
          const near = clicks.every(
            (c) => Math.abs(c.x - ev.clientX) < 40 && Math.abs(c.y - ev.clientY) < 40,
          );
          if (near) {
            clicks.length = 0;
            this.buf.rage += 1;
            this.push("rage", "rapid");
          }
        }
      },
      { passive: true },
    );

    const leave = () => this.enqueue(true, true);
    on(window, "pagehide", leave);
    on(window, "beforeunload", leave);
    // bfcache restore: timers died while frozen; resume the clock without
    // starting a second visit.
    on(window, "pageshow", (e: Event) => {
      if ((e as PageTransitionEvent).persisted) {
        this.lastTick = Date.now();
        this.lastInput = Date.now();
        safeSession.set(SID_ACTIVE_KEY, String(Date.now()));
      }
    });

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
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.timer = null;
    this.ticker = null;
    this.retryTimer = null;
  }

  private trackScroll(target: EventTarget | null): void {
    let top = 0;
    let height = 0;
    let client = 0;
    if (
      !target ||
      target === document ||
      target === document.documentElement ||
      target === window
    ) {
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
    if (scrollable < 80) return;

    const pct = Math.min(100, Math.round(((top + client) / height) * 100));
    const key = this.section;
    if (pct <= (this.scrollMax[key] || 0)) return;
    this.scrollMax[key] = pct;
    this.dirty = true;

    const step = SCROLL_STEPS.filter((s) => pct >= s).pop();
    if (step && step > (this.scrollSent[key] || 0)) {
      this.scrollSent[key] = step;
      this.push("scroll", `${key}:${step}`);
    }
  }

  private readPerf(): void {
    try {
      const nav = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming | undefined;
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

  // ── shipping: immutable batches, serialized, acked ───────────────────
  private endPreviousVisit(prevId: string): void {
    try {
      const body = JSON.stringify({
        v: 2,
        id: prevId,
        seq: Number(safeSession.get(SEQ_KEY) || 0) + 1,
        batchId: batchIdOf(),
        end: true,
        add: {},
        set: {},
        events: [],
      });
      navigator.sendBeacon?.(ENDPOINT, body);
    } catch {
      /* best effort */
    }
  }

  private restoreQueue(): void {
    try {
      const raw = safeSession.get(QUEUE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw) as PendingBatch[];
      if (Array.isArray(arr))
        this.queue = arr
          .filter((b) => b && typeof b.seq === "number" && typeof b.batchId === "string" && b.body)
          .slice(-MAX_QUEUED_BATCHES);
    } catch {
      this.queue = [];
    }
    if (this.queue.length) void this.drain();
  }

  private persistQueue(): void {
    try {
      safeSession.set(QUEUE_KEY, JSON.stringify(this.queue.slice(-MAX_QUEUED_BATCHES)));
    } catch {
      /* storage full - in-memory queue still delivers this tab */
    }
  }

  private enqueue(force: boolean, final = false): void {
    if (!this.started || this.terminal) return;
    if (final && this.queue.some((b) => (b.body as Dict).end === true)) return;
    if (!force && !this.dirty) return;
    if (this.seq >= MAX_FLUSHES) return;

    this.tick();
    // Bank (don't close) so the open project keeps accruing after the flush.
    this.bankProjectTime();

    const buf = this.buf;
    this.buf = emptyBuffer();
    this.dirty = false;
    this.seq += 1;
    safeSession.set(SEQ_KEY, String(this.seq));

    // Trim events so the keepalive body stays deliverable.
    let events = buf.events.slice(0, 120);
    let body: Record<string, unknown> = this.buildBody(buf, events, final);
    while (JSON.stringify(body).length > MAX_BODY_BYTES && events.length > 10) {
      events = events.slice(Math.ceil(events.length / 4));
      body = this.buildBody(buf, events, final);
    }

    this.queue.push({ seq: this.seq, batchId: String(body.batchId), body, tries: 0, nextAt: 0 });
    this.persistQueue();
    void this.drain();
  }

  private buildBody(buf: Buffer, events: SessionEvent[], final: boolean): Record<string, unknown> {
    const body: Record<string, unknown> = {
      v: 2,
      id: this.sessionId,
      seq: this.seq,
      batchId: batchIdOf(),
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
      events,
    };
    if (!this.helloAcked && this.hello) body.hello = this.hello;
    if (final) body.end = true;
    return body;
  }

  private async drain(): Promise<void> {
    if (this.sending || !this.queue.length) return;
    this.sending = true;
    try {
      while (this.queue.length && !this.terminal) {
        const head = this.queue[0];
        if (head.nextAt > Date.now()) break;
        const ok = await this.sendBatch(head);
        if (ok) {
          this.queue.shift();
          this.persistQueue();
        } else {
          this.persistQueue();
          break;
        }
      }
    } finally {
      this.sending = false;
    }
  }

  private async sendBatch(batch: PendingBatch): Promise<boolean> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    let res: Response | null = null;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify(batch.body),
        keepalive: true,
      });
    } catch {
      return this.backoff(batch);
    }

    let data: Dict | null = null;
    try {
      data = (await res.json().catch(() => null)) as Dict | null;
    } catch {
      data = null;
    }

    if (res.ok && data && (data as Dict).ok === true) {
      // The hello code matched no link (deleted/invalid): the visit is kept
      // as a direct one. Clear the stale attribution so the tab cannot
      // inherit a previous link's greeting or events, and keep recording.
      if ((data as Dict).linkDropped === true) {
        try {
          sessionStorage.removeItem(LINK_KEY);
          sessionStorage.removeItem(LINK_AT_KEY);
          sessionStorage.removeItem("trails_entry");
          sessionStorage.removeItem("trails_tailor");
          window.dispatchEvent(new CustomEvent("trails:tailor", { detail: null }));
        } catch {
          /* ignore */
        }
      }
      if ((data as Dict).hello === true && (batch.body as Dict).hello) {
        this.helloAcked = true;
        safeSession.set(HELLO_KEY, "1");
      }
      const tailor = (data as Dict).tailor as LinkTailor | undefined;
      const link = (data as Dict).link as { Name: string; For: string } | undefined;
      if (tailor && this.onTailor) this.onTailor(tailor, link || null);
      if ((batch.body as Dict).end === true) safeSession.set(ENDED_KEY, "1");
      return true;
    }

    // Terminal: drop the batch and stop retrying (expired, unknown, bot, bad).
    const terminal =
      (data as Dict)?.terminal === true ||
      res.status === 400 ||
      res.status === 404 ||
      res.status === 410;
    if (terminal) {
      if (res.status === 404 || (data as Dict)?.reason === "unknown-visit") {
        // Lookup outage must not strand the visit: keep hello for the next session.
        this.helloAcked = false;
        safeSession.set(HELLO_KEY, "0");
      }
      if ((data as Dict)?.reason === "bot" || (data as Dict)?.reason === "expired") {
        this.terminal = true;
      }
      return true; // drop the batch; it will never succeed
    }
    return this.backoff(batch);
  }

  private backoff(batch: PendingBatch): boolean {
    batch.tries += 1;
    if (batch.tries > 8) {
      // Bounded retry: drop the oldest batch rather than growing forever.
      // Newer batches still carry newer state; counters in the dropped batch
      // are lost honestly instead of wedging the whole queue.
      return true;
    }
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(batch.tries, 5));
    batch.nextAt = Date.now() + delay;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => void this.drain(), delay);
    return false;
  }
}

export const analytics = new Collector();
