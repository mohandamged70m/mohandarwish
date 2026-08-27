"use client";

import { Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
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
  { label: "Home", href: "/" },
  { label: "Projects", href: "/projects" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "#booking" },
];

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
      typeof document.startViewTransition === "function";

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

    const transition = document.startViewTransition(() => {
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
      className="focus-ring relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors sm:h-9 sm:w-9"
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

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="relative flex h-4 w-4 flex-col items-center justify-center"
    >
      <motion.span
        animate={open ? { rotate: 45, y: 0 } : { rotate: 0, y: -5 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="absolute h-0.5 w-4 rounded-full bg-current"
        style={{ top: "50%", marginTop: -1 }}
      />
      <motion.span
        animate={open ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.15 }}
        className="absolute h-0.5 w-4 rounded-full bg-current"
        style={{ top: "50%", marginTop: -1 }}
      />
      <motion.span
        animate={open ? { rotate: -45, y: 0 } : { rotate: 0, y: 5 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="absolute h-0.5 w-4 rounded-full bg-current"
        style={{ top: "50%", marginTop: -1 }}
      />
    </span>
  );
}

export function Nav(): ReactNode {
  const pathname = usePathname();
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const [pillRect, setPillRect] = useState<{
    x: number;
    width: number;
  } | null>(null);
  const [hasMeasured, setHasMeasured] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeIndex = NAV_ITEMS.findIndex((item) =>
    item.href === "/"
      ? pathname === "/"
      : pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  // desktop pill measurement
  useLayoutEffect(() => {
    const list = listRef.current;
    const activeEl =
      activeIndex >= 0 ? itemRefs.current[activeIndex] : null;
    if (!list || !activeEl) {
      setPillRect(null);
      return;
    }
    const listRect = list.getBoundingClientRect();
    const itemRect = activeEl.getBoundingClientRect();
    setPillRect({
      x: itemRect.left - listRect.left,
      width: itemRect.width,
    });
  }, [activeIndex, pathname]);

  useEffect(() => {
    if (!pillRect) return;
    const id = requestAnimationFrame(() => setHasMeasured(true));
    return () => cancelAnimationFrame(id);
  }, [pillRect]);

  // close mobile on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // lock scroll when mobile open + esc to close
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    item: NavItem
  ): void => {
    const isHash = item.href.startsWith("#");
    if (!isHash) {
      setMobileOpen(false);
      return;
    }
    e.preventDefault();
    setMobileOpen(false);
    const id = item.href.slice(1);
    if (id === "booking") {
      if (pathname !== "/") {
        window.location.href = `/#booking`;
        return;
      }
      window.location.hash = "#booking";
      return;
    }
    if (pathname !== "/") {
      window.location.href = `/${item.href}`;
      return;
    }
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.pushState(null, "", item.href);
  };

  return (
    <>
      {/* Desktop — floating pill, hidden on mobile */}
      <nav
        aria-label="Primary"
        className="hidden lg:block fixed left-1/2 top-6 z-50 -translate-x-1/2"
      >
        <div className="flex items-center gap-1 rounded-full bg-bg-surface p-1.5 shadow-sm border border-border">
          <ul ref={listRef} className="relative flex items-center gap-1">
            {pillRect && (
              <motion.span
                aria-hidden="true"
                initial={false}
                animate={{ x: pillRect.x, width: pillRect.width }}
                transition={
                  hasMeasured
                    ? { type: "spring", stiffness: 380, damping: 32 }
                    : { duration: 0 }
                }
                style={{ left: 0, top: 0, bottom: 0 }}
                className="absolute rounded-full bg-accent/10 ring-1 ring-accent/20"
              />
            )}
            {NAV_ITEMS.map((item, index) => {
              const isActive = index === activeIndex;
              const isHash = item.href.startsWith("#");
              return (
                <li
                  key={item.href}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  className="relative"
                >
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={(e) => {
                      if (isHash) {
                        e.preventDefault();
                        const id = item.href.slice(1);
                        if (id === "booking") {
                          if (pathname !== "/") {
                            window.location.href = `/#booking`;
                            return;
                          }
                          window.location.hash = "#booking";
                          return;
                        }
                        if (pathname !== "/") {
                          window.location.href = `/${item.href}`;
                          return;
                        }
                        document
                          .getElementById(id)
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                        window.history.pushState(null, "", item.href);
                      }
                    }}
                    className="focus-ring relative inline-flex cursor-pointer items-center justify-center rounded-full px-4 py-1.5 text-sm font-medium font-heading transition-colors duration-300"
                  >
                    <span
                      className={
                        isActive
                          ? "relative z-10 text-accent"
                          : "relative z-10 text-text-secondary hover:text-text-primary"
                      }
                    >
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <NavThemeToggle />
        </div>
      </nav>

      {/* Mobile — top bar with hamburger */}
      <header className="lg:hidden fixed inset-x-0 top-0 z-50 pointer-events-none">
        {/* floating bar */}
        <div className="pointer-events-auto mx-3 mt-3 flex items-center justify-between rounded-full bg-bg-surface/90 backdrop-blur-xl border border-border px-2 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] supports-[backdrop-filter]:bg-bg-surface/80">
          {/* brand */}
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="focus-ring flex items-center gap-2 rounded-full pl-3 pr-1 py-1"
            aria-label="Go to homepage"
          >
            <span className="font-heading font-bold text-sm tracking-tight text-text-primary">
              M<span className="text-accent">.</span>DARWISH
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-accent/10 ring-1 ring-accent/20 px-2 py-0.5 font-heading text-[10px] font-medium uppercase tracking-widest text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Available
            </span>
          </Link>

          <div className="flex items-center gap-1.5">
            <NavThemeToggle />
            <button
              type="button"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-panel"
              onClick={() => setMobileOpen((v) => !v)}
              className={`focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-medium transition-colors cursor-pointer ${
                mobileOpen
                  ? "bg-accent text-text-on-accent border-accent shadow-accent"
                  : "bg-bg-primary border-border text-text-primary hover:border-border-strong"
              }`}
            >
              <HamburgerIcon open={mobileOpen} />
            </button>
          </div>
        </div>

        {/* overlay + panel */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              {/* backdrop */}
              <motion.button
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="pointer-events-auto fixed inset-0 -z-10 bg-bg-primary/40 backdrop-blur-sm cursor-pointer"
                style={{ marginTop: 0 }}
              />

              {/* panel — dropdown sheet */}
              <motion.div
                id="mobile-nav-panel"
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{
                  type: "spring",
                  stiffness: 380,
                  damping: 30,
                  mass: 0.8,
                }}
                className="pointer-events-auto mx-3 mt-2 overflow-hidden rounded-[24px] border border-border bg-bg-surface shadow-[0_16px_48px_rgba(0,0,0,0.18)]"
              >
                <nav className="p-2">
                  <ul className="flex flex-col gap-1">
                    {NAV_ITEMS.map((item, idx) => {
                      const isActive = idx === activeIndex;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={isActive ? "page" : undefined}
                            onClick={(e) => handleNavClick(e, item)}
                            className={`group flex items-center justify-between rounded-2xl px-4 py-3.5 font-heading text-[17px] font-medium tracking-tight transition-all duration-200 ${
                              isActive
                                ? "bg-accent text-text-on-accent shadow-accent"
                                : "bg-transparent text-text-primary hover:bg-bg-surface-hover active:scale-[0.98]"
                            }`}
                          >
                            <span className="flex items-center gap-3">
                              <span
                                className={`font-mono text-xs tracking-widest ${
                                  isActive ? "text-text-on-accent/70" : "text-text-muted"
                                }`}
                              >
                                0{idx + 1}
                              </span>
                              <span>{item.label}</span>
                            </span>
                            <span
                              className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs transition-colors ${
                                isActive
                                  ? "border-text-on-accent/20 bg-text-on-accent/10 text-text-on-accent"
                                  : "border-border bg-bg-primary text-text-muted group-hover:border-accent/30 group-hover:text-accent"
                              }`}
                            >
                              <motion.span
                                animate={{ x: isActive ? 0 : 0 }}
                                className="text-[11px]"
                              >
                                {isActive ? "•" : "→"}
                              </motion.span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>

                  {/* footer meta */}
                  <div className="mt-2 rounded-2xl bg-bg-primary border border-border p-4">
                    <p className="font-heading text-xs font-medium uppercase tracking-widest text-text-muted">
                      Get in touch
                    </p>
                    <p className="mt-1 font-body text-sm leading-relaxed text-text-secondary">
                      Have an idea? Let&apos;s build it — fast, clean, scalable.
                    </p>
                    <Link
                      href="#booking"
                      onClick={(e) =>
                        handleNavClick(e, { label: "Contact", href: "#booking" })
                      }
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 font-heading text-sm font-semibold text-text-on-accent hover:bg-accent-hover transition-colors focus-ring"
                    >
                      Book a call
                      <span aria-hidden>→</span>
                    </Link>
                    <div className="mt-3 flex items-center justify-between font-heading text-[11px] text-text-muted">
                      <span>Alexandria, Egypt • GMT+2</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Online
                      </span>
                    </div>
                  </div>
                </nav>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
