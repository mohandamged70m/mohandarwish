"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Global Trails tracker: LINK-ONLY — one live session per share-link visit.
// Inits/flushes against /api/track (additive deltas) only once a Trails link
// code is known (URL, sessionStorage backup, or live handoff). Direct visits
// stay fully dormant: no init, no flush, no beacon. Heartbeat keeps
// "Reading now" live, pagehide ends the visit. Never breaks the page.

const SID_KEY = "trails_sid";
const VID_KEY = "trails_vid";
const SESSION_TTL = 30 * 60 * 1000;
const FLUSH_DIRTY_MS = 15_000;
const FLUSH_HEARTBEAT_MS = 45_000;

const SOCIAL_HOSTS = /x\.com|twitter|linkedin|github|facebook|instagram|tiktok|reddit|youtube|medium|dev\.to|producthunt|substack/i;
const KNOWN_SECTIONS = ["hero", "projects-wrap", "about-wrap", "contact-wrap"];

type Event = { k: string; v?: string; t: number };

function rid(n = 12): string {
  try {
    const c = new Uint8Array(n);
    crypto.getRandomValues(c);
    return Array.from(c, (b) => (b % 36).toString(36)).join("");
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.slice(0, n);
  }
}

function detectDevice() {
  try {
    const ua = navigator.userAgent || "";
    const w = window.innerWidth;
    const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const type = w < 640 || (isMobileUA && w < 1024 && /Phone|Android.*Mobile/i.test(ua)) ? "phone" : w < 1024 || /iPad|Tablet/i.test(ua) ? "tablet" : "desktop";
    let browser = "";
    if (/Edg\//.test(ua)) browser = "Edge";
    else if (/Chrome\//.test(ua)) browser = "Chrome";
    else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
    else if (/Firefox\//.test(ua)) browser = "Firefox";
    else if (/OPR\//.test(ua)) browser = "Opera";
    let os = "";
    if (/Windows/.test(ua)) os = "Windows";
    else if (/Mac OS/.test(ua)) os = "macOS";
    else if (/Android/.test(ua)) os = "Android";
    else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
    else if (/Linux/.test(ua)) os = "Linux";
    const d = new Date();
    return {
      Type: type,
      Browser: browser,
      OS: os,
      LocalTime: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      Timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      Screen: `${window.screen.width}x${window.screen.height}`,
      Viewport: `${window.innerWidth}x${window.innerHeight}`,
      Language: navigator.language || "",
      Theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
    };
  } catch {
    return { Type: "", Browser: "", OS: "", LocalTime: "", Timezone: "", Screen: "", Viewport: "", Language: "", Theme: "" };
  }
}

function utmOf(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const q = new URLSearchParams(window.location.search);
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
      const v = q.get(k);
      if (v) out[k] = v;
    }
  } catch { /* ignore */ }
  return out;
}

function isOwner(): boolean {
  try {
    if (localStorage.getItem("dashboard_token")) return true;
    if (/(?:^|;\s*)dashboard_token=/.test(document.cookie)) return true;
    if (new URLSearchParams(window.location.search).get("admin")) return true;
    if (/^(localhost|127\.|192\.168\.|10\.)/.test(window.location.hostname)) return true;
  } catch { /* ignore */ }
  return false;
}

export function TrailsTracker(): null {
  const pathname = usePathname();

  useEffect(() => {
    let dead = false;
    try {
      (window as unknown as { __trails_active?: boolean }).__trails_active = true;

      const start = Date.now();
      const t = (n = Date.now()) => Math.max(0, n - start);

      // --- ids ---
      let sid = "";
      try {
        const raw = localStorage.getItem(SID_KEY);
        if (raw) {
          const o = JSON.parse(raw) as { sid: string; seen: number };
          if (o.sid && Date.now() - o.seen < SESSION_TTL) sid = o.sid;
        }
        if (!sid) sid = rid(16);
        localStorage.setItem(SID_KEY, JSON.stringify({ sid, seen: Date.now() }));
      } catch { sid = rid(16); }
      let vid = "";
      let isNewVisitor = true;
      try {
        const v = localStorage.getItem(VID_KEY);
        if (v) { vid = v; isNewVisitor = false; }
        else { vid = rid(16); localStorage.setItem(VID_KEY, vid); }
      } catch { vid = rid(16); }

      const pathNow = () => window.location.pathname || "/";
      const PROJECT_RE = /^\/projects\/([^/?#]+)/;
      const slugOf = (p: string) => (p.match(PROJECT_RE)?.[1] ? decodeURIComponent(p.match(PROJECT_RE)![1]).slice(0, 120) : "");

      // --- cumulative state + flushed watermark (flush sends diffs) ---
      const cum = {
        active: 0, idle: 0,
        sections: {} as Record<string, number>,
        scroll: {} as Record<string, number>,
        projects: {} as Record<string, { Ms: number; Opens: number; Live: number; Github: number; Download: number }>,
        projectAgg: { Project: 0, Live: 0, Github: 0, Download: 0 },
        socials: {} as Record<string, { Clicks: number; AwayMs: number }>,
        socialClicks: 0,
        contactOpens: 0, contactSent: "", contactsSent: 0,
        cvOpens: 0, rage: 0, copies: 0, prints: 0,
      };
      const flushed = {
        active: 0, idle: 0,
        sections: {} as Record<string, number>,
        projects: {} as Record<string, { Ms: number; Opens: number; Live: number; Github: number; Download: number }>,
        projectAgg: { Project: 0, Live: 0, Github: 0, Download: 0 },
        socials: {} as Record<string, { Clicks: number; AwayMs: number }>,
        socialClicks: 0,
        contactOpens: 0, contactsSent: 0, sentFlushed: false,
        cvOpens: 0, rage: 0, copies: 0, prints: 0,
        scroll: {} as Record<string, number>,
      };
      let queue: Event[] = [];
      const push = (k: string, v?: string) => {
        if (queue.length >= 500) return;
        queue.push({ k: k.slice(0, 24), v: v?.slice(0, 200), t: t() });
      };

      let lastActivity = Date.now();
      let lastFlush = 0;
      let exitSection = pathNow();
      let curPath = pathNow();
      let dirty = true;
      let pendingSocial: { name: string; t: number } | null = null;
      let contactCountedFor: string | null = null;
      let pendingLink: { Id: string; Name: string; For: string } | null = null;
      // Link-only mode: nothing is sent until a share-link code is known.
      // Assigned below once the init routine exists; the live handoff
      // (track "link") triggers it for visits that start dormant.
      let initialized = false;
      let ensureInit: (id: string, name: string, forWho: string) => void = () => {};

      const seenProjects = new Set<string>();
      const openProject = (slug: string) => {
        if (!slug || seenProjects.has(`${curPath}`)) return;
        seenProjects.add(`${curPath}`);
        const p = cum.projects[slug] ?? { Ms: 0, Opens: 0, Live: 0, Github: 0, Download: 0 };
        p.Opens += 1;
        cum.projects[slug] = p;
        cum.projectAgg.Project += 1;
        push("project", slug);
        dirty = true;
      };

      const socialClick = (name: string) => {
        const key = (name || "unknown").slice(0, 120);
        const s = cum.socials[key] ?? { Clicks: 0, AwayMs: 0 };
        s.Clicks += 1;
        cum.socials[key] = s;
        cum.socialClicks += 1;
        pendingSocial = { name: key, t: Date.now() };
        push("social", key);
        dirty = true;
      };

      const projectOut = (slug: string, kind: "live" | "github" | "download") => {
        const p = cum.projects[slug] ?? { Ms: 0, Opens: 0, Live: 0, Github: 0, Download: 0 };
        if (kind === "live") { p.Live += 1; cum.projectAgg.Live += 1; }
        if (kind === "github") { p.Github += 1; cum.projectAgg.Github += 1; }
        if (kind === "download") { p.Download += 1; cum.projectAgg.Download += 1; }
        cum.projects[slug] = p;
        push("out", `${slug}:${kind}`);
        dirty = true;
      };

      const contactOpen = () => {
        cum.contactOpens += 1;
        push("contact", "open");
        dirty = true;
      };
      const contactSent = (kind: string) => {
        if (cum.contactsSent > 0) return;
        cum.contactSent = kind;
        cum.contactsSent = 1;
        push("contact", `sent:${kind}`);
        dirty = true;
      };
      const cvOpen = (v = "open") => {
        cum.cvOpens += 1;
        push("cv", v);
        dirty = true;
      };

      // Manual API for components: window.__trails.track("cv"|"contact-open"|...)
      (window as unknown as { __trails?: unknown }).__trails = {
        track: (kind: string, value?: string) => {
          try {
            lastActivity = Date.now();
            if (kind === "contact-open") contactOpen();
            else if (kind === "contact-sent") contactSent(value || "message");
            else if (kind === "cv") cvOpen(value || "open");
            else if (kind === "social") socialClick(value || "unknown");
            else if (kind === "copy") { cum.copies += 1; push("copy", value || "text"); dirty = true; }
            else if (kind === "project-out") {
              const [id, k] = (value || "").split(":");
              if (id) projectOut(id, k === "github" ? "github" : k === "download" ? "download" : "live");
            } else if (kind === "link" && value) {
              // Share-link attribution (landing page handoff): stamped onto
              // the live session with the next flush. In link-only mode this
              // is also the wake-up call: a dormant tracker inits now.
              try {
                const o = JSON.parse(value) as { Id?: unknown; Name?: unknown; For?: unknown };
                if (o && typeof o.Id === "string" && o.Id) {
                  pendingLink = {
                    Id: o.Id.slice(0, 120),
                    Name: typeof o.Name === "string" ? o.Name.slice(0, 120) : "",
                    For: typeof o.For === "string" ? o.For.slice(0, 120) : "",
                  };
                  try { sessionStorage.setItem("trails_link", JSON.stringify(pendingLink)); } catch { /* ignore */ }
                  if (!initialized) ensureInit(pendingLink.Id, pendingLink.Name, pendingLink.For);
                  push("click", `link:${pendingLink.Id}`);
                  dirty = true;
                }
              } catch { /* ignore */ }
            } else if (kind === "nav" && value) {
              curPath = value.slice(0, 200);
              exitSection = curPath;
              contactCountedFor = null;
              if (!initialized) {
                // Wake up when the new path itself carries a link code
                // (client-side nav into /mohanddarwish/<code>).
                const m = curPath.match(/^\/mohanddarwish\/([^/?#]+)/);
                if (m) {
                  try {
                    ensureInit(decodeURIComponent(m[1]).slice(0, 120), "", "");
                  } catch { /* ignore */ }
                }
              }
              push("view", curPath);
              const slug = slugOf(curPath);
              if (slug) openProject(slug);
              try { observeSections(); } catch { /* ignore */ }
              dirty = true;
            } else push("click", value || kind);
          } catch { /* ignore */ }
        },
      };

      // --- init (link-only) ---
      // The tracker stays dormant until a share-link code is known: either
      // from the URL (/mohanddarwish/<code>), from the sessionStorage backup
      // the landing page stashed (refresh on `/` after redirect), or from a
      // live track("link") handoff. Direct visits never init, never flush.
      const entryPath = curPath;
      const linkMatch = entryPath.match(/^\/mohanddarwish\/([^/?#]+)/);
      // Link backup stashed by the landing page (covers refreshes on `/`
      // after a redirect, where the URL no longer carries the code).
      let storedLink: { Id: string; Name: string; For: string } | null = null;
      try {
        const raw = sessionStorage.getItem("trails_link");
        if (raw) {
          const o = JSON.parse(raw) as { Id?: unknown; Name?: unknown; For?: unknown };
          if (o && typeof o.Id === "string" && o.Id) {
            storedLink = {
              Id: o.Id.slice(0, 120),
              Name: typeof o.Name === "string" ? o.Name.slice(0, 120) : "",
              For: typeof o.For === "string" ? o.For.slice(0, 120) : "",
            };
          }
        }
      } catch { /* ignore */ }
      ensureInit = (lid: string, lname: string, lfor: string) => {
        if (initialized || dead) return;
        if (!lid) return;
        // Owner/coding visits never track — tracking wakes up only for real
        // recipients of a share link.
        if (isOwner()) return;
        initialized = true;
        const initBody = {
          kind: "init",
          sid, vid, isNewVisitor,
          path: curPath,
          referrer: document.referrer || "",
          utm: utmOf(),
          owner: isOwner(),
          linkId: lid.slice(0, 120),
          linkName: (lname || storedLink?.Name || "").slice(0, 120),
          linkFor: (lfor || storedLink?.For || "").slice(0, 120),
          device: detectDevice(),
          perf: { LoadMs: 0, LcpMs: 0 },
        };
        try {
          if (performance?.getEntriesByType) {
            const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
            if (nav) (initBody.perf as { LoadMs: number }).LoadMs = Math.round(nav.loadEventEnd || nav.duration || 0);
          }
        } catch { /* ignore */ }
        try {
          const po = new PerformanceObserver((list) => {
            try {
              for (const e of list.getEntries()) {
                const lcp = e as PerformanceEntry & { startTime: number };
                (initBody.perf as { LcpMs: number }).LcpMs = Math.round(lcp.startTime);
              }
            } catch { /* ignore */ }
          });
          po.observe({ type: "largest-contentful-paint", buffered: true });
          setTimeout(() => { try { po.disconnect(); } catch { /* ignore */ } }, 8000);
        } catch { /* ignore */ }
        fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(initBody) }).catch(() => {});
        // Give init a head start so the first flush finds its session row.
        lastFlush = Date.now();
        const slug0 = slugOf(curPath);
        if (slug0) openProject(slug0);
        push("view", curPath);
      };
      {
        const initialId = linkMatch ? decodeURIComponent(linkMatch[1]).slice(0, 120) : (storedLink?.Id || "");
        if (initialId) ensureInit(initialId, storedLink?.Name || "", storedLink?.For || "");
      }

      // --- section visibility ---
      const visibleSections = new Set<string>();
      const io = ("IntersectionObserver" in window) ? new IntersectionObserver((entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          const name = el.dataset.trailsSection || el.id;
          if (e.isIntersecting) {
            visibleSections.add(name);
            if (name === "contact-wrap" || name === "contact") {
              if (contactCountedFor !== curPath) {
                contactCountedFor = curPath;
                contactOpen();
              }
            } else {
              push("view", name);
            }
          } else visibleSections.delete(name);
        }
      }, { threshold: 0.3 }) : null;
      const observeSections = () => {
        if (!io) return;
        try {
          io.disconnect();
          visibleSections.clear();
          for (const id of KNOWN_SECTIONS) {
            const el = document.getElementById(id);
            if (el) io.observe(el);
          }
          document.querySelectorAll("[data-trails-section]").forEach((el) => io.observe(el));
        } catch { /* ignore */ }
      };
      observeSections();

      // --- scroll depth ---
      let scrollRaf = 0;
      const onScroll = () => {
        lastActivity = Date.now();
        if (scrollRaf) return;
        scrollRaf = requestAnimationFrame(() => {
          scrollRaf = 0;
          try {
            const h = document.documentElement;
            const max = h.scrollHeight - window.innerHeight;
            const pct = max > 0 ? Math.min(100, Math.round((window.scrollY / max) * 100)) : 100;
            if (pct > (cum.scroll[curPath] || 0)) {
              cum.scroll[curPath] = pct;
              if (pct === 25 || pct === 50 || pct === 75 || pct === 100) push("scroll", `${curPath}:${pct}`);
              dirty = true;
            }
          } catch { /* ignore */ }
        });
      };

      // --- rage clicks ---
      let clicks: Array<{ x: number; y: number; t: number }> = [];
      const onClick = (e: MouseEvent) => {
        lastActivity = Date.now();
        try {
          const now = Date.now();
          clicks = [...clicks.filter((c) => now - c.t < 800), { x: e.clientX, y: e.clientY, t: now }];
          const near = clicks.filter((c) => Math.hypot(c.x - e.clientX, c.y - e.clientY) < 60);
          if (near.length >= 4) {
            clicks = [];
            cum.rage += 1;
            push("rage", "repeat");
            dirty = true;
          }
        } catch { /* ignore */ }

        // explicit + auto classification
        try {
          const el = (e.target as HTMLElement).closest?.("[data-track],a,button") as HTMLElement | null;
          if (!el) return;
          const kind = el.dataset?.track;
          if (kind === "contact-open") { contactOpen(); return; }
          if (kind === "copy") { cum.copies += 1; push("copy", el.dataset.value || "text"); dirty = true; return; }
          if (kind === "cv") { cvOpen(el.dataset.value || "open"); return; }
          if (kind === "social") {
            const nm = el.dataset.name || (el as HTMLAnchorElement).href || "unknown";
            socialClick(hostOf(nm) || nm);
            return;
          }
          if (kind === "project-out" && el.dataset.id) {
            const k = el.dataset.out === "github" ? "github" : el.dataset.out === "download" ? "download" : "live";
            projectOut(el.dataset.id, k);
            return;
          }
          if (kind === "project" && el.dataset.id) { push("project", el.dataset.id); dirty = true; return; }
          if (el.tagName === "A") {
            const href = (el as HTMLAnchorElement).getAttribute("href") || "";
            if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
            if (href.startsWith("mailto:")) { contactOpen(); return; }
            if (href.includes("cv.pdf")) { cvOpen("download"); return; }
            if (/^https?:\/\//.test(href)) {
              let host = "";
              try { host = new URL(href, window.location.origin).hostname; } catch { return; }
              if (host && host !== window.location.hostname) {
                const slug = slugOf(curPath);
                if (SOCIAL_HOSTS.test(host)) socialClick(host.replace(/^www\./, ""));
                else if (slug) {
                  projectOut(slug, /github\.com/i.test(host) ? "github" : "live");
                } else {
                  push("out", host.replace(/^www\./, ""));
                  dirty = true;
                }
              }
            }
          }
        } catch { /* ignore */ }
      };
      const hostOf = (url: string) => {
        try { return new URL(url, window.location.origin).hostname.replace(/^www\./, ""); }
        catch { return ""; }
      };

      const onCopy = () => {
        lastActivity = Date.now();
        // data-track="copy" clicks already counted; this covers keyboard copies
        cum.copies += 1;
        push("copy", "text");
        dirty = true;
      };
      const onPrint = () => {
        cum.prints += 1;
        push("print", "page");
        dirty = true;
      };
      const onCvEvent = () => cvOpen("open");
      const onKey = () => { lastActivity = Date.now(); };

      // --- fetch patch: contact / booking success => sent ---
      const origFetch = window.fetch.bind(window);
      (window as unknown as { fetch: typeof fetch }).fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        let url = "";
        try { url = typeof input === "string" ? input : input instanceof URL ? input.pathname : (input as Request).url; } catch { /* ignore */ }
        const method = (init?.method || (typeof input !== "string" && !(input instanceof URL) ? (input as Request).method : "GET") || "GET").toUpperCase();
        const p = origFetch(input as RequestInfo, init);
        if (method === "POST" && (url === "/api/contact" || url.startsWith("/api/contact?") || url === "/api/booking" || url.startsWith("/api/booking?"))) {
          p.then((r) => {
            try {
              if (r.ok) contactSent(url.includes("booking") ? "meeting" : "message");
            } catch { /* ignore */ }
          }).catch(() => {});
        }
        return p;
      }) as typeof fetch;

      // --- 1s timers ---
      const timer = setInterval(() => {
        if (dead) return;
        // Dormant (no link yet): don't accumulate anything worth flushing.
        if (!initialized) {
          lastActivity = Date.now();
          return;
        }
        try {
          const now = Date.now();
          const hidden = document.hidden;
          if (!hidden && now - lastActivity < 30_000) {
            cum.active += 1;
            if (visibleSections.size) {
              for (const s of visibleSections) cum.sections[s] = (cum.sections[s] || 0) + 1_000;
            } else {
              cum.sections[curPath] = (cum.sections[curPath] || 0) + 1_000;
            }
            const slug = slugOf(curPath);
            if (slug) {
              const p = cum.projects[slug] ?? { Ms: 0, Opens: 0, Live: 0, Github: 0, Download: 0 };
              p.Ms += 1_000;
              cum.projects[slug] = p;
            }
            dirty = true;
          } else {
            cum.idle += 1;
          }
          exitSection = visibleSections.size ? [...visibleSections][0] : curPath;
          if (dirty && now - lastFlush > FLUSH_DIRTY_MS) void flush(false);
          else if (now - lastFlush > FLUSH_HEARTBEAT_MS) void flush(false);
        } catch { /* ignore */ }
      }, 1000);

      function diffMapNum(a: Record<string, number>, b: Record<string, number>) {
        const out: Record<string, number> = {};
        for (const [k, v] of Object.entries(a)) {
          const d = v - (b[k] || 0);
          if (d > 0) out[k] = d;
        }
        return out;
      }

      async function flush(isEnd: boolean) {
        if (dead && !isEnd) return;
        // Link-only: never send anything before a link init. The pagehide
        // beacon for a dormant tracker would create noise, so skip it too.
        if (!initialized) return;
        let body: Record<string, unknown> | null = null;
        try {
          const dSections = diffMapNum(cum.sections, flushed.sections);
          const dActive = cum.active - flushed.active;
          const dIdle = cum.idle - flushed.idle;
          const dProjects: Record<string, { Ms?: number; Opens?: number; Live?: number; Github?: number; Download?: number }> = {};
          for (const [id, p] of Object.entries(cum.projects)) {
            const f = flushed.projects[id] ?? { Ms: 0, Opens: 0, Live: 0, Github: 0, Download: 0 };
            const d = { Ms: p.Ms - f.Ms, Opens: p.Opens - f.Opens, Live: p.Live - f.Live, Github: p.Github - f.Github, Download: p.Download - f.Download };
            if (d.Ms > 0 || d.Opens > 0 || d.Live > 0 || d.Github > 0 || d.Download > 0) dProjects[id] = d;
          }
          const dSocials: Record<string, { Clicks?: number; AwayMs?: number }> = {};
          for (const [n, s] of Object.entries(cum.socials)) {
            const f = flushed.socials[n] ?? { Clicks: 0, AwayMs: 0 };
            const d = { Clicks: s.Clicks - f.Clicks, AwayMs: s.AwayMs - f.AwayMs };
            if (d.Clicks > 0 || d.AwayMs > 0) dSocials[n] = d;
          }
          const dScroll: Record<string, number> = {};
          for (const [k, v] of Object.entries(cum.scroll)) {
            if (v > (flushed.scroll[k] || 0)) dScroll[k] = v;
          }
          const dContactOpens = cum.contactOpens - flushed.contactOpens;
          const dContactsSent = !flushed.sentFlushed && cum.contactsSent > 0 ? 1 : 0;
          const dCv = cum.cvOpens - flushed.cvOpens;
          const dRage = cum.rage - flushed.rage;
          const dCopies = cum.copies - flushed.copies;
          const dPrints = cum.prints - flushed.prints;
          const dAgg = {
            Project: cum.projectAgg.Project - flushed.projectAgg.Project,
            Live: cum.projectAgg.Live - flushed.projectAgg.Live,
            Github: cum.projectAgg.Github - flushed.projectAgg.Github,
            Download: cum.projectAgg.Download - flushed.projectAgg.Download,
          };
          const dSocialClicks = cum.socialClicks - flushed.socialClicks;
          const hasDelta =
            dActive > 0 || dIdle > 0 || Object.keys(dSections).length > 0 || Object.keys(dProjects).length > 0 ||
            Object.keys(dSocials).length > 0 || Object.keys(dScroll).length > 0 || dContactOpens > 0 ||
            dContactsSent > 0 || dCv > 0 || dRage > 0 || dCopies > 0 || dPrints > 0 || queue.length > 0 || pendingLink !== null || isEnd;
          if (!hasDelta) {
            // heartbeat: still refresh LastSeenAt so "Reading now" stays true
            lastFlush = Date.now();
            try { localStorage.setItem(SID_KEY, JSON.stringify({ sid, seen: Date.now() })); } catch { /* ignore */ }
            return;
          }
          body = {
            kind: "flush",
            sid,
            path: curPath,
            deltas: {
              sections: dSections,
              projects: dProjects,
              projectAgg: dAgg,
              socials: dSocials,
              socialClicks: dSocialClicks,
              contactsSent: dContactsSent,
            },
            activeMs: Math.max(0, dActive * 1000),
            openMs: Date.now() - start,
            idleMs: Math.max(0, dIdle * 1000),
            scroll: dScroll,
            contactOpens: Math.max(0, dContactOpens),
            contactSent: !flushed.sentFlushed && cum.contactSent ? cum.contactSent : "",
            cvOpens: Math.max(0, dCv),
            exitSection,
            events: queue,
            rage: Math.max(0, dRage),
            copies: Math.max(0, dCopies),
            prints: Math.max(0, dPrints),
            ended: isEnd,
            ...(pendingLink ? { link: pendingLink } : null),
          };
          // optimistic watermark (at-most-once per delta on failure: acceptable)
          flushed.active = cum.active;
          flushed.idle = cum.idle;
          flushed.sections = { ...cum.sections };
          flushed.projects = Object.fromEntries(Object.entries(cum.projects).map(([k, v]) => [k, { ...v }]));
          flushed.projectAgg = { ...cum.projectAgg };
          flushed.socials = Object.fromEntries(Object.entries(cum.socials).map(([k, v]) => [k, { ...v }]));
          flushed.socialClicks = cum.socialClicks;
          flushed.contactOpens = cum.contactOpens;
          if (dContactsSent > 0) flushed.sentFlushed = true;
          flushed.cvOpens = cum.cvOpens;
          flushed.rage = cum.rage;
          flushed.copies = cum.copies;
          flushed.prints = cum.prints;
          flushed.scroll = { ...cum.scroll };
          queue = [];
          pendingLink = null;
          dirty = false;
          lastFlush = Date.now();
          try { localStorage.setItem(SID_KEY, JSON.stringify({ sid, seen: Date.now() })); } catch { /* ignore */ }
        } catch { return; }
        if (!body) return;
        try {
          const payload = JSON.stringify(body);
          if (isEnd && navigator.sendBeacon) {
            navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
          } else {
            await fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true });
          }
        } catch { /* ignore */ }
      }

      const onVis = () => {
        try {
          if (document.hidden) {
            if (pendingSocial) {
              (pendingSocial as { t: number }).t = Date.now();
            }
            void flush(false);
          } else {
            lastActivity = Date.now();
            if (pendingSocial) {
              const away = Date.now() - pendingSocial.t;
              if (away > 1000) {
                const s = cum.socials[pendingSocial.name] ?? { Clicks: 0, AwayMs: 0 };
                s.AwayMs += away;
                cum.socials[pendingSocial.name] = s;
                push("social", `${pendingSocial.name}:back`);
                dirty = true;
              }
              pendingSocial = null;
            }
          }
        } catch { /* ignore */ }
      };
      const onHide = () => {
        try { void flush(true); } catch { /* ignore */ }
      };

      document.addEventListener("click", onClick);
      document.addEventListener("scroll", onScroll, { passive: true });
      document.addEventListener("keydown", onKey);
      document.addEventListener("copy", onCopy);
      window.addEventListener("afterprint", onPrint);
      window.addEventListener("open-cv", onCvEvent);
      document.addEventListener("visibilitychange", onVis);
      window.addEventListener("pagehide", onHide);

      return () => {
        dead = true;
        clearInterval(timer);
        try { io?.disconnect(); } catch { /* ignore */ }
        document.removeEventListener("click", onClick);
        document.removeEventListener("scroll", onScroll);
        document.removeEventListener("keydown", onKey);
        document.removeEventListener("copy", onCopy);
        window.removeEventListener("afterprint", onPrint);
        window.removeEventListener("open-cv", onCvEvent);
        document.removeEventListener("visibilitychange", onVis);
        window.removeEventListener("pagehide", onHide);
        try { (window as unknown as { fetch: typeof fetch }).fetch = origFetch; } catch { /* ignore */ }
      };
    } catch { /* never break the page */ }
  }, []);

  // SPA navigation: hand the new path to the live session (view + project open).
  // First run is the initial page load (already init-tracked), so skip it.
  useEffect(() => {
    try {
      const w = window as unknown as { __trails?: { track: (k: string, v?: string) => void }; __trails_nav_seen?: boolean };
      if (!w.__trails_nav_seen) {
        w.__trails_nav_seen = true;
        return;
      }
      if (pathname) w.__trails?.track("nav", pathname);
    } catch { /* ignore */ }
  }, [pathname]);

  return null;
}
