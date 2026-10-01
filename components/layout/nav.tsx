"use client";

import { FileText, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { flushSync } from "react-dom";
import { pagerEnabled, requestSectionNavigate } from "@/components/transitions";
import { requestCvOpen } from "@/components/cv/CvModal";
import { ME } from "@/data/me";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type NavItem = {
  label: string;
  href: string;
};

// Mirrors the pager SECTIONS in app/page.tsx — every full-height section is
// reachable from the nav, and every href resolves to a real element id.
// About is omitted because it is `sr-only` on `/`: a menu link to a 1px box
// would scroll sighted users somewhere meaningless.
const NAV_ITEMS: readonly NavItem[] = [
  { label: "Home", href: "#hero" },
  { label: "Projects", href: "#projects" },
  { label: "Stack", href: "#stack" },
  { label: "Contact", href: "#booking" },
];

/** Ids the pager/nav are allowed to jump to (see the scroll-target effect). */
const NAV_TARGETS = ["hero", "projects", "stack", "booking"] as const;

type NavDims = {
  closedW: number;
  closedH: number;
  openW: number;
  openH: number;
};

function measureNav(inner: HTMLDivElement, bar: HTMLDivElement): NavDims {
  const w = inner.style.width;
  const h = inner.style.height;
  inner.style.width = "var(--open-width)";
  inner.style.height = "auto";
  const openW = inner.offsetWidth;
  const openH = inner.offsetHeight;
  inner.style.width = "var(--closed-width)";
  const closedW = inner.offsetWidth;
  inner.style.width = w;
  inner.style.height = h;
  return { closedW, closedH: bar.offsetHeight, openW, openH };
}

function syncNavState(
  nav: HTMLElement,
  toggle: HTMLButtonElement,
  panel: HTMLDivElement,
  isOpen: boolean
): void {
  nav.setAttribute("data-bottom-nav-open", String(isOpen));
  toggle.setAttribute("aria-expanded", String(isOpen));
  toggle.setAttribute("aria-label", isOpen ? "close menu" : "open menu");
  panel.setAttribute("aria-hidden", String(!isOpen));
}

// gsap (~114KB with easing) only animates the menu open/close choreography,
// so it stays out of the initial bundle and loads on idle / toggle
// hover-focus. Same timelines once loaded; an imperative snap covers the
// rare race where the user toggles first.
type GsapApi = {
  gsap: typeof import("gsap").default;
  CustomEase: typeof import("gsap/CustomEase").CustomEase;
};

let gsapCache: GsapApi | null = null;
let gsapInflight: Promise<GsapApi> | null = null;

function loadGsap(): Promise<GsapApi> {
  if (gsapCache) return Promise.resolve(gsapCache);
  if (!gsapInflight) {
    gsapInflight = (async () => {
      const [{ default: gsap }, { CustomEase }] = await Promise.all([
        import("gsap"),
        import("gsap/CustomEase"),
      ]);
      gsap.registerPlugin(CustomEase);
      if (!CustomEase.get("osmo")) {
        CustomEase.create("osmo", "M0,0 C0.625,0.05 0,1 1,1");
      }
      gsapCache = { gsap, CustomEase };
      return gsapCache;
    })();
  }
  return gsapInflight;
}

function prefetchGsap(): void {
  void loadGsap();
}

function useIsMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

function NavThemeToggle(): ReactNode {
  const mounted = useIsMounted();
  const { setTheme, resolvedTheme } = useTheme();
  const isDark = mounted && resolvedTheme === "dark";

  const toggleTheme = (event: React.MouseEvent<HTMLButtonElement>): void => {
    const next = isDark ? "light" : "dark";

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const supportsViewTransitions =
      typeof document !== "undefined" &&
      typeof (document as Document & { startViewTransition?: unknown })
        .startViewTransition === "function";

    if (!supportsViewTransitions || prefersReducedMotion) {
      setTheme(next);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = Math.hypot(
      Math.max(cx, window.innerWidth - cx),
      Math.max(cy, window.innerHeight - cy)
    );

    const root = document.documentElement;
    root.style.setProperty("--theme-cx", `${cx}px`);
    root.style.setProperty("--theme-cy", `${cy}px`);
    root.style.setProperty("--theme-r", `${radius}px`);
    root.dataset.themeAnim = "1";

    const transition = (
      document as Document & {
        startViewTransition: (cb: () => void) => { finished: Promise<void> };
      }
    ).startViewTransition(() => {
      // flushSync so the theme class flips synchronously inside the
      // transition callback — otherwise the browser snapshots old -> old
      // and the circular reveal never plays.
      flushSync(() => {
        setTheme(next);
      });
    });

    transition.finished.finally(() => {
      delete root.dataset.themeAnim;
    });
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={
        mounted
          ? isDark
            ? "Switch to light theme"
            : "Switch to dark theme"
          : "Toggle theme"
      }
      aria-pressed={mounted ? isDark : undefined}
      title="Toggle theme"
      className="bottom-nav__iconbtn focus-ring"
    >
      <span aria-hidden="true" className="relative h-4 w-4">
        <Sun
          className={`absolute inset-0 h-4 w-4 transition-all duration-300 ${
            mounted && isDark
              ? "rotate-0 scale-100 opacity-100"
              : "-rotate-90 scale-0 opacity-0"
          }`}
        />
        <Moon
          className={`absolute inset-0 h-4 w-4 transition-all duration-300 ${
            mounted && !isDark
              ? "rotate-0 scale-100 opacity-100"
              : "rotate-90 scale-0 opacity-0"
          }`}
        />
      </span>
    </button>
  );
}

function NavDocLink({ onOpen }: { onOpen?: () => void }): ReactNode {
  return (
    <button
      type="button"
      onClick={() => {
        onOpen?.();
        requestCvOpen();
      }}
      aria-label="View CV"
      title="View CV"
      className="bottom-nav__iconbtn focus-ring"
    >
      <FileText className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export function Nav(): ReactNode {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const hasOpenedRef = useRef(false);

  const [currentHash, setCurrentHash] = useState<string>("#hero");
  const [open, setOpen] = useState(false);
  const [gsapReady, setGsapReady] = useState(false);
  const openRef = useRef(false);
  openRef.current = open;
  // Dimensions cache: measuring forces a reflow (style write → offsetWidth
  // read), so measure on mount/resize/font-load only — never per toggle.
  const dimsRef = useRef<NavDims | null>(null);
  // State already snapped imperatively while gsap was missing: skip the
  // timeline once when gsap arrives so it doesn't replay visibly.
  const snappedRef = useRef<boolean | null>(null);

  const closeMenu = useCallback((): void => {
    setOpen(false);
  }, []);

  const toggleMenu = useCallback((): void => {
    setOpen((v) => !v);
  }, []);

  // ---- hash / scroll-spy (unchanged functionality) ----
  useEffect(() => {
    const syncFromLocation = (): void => {
      if (pathname === "/projects") {
        setCurrentHash("#projects");
        return;
      }
      if (pathname !== "/") return;
    };
    syncFromLocation();
    window.addEventListener("hashchange", syncFromLocation);
    return () => window.removeEventListener("hashchange", syncFromLocation);
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/") return;
    const pending = sessionStorage.getItem("scroll-target");
    const rawHash = window.location.hash.replace("#", "");
    const target = pending || rawHash;
    if (!target || !(NAV_TARGETS as readonly string[]).includes(target)) {
      return;
    }
    sessionStorage.removeItem("scroll-target");
    if (target === "booking") return;
    const id = requestAnimationFrame(() => {
      document
        .getElementById(target)
        ?.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
      setCurrentHash(`#${target}`);
    });
    if (rawHash) {
      history.replaceState(null, "", window.location.pathname);
    }
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/") return;
    const spy: Array<{ observe: string; hash: string }> = [
      { observe: "hero", hash: "#hero" },
      { observe: "projects-wrap", hash: "#projects" },
      { observe: "stack-wrap", hash: "#stack" },
    ];
    const els = spy
      .map(
        ({ observe }) =>
          document.getElementById(observe) ??
          document.getElementById(observe.replace("-wrap", ""))
      )
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;
    const hashFor = (id: string): string =>
      spy.find((s) => s.observe === id)?.hash ?? `#${id.replace("-wrap", "")}`;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.target.id) {
            setCurrentHash(hashFor(entry.target.id));
          }
        }
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [pathname]);

  const activeIndex = NAV_ITEMS.findIndex((item) => item.href === currentHash);

  // ---- Global nav listeners: Escape, outside click, resize (registered once) ----
  useEffect(() => {
    const onKeydown = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && openRef.current) {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onDocClick = (e: MouseEvent): void => {
      const nav = navRef.current;
      if (openRef.current && nav && !nav.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = (): void => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const inner = innerRef.current;
        const bar = barRef.current;
        if (!inner || !bar) return;
        const dims = measureNav(inner, bar);
        dimsRef.current = dims;
        // gsap loads lazily and may not be here yet: plain style writes
        // are pixel-identical for these end-state snaps.
        const g = gsapCache?.gsap;
        if (openRef.current) {
          if (g) g.set(inner, { width: dims.openW, height: dims.openH });
          else {
            inner.style.width = `${dims.openW}px`;
            inner.style.height = `${dims.openH}px`;
          }
        } else {
          tlRef.current?.kill();
          tlRef.current = null;
          if (g) g.set(inner, { width: dims.closedW, height: dims.closedH });
          else {
            inner.style.width = `${dims.closedW}px`;
            inner.style.height = `${dims.closedH}px`;
          }
        }
      }, 150);
    };
    document.addEventListener("keydown", onKeydown);
    document.addEventListener("click", onDocClick);
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(resizeTimer);
      document.removeEventListener("keydown", onKeydown);
      document.removeEventListener("click", onDocClick);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // ---- Osmo expanding-bottom-nav animation, driven by React `open` state ----
  // gsap itself loads lazily (see prefetch below): while it isn't here yet,
  // toggles snap to the same end-state pixels with plain style writes.
  useEffect(() => {
    const nav = navRef.current;
    const inner = innerRef.current;
    const bar = barRef.current;
    const panel = panelRef.current;
    const toggle = toggleRef.current;
    if (!nav || !inner || !bar || !panel || !toggle) return;

    if (open) hasOpenedRef.current = true;

    // Snap helpers (gsap-free path): mirror the timeline end states.
    const revealEls = () =>
      Array.from(panel.querySelectorAll<HTMLElement>("[data-bottom-nav-reveal]"));
    const snapShut = (dims: NavDims) => {
      inner.style.width = `${dims.closedW}px`;
      inner.style.height = `${dims.closedH}px`;
      panel.style.visibility = "hidden";
      panel.style.opacity = "0";
      for (const el of revealEls()) {
        el.style.visibility = "hidden";
        el.style.opacity = "0";
      }
    };
    const snapOpen = (dims: NavDims) => {
      inner.style.width = `${dims.openW}px`;
      inner.style.height = `${dims.openH}px`;
      panel.style.visibility = "inherit";
      panel.style.opacity = "1";
      for (const el of revealEls()) {
        el.style.visibility = "inherit";
        el.style.opacity = "1";
        el.style.transform = "";
      }
    };

    // Never animated yet and currently closed: snap shut, no timeline.
    if (!open && !hasOpenedRef.current) {
      const dims = measureNav(inner, bar);
      dimsRef.current = dims;
      snapShut(dims);
      syncNavState(nav, toggle, panel, false);
      return;
    }

    // Already snapped to this exact state while gsap was missing: nothing
    // to animate when the library arrives late.
    if (snappedRef.current === open) {
      snappedRef.current = null;
      return;
    }

    if (!gsapCache) {
      const dims = dimsRef.current ?? measureNav(inner, bar);
      dimsRef.current = dims;
      syncNavState(nav, toggle, panel, open);
      if (open) snapOpen(dims);
      else snapShut(dims);
      snappedRef.current = open;
      void loadGsap().then(() => setGsapReady(true));
      return;
    }

    const { gsap } = gsapCache;
    // Cached dims: measuring here would force a reflow on every toggle
    // (write styles → read offsetWidth). Refresh happens on resize /
    // font load instead (see effects below).
    const dims = dimsRef.current ?? measureNav(inner, bar);
    dimsRef.current = dims;
    syncNavState(nav, toggle, panel, open);

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const k = reduced ? 0 : 1;

    const reveals = panel.querySelectorAll("[data-bottom-nav-reveal]");
    const barTop = toggle.querySelector(".bottom-nav__toggle-bar.is--top");
    const barBot = toggle.querySelector(".bottom-nav__toggle-bar.is--btm");
    const divider = nav.querySelector("[data-bottom-nav-divider]");

    tlRef.current?.kill();
    const tl = gsap.timeline({ defaults: { ease: "osmo" } });
    tlRef.current = tl;

    if (open) {
      tl.to(
        inner,
        { width: dims.openW, height: dims.openH, duration: 0.65 * k },
        0
      )
        .to(
          barTop,
          {
            y: "0.175em",
            rotation: 45,
            duration: 0.4 * k,
            ease: "back.out(2)",
          },
          0.05 * k
        )
        .to(
          barBot,
          {
            y: "-0.175em",
            rotation: -45,
            duration: 0.4 * k,
            ease: "back.out(2)",
          },
          0.05 * k
        )
        .set(panel, { autoAlpha: 1 }, 0.1 * k)
        .fromTo(
          reveals,
          { autoAlpha: 0, yPercent: 100 },
          {
            autoAlpha: 1,
            yPercent: 0,
            duration: 0.6 * k,
            stagger: 0.03 * k,
          },
          0.1 * k
        );
      if (divider) {
        tl.fromTo(
          divider,
          { scaleX: 0, autoAlpha: 0 },
          { scaleX: 1, autoAlpha: 1, duration: 1.1 * k },
          0
        );
      }
    } else {
      tl.to(
        reveals,
        {
          autoAlpha: 0,
          yPercent: 10,
          duration: 0.25 * k,
          stagger: { each: 0.01, from: "end" },
        },
        0
      )
        .to(
          inner,
          {
            width: dims.closedW,
            height: dims.closedH,
            duration: 0.45 * k,
            ease: "power3.inOut",
          },
          0
        )
        .to(
          [barTop, barBot],
          { y: 0, rotation: 0, duration: 0.3 * k, ease: "power3.in" },
          0
        )
        .set(panel, { autoAlpha: 0 });
    }

    return () => {
      tl.kill();
      if (tlRef.current === tl) tlRef.current = null;
    };
  }, [open, gsapReady]);

  // gsap travels off the critical path: idle prefetch (+ toggle
  // hover/focus below) so the first menu open is usually still animated.
  useEffect(() => {
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const kick = () => {
      void loadGsap().then(() => setGsapReady(true));
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(kick, { timeout: 8000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(kick, 5000);
    return () => window.clearTimeout(t);
  }, []);

  // Re-measure once webfonts settle (dims depend on rendered text size).
  useEffect(() => {
    let cancelled = false;
    try {
      void document.fonts?.ready.then(() => {
        if (cancelled) return;
        const inner = innerRef.current;
        const bar = barRef.current;
        if (!inner || !bar) return;
        dimsRef.current = measureNav(inner, bar);
      });
    } catch {
      // non-fatal: resize handler + toggle fallback still measure
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // close menu on route change
  useEffect(() => {
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

// Section navigation: desktop pager plays the curtain + slide (via the
// SectionTransition provider on the home page); mobile / touch /
// reduced-motion keeps the Lenis smooth glide. Keyboard users land on the
// section heading so focus follows the visible change.
function scrollToSection(id: string, moveFocus = false): void {
  const el =
    document.getElementById(id) ?? document.getElementById(`${id}-wrap`);
  if (!el) return;
  try {
    const lenis = (
      window as unknown as {
        __lenis?: {
          scrollTo?: (target: HTMLElement, opts?: Record<string, unknown>) => void;
        };
      }
    ).__lenis;
    if (lenis?.scrollTo) {
      lenis.scrollTo(el, { offset: 0, duration: 1.1 });
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (moveFocus) {
    try {
      const target =
        el.querySelector<HTMLElement>("[data-pager-focus]") ?? el;
      target.focus({ preventScroll: true });
    } catch {
      // non-fatal: already scrolled visually
    }
  }
}

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    item: NavItem
  ): void => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    const id = item.href.slice(1);
    if (id === "booking") {
      if (pathname !== "/") {
        sessionStorage.setItem("pending-booking", "1");
        window.location.href = "/";
        return;
      }
      window.dispatchEvent(new CustomEvent("open-booking"));
      return;
    }
    if (pathname !== "/") {
      sessionStorage.setItem("scroll-target", id);
      window.location.href = "/";
      return;
    }
    const moveFocus = e.detail === 0;
    if (pagerEnabled()) {
      requestSectionNavigate(id, moveFocus);
      setCurrentHash(item.href);
      return;
    }
    scrollToSection(id, moveFocus);
    setCurrentHash(item.href);
  };

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    handleNavClick(e, { label: "Home", href: "#hero" });
  };

  return (
    <nav
      ref={navRef}
      data-bottom-nav-init
      data-bottom-nav-open="false"
      aria-label="Primary"
      className="bottom-nav"
    >
      <div ref={innerRef} data-bottom-nav-inner className="bottom-nav__inner">
        <div ref={barRef} data-bottom-nav-bar className="bottom-nav__bar">
          <Link
            href="#hero"
            onClick={handleLogoClick}
            className="bottom-nav__logo focus-ring"
            aria-label="Mohand Darwish — home"
          >
            <span aria-hidden="true" className="bottom-nav__wordmark">
              Mohandarwish<span className="bottom-nav__wordmark-accent">.©</span>
            </span>
          </Link>
          <div className="bottom-nav__actions">
            <NavDocLink onOpen={closeMenu} />
            <NavThemeToggle />
            <button
              ref={toggleRef}
              type="button"
              data-bottom-nav-toggle
              aria-expanded="false"
              aria-label="open menu"
              aria-controls="bottom-nav-panel"
              onClick={toggleMenu}
              onMouseEnter={prefetchGsap}
              onFocus={prefetchGsap}
              className="bottom-nav__toggle focus-ring"
            >
              <span className="bottom-nav__toggle-bar is--top" />
              <span className="bottom-nav__toggle-bar is--btm" />
            </button>
          </div>
        </div>

        <div
          ref={panelRef}
          id="bottom-nav-panel"
          aria-hidden="true"
          // Closed panel is clipped (not display:none) but still in the DOM:
          // inert keeps its links out of the tab order and accessibility
          // tree until opened. No visual effect; aria-hidden sync stays in
          // syncNavState. React renders this SSR-correct (open=false).
          inert={!open}
          data-bottom-nav-panel
          className="bottom-nav__panel"
        >
          <ul className="bottom-nav__list">
            {NAV_ITEMS.map((item, idx) => {
              const isActive = idx === activeIndex;
              const isCta = item.href === "#booking";
              return (
                <li
                  key={item.href}
                  data-bottom-nav-reveal
                  className="bottom-nav__list-item"
                >
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={(e) => handleNavClick(e, item)}
                    className={`bottom-nav__link focus-ring${isCta ? " is--cta" : ""}${isActive ? " is--active" : ""}`}
                  >
                    <span aria-hidden="true" className="bottom-nav__index">
                      0{idx + 1}
                    </span>
                    <span>{item.label}</span>
                    <span
                      aria-hidden="true"
                      className={`bottom-nav__dot${isActive ? " is--on" : ""}`}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>

          <div data-bottom-nav-divider className="bottom-nav__divider" />

          <div className="bottom-nav__secondary">
            <div className="bottom-nav__col">
              <span data-bottom-nav-reveal className="bottom-nav__label">
                socials
              </span>
              <ul className="bottom-nav__list">
                {(
                  [
                    { label: "GitHub", href: ME.socials.github },
                    { label: "LinkedIn", href: ME.socials.linkedin },
                    { label: "YouTube", href: ME.socials.youtube },
                    { label: "X/Twitter", href: ME.socials.x },
                  ] as const
                ).map((s) => (
                  <li
                    key={s.label}
                    data-bottom-nav-reveal
                    className="bottom-nav__list-item"
                  >
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noreferrer"
                      className="bottom-nav__sublink focus-ring"
                    >
                      {s.label} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bottom-nav__col">
              <span data-bottom-nav-reveal className="bottom-nav__label">
                studio
              </span>
              <ul className="bottom-nav__list">
                <li data-bottom-nav-reveal className="bottom-nav__list-item">
                  <a
                    href={`mailto:${ME.email}`}
                    className="bottom-nav__sublink focus-ring"
                  >
                    {ME.email}
                  </a>
                </li>
                <li data-bottom-nav-reveal className="bottom-nav__list-item">
                  <span className="bottom-nav__meta">
                    {ME.location} • {ME.availability}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
