"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { analytics } from "@/lib/analytics/collect";
import { announceTailor, clearTailor, stashTailor, type Tailor } from "@/lib/analytics/tailor";

// Global Trails tracker: LINK-ONLY — one live visit per share-link recipient.
//
// Nothing records until a Trails link code is known: from the URL
// (/mohanddarwish/<code>), from the sessionStorage backup the landing page stashed
// (a refresh on `/` after the redirect, where the URL no longer carries it), or from
// a live track("link") handoff. Direct visits never start: no init, no flush, no
// beacon, and no listeners either — the cost of a direct visit is this file doing
// nothing.
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

type TrackFn = (kind: string, value?: string) => void;

interface TrailsWindow extends Window {
  __trails?: { track: TrackFn };
  __trails_active?: boolean;
  __trails_nav_seen?: boolean;
}

interface PendingLink {
  Id: string;
  Name: string;
  For: string;
}

/** Owner's own coding/testing never records — only real recipients of a link. */
function isOwner(): boolean {
  try {
    if (localStorage.getItem("owner_signed_in")) return true;
    if (new URLSearchParams(window.location.search).get("admin")) return true;
    if (/^(localhost|127\.|192\.168\.|10\.)/.test(window.location.hostname)) return true;
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
      let live = false; // is the collector actually recording?
      const slugOf = (p: string) => {
        const m = p.match(PROJECT_RE);
        return m && m[1] ? decodeURIComponent(m[1]).slice(0, 120) : "";
      };

      // ── waking up ──────────────────────────────────────────────────
      // Everything below this point only exists once a link code is known, so a
      // direct visit attaches no observers and holds no timers at all.
      const begin = (link: PendingLink) => {
        if (live || dead || !link.Id || isOwner()) return;
        live = true;
        analytics.start({
          section: sectionNow(curPath),
          code: link.Id,
          isOwner,
          onTailor: (tailor, resolved) => {
            const full: Tailor = { ...tailor, LinkName: link.Name, LinkFor: link.For };
            stashTailor(tailor, { Name: link.Name, For: link.For });
            announceTailor(full);
            void resolved;
          },
        });
        observeSections();
      };

      // ── manual API for components ──────────────────────────────────
      // window.__trails.track("link" | "contact-open" | "cv" | "social" | ...)
      w.__trails = {
        track: (kind: string, value?: string) => {
          try {
            if (kind === "link" && value) {
              // Share-link attribution (landing page handoff). This is also the
              // wake-up call for a visit that started dormant.
              const link = parseLink(value);
              if (link) {
                try {
                  sessionStorage.setItem("trails_link", JSON.stringify(link));
                } catch {
                  /* ignore */
                }
                begin(link);
              }
              return;
            }
            if (!live) return;
            switch (kind) {
              case "contact-open":
                analytics.contactOpen();
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
                curPath = (value || curPath).slice(0, 200);
                const slug = slugOf(curPath);
                if (slug) analytics.projectOpen(slug);
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
      const visibleSections = new Set<string>();
      const io =
        "IntersectionObserver" in window
          ? new IntersectionObserver(
              (entries) => {
                for (const e of entries) {
                  const el = e.target as HTMLElement;
                  const name = el.dataset.trailsSection || el.id;
                  if (e.isIntersecting) {
                    visibleSections.add(name);
                    if (name === "contact") analytics.contactOpen();
                  } else {
                    visibleSections.delete(name);
                  }
                }
                // Whichever section is on screen owns the clock. A named section wins
                // over an anonymous one so two visible at a boundary cannot flap.
                const named = KNOWN_SECTIONS.find(([id]) => visibleSections.has(id));
                const next = named ? named[1] : [...visibleSections][0];
                if (next) analytics.setSection(next);
              },
              { threshold: 0.3 }
            )
          : null;

      function observeSections(): void {
        if (!io) return;
        try {
          io.disconnect();
          visibleSections.clear();
          for (const [id] of KNOWN_SECTIONS) {
            const el = document.getElementById(id);
            if (el) io.observe(el);
          }
          document.querySelectorAll("[data-trails-section]").forEach((el) => io.observe(el));
        } catch {
          /* ignore */
        }
      }

      function sectionNow(path: string): string {
        if (slugOf(path)) return "project";
        if (path.startsWith("/projects")) return "projects";
        return visibleSections.size ? [...visibleSections][0] : "home";
      }

      // ── click classification ───────────────────────────────────────
      const onClick = (e: MouseEvent) => {
        if (!live) return;
        try {
          const el = (e.target as HTMLElement).closest?.("[data-track],a,button") as HTMLElement | null;
          if (!el) return;
          const kind = el.dataset?.track;
          if (kind === "contact-open") {
            analytics.contactOpen();
            return;
          }
          if (kind === "cv") {
            analytics.cvOpen();
            return;
          }
          if (kind === "social") {
            const nm = el.dataset.name || (el as HTMLAnchorElement).href || "unknown";
            analytics.socialClick(hostOf(nm) || nm);
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
          if (el.tagName !== "A") return;
          const href = (el as HTMLAnchorElement).getAttribute("href") || "";
          if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
          if (href.startsWith("mailto:")) {
            analytics.contactOpen();
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

      // ── submission: the end of the funnel ──────────────────────────
      // A bookmarked or scripted fetch to the booking/contact endpoints still counts;
      // the collector does its own click classification for everything else.
      const origFetch = window.fetch.bind(window);
      (window as unknown as { fetch: typeof fetch }).fetch = ((
        input: RequestInfo | URL,
        init?: RequestInit
      ) => {
        let url = "";
        try {
          url =
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.pathname
                : (input as Request).url;
        } catch {
          /* ignore */
        }
        const method = (
          init?.method ||
          (typeof input !== "string" && !(input instanceof URL) ? (input as Request).method : "GET") ||
          "GET"
        ).toUpperCase();
        const p = origFetch(input as RequestInfo, init);
        if (method === "POST" && live && /\/api\/(contact|booking)/.test(url)) {
          p.then((r) => {
            if (r.ok) analytics.contactSubmit(url.includes("booking") ? "meeting" : "message");
          }).catch(() => {});
        }
        return p;
      }) as typeof fetch;

      document.addEventListener("click", onClick);
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
      }
      if (!live) {
        const stored = readStoredLink();
        if (stored) begin(stored);
      }

      // A visit with no link is not a tailored visit, and must be scrubbed of the
      // last one. Tailoring lives in sessionStorage, which belongs to the TAB rather
      // than the page, so it outlives the link that set it: open a share link and then
      // type the bare domain in the same tab and the greeting meant for someone else
      // was still there, addressing you by their name. Clearing the store is not
      // enough on its own - anything already mounted has read it - so the empty
      // tailoring is announced the same way a real one would be.
      if (!live) {
        clearTailor();
        announceTailor(null);
      }

      return () => {
        dead = true;
        io?.disconnect();
        document.removeEventListener("click", onClick);
        window.removeEventListener("open-cv", onCvEvent);
        try {
          (window as unknown as { fetch: typeof fetch }).fetch = origFetch;
        } catch {
          /* ignore */
        }
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
      if (!w.__trails_nav_seen) {
        w.__trails_nav_seen = true;
        return;
      }
      if (pathname) w.__trails?.track("nav", pathname);
    } catch {
      /* ignore */
    }
  }, [pathname]);

  return null;
}