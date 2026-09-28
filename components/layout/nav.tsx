"use client";

import { FileText, Moon, Sun } from "lucide-react";
import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { requestCvOpen } from "@/components/cv/CvModal";
import { requestSectionNavigate } from "@/components/transitions";
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

const NAV_ITEMS: readonly NavItem[] = [
  { label: "Home", href: "#hero" },
  { label: "Projects", href: "#projects" },
  { label: "Stack", href: "#stack" },
  { label: "Contact", href: "#booking" },
];

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

function ensureOsmoEase(): void {
  gsap.registerPlugin(CustomEase);
  if (!CustomEase.get("osmo")) {
    CustomEase.create("osmo", "M0,0 C0.625,0.05 0,1 1,1");
  }
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
      setTheme(next);
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
  const openRef = useRef(false);
  openRef.current = open;

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
    if (
      !target ||
      (target !== "hero" &&
        target !== "projects" &&
        target !== "stack" &&
        target !== "booking")
    ) {
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
        if (openRef.current) {
          gsap.set(inner, { width: dims.openW, height: dims.openH });
        } else {
          tlRef.current?.kill();
          tlRef.current = null;
          gsap.set(inner, { width: dims.closedW, height: dims.closedH });
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
  useEffect(() => {
    const nav = navRef.current;
    const inner = innerRef.current;
    const bar = barRef.current;
    const panel = panelRef.current;
    const toggle = toggleRef.current;
    if (!nav || !inner || !bar || !panel || !toggle) return;

    if (open) hasOpenedRef.current = true;

    // Never animated yet and currently closed: snap shut, no timeline.
    if (!open && !hasOpenedRef.current) {
      const dims = measureNav(inner, bar);
      gsap.set(inner, { width: dims.closedW, height: dims.closedH });
      syncNavState(nav, toggle, panel, false);
      return;
    }

    ensureOsmoEase();
    const dims = measureNav(inner, bar);
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
  }, [open]);

  // close menu on route change
  useEffect(() => {
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    item: NavItem
  ): void => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    if (document.documentElement.dataset.sectionTransition === "1") return;
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
    requestSectionNavigate(id, e.detail === 0);
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
