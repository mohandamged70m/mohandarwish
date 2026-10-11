"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { analytics } from "@/lib/analytics/collect";
import { announceTailor, clearTailor, stashTailor, type Tailor } from "@/lib/analytics/tailor";

// Global Trails tracker: every visit is recorded — share-link recipients and
// direct arrivals alike — with the full story (sections, projects, socials,
// CV, contact funnel, scroll, rage, perf). Owner visits and bots never start:
// no init, no flush, no beacon for them.
//
// All the buffering, numbering and retry logic lives in lib/analytics/collect.ts. This
// file is only the bridge: it decides *which* section is on screen, and turns the
// app's clicks into the vocabulary the collector understands. Nothing here ever
// breaks the page.

const SOCIAL_HOSTS = /x\.com|twitter|linkedin|github|facebook|instagram|tiktok|reddit|youtube|medium|dev\.to|producthunt|substack|behance|dribbble|threads|pinterest|t\.me|wa\.me|discord\.gg/i;
const KNOWN_SECTIONS: Array<[string, string]> = [
  ["hero", "hero"],
  ["stack-wrap", "stack"],
  ["projects-wrap", "projects"],
];
const PROJECT_RE = /^\/projects\/([^/?#]+)/;
/** Stored link attribution older than this is stale and never starts a visit. */
const LINK_STALE_MS = 12 * 60 * 60_000;
/** Minimum gap between contact-open counts from section visibility (flap guard). */
const CONTACT_OPEN_COOLDOWN_MS = 10_000;

type TrackFn = (kind: string, value?: string) => void;

interface TrailsBridge {
  track: TrackFn;
  /** Current visit id ("" when not recording) for conversion attribution. */
  sid: () => string;
}

interface TrailsWindow extends Window {
  __trails?: TrailsBridge;
  __trails_active?: boolean;
}

interface PendingLink {
  Id: string;
  Name: string;
  For: string;
}

/** Owner's own coding/testing never records — only real recipients of a link.
 * Ownership resolves server-side from the HttpOnly Auth.js session; the
 * browser never reads the session cookie (it cannot — HttpOnly), it just asks
 * the session endpoint once per visit and stays off for the owner. */
async function checkOwner(): Promise<boolean> {
  try {
    const r = await fetch("/api/auth/session", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!r.ok) return false;
    const b = await r.json() as { user?: { isOwner?: boolean } } | null;
    return b?.user?.isOwner === true;
  } catch {
    // Ownership is checked again authoritatively by the ingest gateway.
    return false;
  }
}
function isPrivatePath(path: string): boolean {
  return /^\/(dashboard|api)(?:\/|$)/.test(path);
}
function isLocalDev(): boolean {
  try {
    if (/^(?:localhost|127\.[\d.]+|192\.168\.[\d.]+|10\.[\d.]+|\[?::1\]?)$/.test(window.location.hostname))
      return true;
  } catch {
    /* ignore */
  }
  return false;
}

function hostOf(url: string): string {
  try {
    return new URL(url, window.location.origin).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function readStoredLink(): PendingLink | null {
  try {
    const at = Number(sessionStorage.getItem("trails_link_at") || 0);
    if (!at || Date.now() - at > LINK_STALE_MS || at > Date.now()) {
      // Stale attribution must expire: a tab left open overnight must not
      // attribute tomorrow's browsing to yesterday's link, nor inherit its
      // greeting.
      try {
        sessionStorage.removeItem("trails_link");
        sessionStorage.removeItem("trails_link_at");
        sessionStorage.removeItem("trails_tailor");
        sessionStorage.removeItem("trails_entry");
      } catch {
        /* ignore */
      }
      return null;
    }
    const raw = sessionStorage.getItem("trails_link");
    if (!raw) return null;
    const o = JSON.parse(raw) as { Id?: unknown; Name?: unknown; For?: unknown };
    if (!o || typeof o.Id !== "string" || !o.Id) return null;
    return {
      Id: o.Id.slice(0, 120),
      Name: typeof o.Name === "string" ? o.Name.slice(0, 120) : "",
      For: typeof o.For === "string" ? o.For.slice(0, 120) : "",
    };
  } catch {
    return null;
  }
}

function parseLink(value: string): PendingLink | null {
  try {
    const o = JSON.parse(value) as { Id?: unknown; Name?: unknown; For?: unknown };
    if (!o || typeof o.Id !== "string" || !o.Id) return null;
    return {
      Id: o.Id.slice(0, 120),
      Name: typeof o.Name === "string" ? o.Name.slice(0, 120) : "",
      For: typeof o.For === "string" ? o.For.slice(0, 120) : "",
    };
  } catch {
    return null;
  }
}

export function TrailsTracker(): null {
  const pathname = usePathname();

  useEffect(() => {
    let dead = false;
    try {
      const w = window as TrailsWindow;
      w.__trails_active = true;

      let curPath = window.location.pathname || "/";
      let starting = false;
      let pendingLink: PendingLink | null = null;
      let live = false; // is the collector actually recording?
      let lastContactOpenAt = 0;
      const slugOf = (p: string) => {
        const m = p.match(PROJECT_RE);
        try { return m?.[1] ? decodeURIComponent(m[1]).slice(0, 120) : ""; } catch { return ""; }
      };
      const contactOpenDebounced = () => {
        const now = Date.now();
        if (now - lastContactOpenAt < CONTACT_OPEN_COOLDOWN_MS) return;
        lastContactOpenAt = now;
        analytics.contactOpen();
      };

      // ── waking up ──────────────────────────────────────────────────
      // Every visit starts the collector: with a link code when one is
      // known (URL, stashed backup, or live handoff), or as a direct visit
      // otherwise. Only the owner and local dev stay out.
      const begin = (link: PendingLink | null) => {
        pendingLink = link;
        if (live || dead || starting || isLocalDev() || isPrivatePath(curPath)) return;
        starting = true;
        // Owner check hits the session endpoint; resolve it before
        // recording anything so the owner's own visits never start the collector.
        // The server re-resolves ownership authoritatively per flush, so a
        // spoofed client hint can never pollute visitor metrics.
        void checkOwner().then((owned) => {
          starting = false;
          if (live || dead || owned || isPrivatePath(curPath)) return;
          const link = pendingLink;
          live = true;
          analytics.start({
            section: sectionNow(curPath),
            ...(link?.Id ? { code: link.Id } : {}),
            isOwner: () => false,
            onTailor: (tailor, resolved) => {
              const full: Tailor = { ...tailor, LinkName: resolved?.Name || "", LinkFor: resolved?.For || "" };
              stashTailor(tailor, { Name: resolved?.Name || "", For: resolved?.For || "" });
              announceTailor(full);
              void resolved;
            },
          });
          // A direct visit is not a tailored one: scrub any greeting left
          // over from a previous link in the same tab.
          if (!link?.Id) {
            clearTailor();
            announceTailor(null);
          }
          live = analytics.isRunning();
          const project = slugOf(curPath);
          if (live && project) analytics.projectOpen(project);
          observeSections();
        });
      };

      // ── manual API for components ──────────────────────────────────
      // window.__trails.track("link" | "contact-open" | "cv" | "social" | ...)
      // Booking/message forms attach window.__trails.sid() plus a stable
      // per-submit id to their persistence request; the server confirms the
      // conversion after saving (contact-sent is server-written, never a
      // client claim). No global fetch interception (it double-counted and
      // missed /api/messages).
      w.__trails = {
        sid: () => {
          try {
            return analytics.currentSessionId();
          } catch {
            return "";
          }
        },
        track: (kind: string, value?: string) => {
          try {
            if (kind === "link" && value) {
              // Share-link attribution (landing page handoff). If the tab is
              // already recording a direct visit (or another link), restart
              // under the new code so attribution is never inherited.
              const link = parseLink(value);
              if (link) {
                try {
                  sessionStorage.setItem("trails_link", JSON.stringify(link));
                  sessionStorage.setItem("trails_link_at", String(Date.now()));
                } catch {
                  /* ignore */
                }
                if (live) { analytics.restartWithCode(link.Id, sectionNow(curPath)); observeSections(); }
                else begin(link);
              }
              return;
            }
            if (kind === "nav") {
              const next = (value || curPath).slice(0, 200);
              if (isPrivatePath(next)) {
                if (live) analytics.stop();
                live = false;
                curPath = next;
                observeSections();
                return;
              }
              if (!live) { curPath = next; if (!starting) begin(readStoredLink()); return; }
            }
            if (!live) return;
            switch (kind) {
              case "contact-open":
                contactOpenDebounced();
                break;
              case "contact-sent":
                analytics.contactSubmit((value || "message") as "message" | "meeting" | "book");
                break;
              case "contact-tab":
                analytics.contactTabChange(value || "");
                break;
              case "cv":
                analytics.cvOpen();
                break;
              case "social":
                analytics.socialClick(value || "unknown");
                break;
              case "social-back":
                analytics.socialReturn(value || "unknown");
                break;
              case "project-out": {
                const [id, k] = (value || "").split(":");
                if (id) analytics.projectOutbound(id, k === "github" ? "github" : k === "download" ? "download" : "live");
                break;
              }
              case "project-close":
                analytics.projectClose();
                break;
              case "nav": {
                const previous = slugOf(curPath);
                curPath = (value || curPath).slice(0, 200);
                const slug = slugOf(curPath);
                if (previous && previous !== slug) analytics.projectClose();
                if (slug && slug !== previous) analytics.projectOpen(slug);
                analytics.setSection(sectionNow(curPath));
                observeSections();
                break;
              }
              default:
                break;
            }
          } catch {
            /* never break the page */
          }
        },
      };

      // ── section visibility ─────────────────────────────────────────
      const visibleSections = new Map<string, number>();
      const observed = new Set<Element>();
      const sectionName = (el: HTMLElement) => el.dataset.trailsSection || KNOWN_SECTIONS.find(([id]) => id === el.id)?.[1] || el.id;
      const io =
        "IntersectionObserver" in window
          ? new IntersectionObserver(
              (entries) => {
                for (const e of entries) {
                  const el = e.target as HTMLElement;
                  const name = sectionName(el);
                  if (e.isIntersecting) {
                    const fresh = !visibleSections.has(name);
                    visibleSections.set(name, e.intersectionRatio);
                    // Once per visibility session, cooldown-guarded: observer
                    // flapping at a boundary must not inflate contact opens.
                    if (name === "contact" && fresh) contactOpenDebounced();
                  } else {
                    visibleSections.delete(name);
                  }
                }
                // Whichever section is on screen owns the clock. A named section wins
                // over an anonymous one so two visible at a boundary cannot flap.
                const next = [...visibleSections].sort((a, b) => b[1] - a[1])[0]?.[0];
                if (next) analytics.setSection(next);
              },
              { threshold: [0, 0.1, 0.3, 0.5, 0.75] }
            )
          : null;

      function observeSections(): void {
        if (!io) return;
        if (!live || slugOf(curPath) || isPrivatePath(curPath)) {
          io.disconnect();
          observed.clear();
          visibleSections.clear();
          return;
        }
        // Streamed content and route mounts can appear after the nav effect.
        // Register only new targets; resetting the observer loses visibility.
        for (const el of observed) {
          if (!el.isConnected) {
            io.unobserve(el);
            observed.delete(el);
            visibleSections.delete(sectionName(el as HTMLElement));
          }
        }
        const targets = [...KNOWN_SECTIONS.map(([id]) => document.getElementById(id)), ...document.querySelectorAll("[data-trails-section]")];
        for (const el of targets) {
          if (el && !observed.has(el)) { observed.add(el); io.observe(el); }
        }
      }
      const domObserver = new MutationObserver(observeSections);
      domObserver.observe(document.body, { childList: true, subtree: true });

      function sectionNow(path: string): string {
        if (slugOf(path)) return "project";
        if (path.startsWith("/projects")) return "projects";
        return [...visibleSections].sort((a, b) => b[1] - a[1])[0]?.[0] || "home";
      }

      // ── click classification ───────────────────────────────────────
      // Deduplicated: data-track kinds win; bare anchors are classified once.
      // A click already handled as a data-track kind never falls through to
      // the generic anchor branch (that double-counted CV/social/project-out).
      const onClick = (e: MouseEvent) => {
        if (!live) return;
        try {
          const el = (e.target as HTMLElement).closest?.("[data-track],a,button") as HTMLElement | null;
          if (!el) return;
          const kind = el.dataset?.track;
          if (kind === "contact-open") {
            contactOpenDebounced();
            return;
          }
          if (kind === "cv") {
            analytics.cvOpen();
            return;
          }
          if (kind === "social") {
            const href = (el as HTMLAnchorElement).href || "";
            analytics.socialClick(el.dataset.name || hostOf(href) || "unknown");
            return;
          }
          if (kind === "project-out" && el.dataset.id) {
            const k = el.dataset.out === "github" ? "github" : el.dataset.out === "download" ? "download" : "live";
            analytics.projectOutbound(el.dataset.id, k);
            return;
          }
          if (kind === "project" && el.dataset.id) {
            analytics.projectOpen(el.dataset.id);
            return;
          }
          if (kind) return; // unknown data-track kind: handled, never double-count
          if (el.tagName !== "A") return;
          const href = (el as HTMLAnchorElement).getAttribute("href") || "";
          if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
          if (href.startsWith("mailto:")) {
            contactOpenDebounced();
            return;
          }
          if (href.includes("cv.pdf")) {
            analytics.cvOpen();
            return;
          }
          if (!/^https?:\/\//.test(href)) return;
          const host = hostOf(href);
          if (!host || host === window.location.hostname) return;
          if (SOCIAL_HOSTS.test(host)) {
            analytics.socialClick(host);
            return;
          }
          const slug = slugOf(curPath);
          if (slug) analytics.projectOutbound(slug, /github\.com/i.test(host) ? "github" : "live");
        } catch {
          /* ignore */
        }
      };

      document.addEventListener("click", onClick, true);
      const onCvEvent = () => {
        if (live) analytics.cvOpen();
      };
      window.addEventListener("open-cv", onCvEvent);

      // ── wake from whatever we already know ─────────────────────────
      const fromUrl = curPath.match(/^\/mohanddarwish\/([^/?#]+)/);
      if (fromUrl) {
        try {
          begin({ Id: decodeURIComponent(fromUrl[1]).slice(0, 120), Name: "", For: "" });
        } catch {
          /* ignore */
        }
      } else {
        const stored = readStoredLink();
        // A share link if one is stashed, otherwise a plain direct visit.
        // Either way the visit is recorded; only the attribution differs.
        begin(stored);
      }

      return () => {
        dead = true;
        io?.disconnect();
        domObserver.disconnect();
        document.removeEventListener("click", onClick, true);
        if (live) analytics.stop();
        delete w.__trails;
        w.__trails_active = false;
        window.removeEventListener("open-cv", onCvEvent);
      };
    } catch {
      /* never break the page */
    }
  }, []);

  // SPA navigation: hand the new path to the live visit.
  // First run is the initial page load (already started with the right path), so
  // skip it.
  useEffect(() => {
    try {
      const w = window as TrailsWindow;
      if (pathname) w.__trails?.track("nav", pathname);
    } catch {
      /* ignore */
    }
  }, [pathname]);

  return null;
}
