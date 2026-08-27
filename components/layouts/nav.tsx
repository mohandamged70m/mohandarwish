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

      {/* Mobile — minimal hamburger only */}
      <div className="lg:hidden">
        {/* floating action cluster — just theme + hamburger, no brand bar */}
        <div className="fixed top-4 right-4 z-[60] flex items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-bg-surface/80 backdrop-blur-xl shadow-sm supports-[backdrop-filter]:bg-bg-surface/70">
            <div className="scale-[1.05] [&_button]:!h-8 [&_button]:!w-8 [&_button]:!border-0 [&_button]:!bg-transparent [&_button]:!shadow-none">
              <NavThemeToggle />
            </div>
          </div>
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-panel"
            onClick={() => setMobileOpen((v) => !v)}
            className={`focus-ring inline-flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-xl shadow-sm transition-all duration-200 cursor-pointer ${
              mobileOpen
                ? "bg-accent text-text-on-accent border-accent shadow-accent rotate-0"
                : "bg-bg-surface/80 border-border text-text-primary hover:border-border-strong supports-[backdrop-filter]:bg-bg-surface/70"
            }`}
          >
            <HamburgerIcon open={mobileOpen} />
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <>
              {/* full-screen minimal drawer */}
              <motion.div
                id="mobile-nav-panel"
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="fixed inset-0 z-50 flex min-h-dvh flex-col bg-bg-primary"
              >
                {/* subtle grid + glow — very restrained */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,var(--border-strong)_1px,transparent_1px),linear-gradient(to_bottom,var(--border-strong)_1px,transparent_1px)] bg-[size:32px_32px]"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-24 right-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(ellipse_at_center,var(--accent-ring)_0%,transparent_70%)] opacity-60 blur-[40px]"
                />

                {/* centered nav */}
                <nav className="relative flex flex-1 flex-col items-center justify-center px-6 py-20">
                  {/* thin top hairline */}
                  <motion.div
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
                    className="absolute top-24 h-px w-12 origin-center bg-gradient-to-r from-transparent via-border-strong to-transparent"
                  />
                  <ul className="flex w-full max-w-[320px] flex-col">
                    {NAV_ITEMS.map((item, idx) => {
                      const isActive = idx === activeIndex;
                      return (
                        <motion.li
                          key={item.href}
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          transition={{
                            duration: 0.35,
                            ease: [0.22, 1, 0.36, 1],
                            delay: 0.06 + idx * 0.05,
                          }}
                          className="group relative"
                        >
                          <Link
                            href={item.href}
                            aria-current={isActive ? "page" : undefined}
                            onClick={(e) => handleNavClick(e, item)}
                            className="focus-ring flex items-baseline gap-4 rounded-xl px-2 py-4 -mx-2 transition-colors"
                          >
                            {/* index — mono, muted, fixed width */}
                            <span
                              className={`font-heading text-xs tabular-nums tracking-widest transition-colors ${
                                isActive ? "text-accent" : "text-text-muted/60 group-hover:text-text-muted"
                              }`}
                            >
                              0{idx + 1}
                            </span>

                            {/* label — large, editorial */}
                            <span
                              className={`font-heading text-[2.05rem] font-bold leading-none tracking-[-0.02em] transition-colors ${
                                isActive
                                  ? "text-accent"
                                  : "text-text-primary group-hover:text-accent group-active:text-accent"
                              }`}
                            >
                              {item.label}
                            </span>

                            {/* active dot — the single signature */}
                            <span
                              aria-hidden
                              className={`ml-auto h-1.5 w-1.5 rounded-full bg-accent transition-all duration-300 ${
                                isActive ? "opacity-100 scale-100" : "opacity-0 scale-0 group-hover:opacity-40 group-hover:scale-100"
                              }`}
                            />
                          </Link>

                          {/* hairline divider — not after last */}
                          {idx !== NAV_ITEMS.length - 1 && (
                            <div className="h-px w-full bg-border/60" />
                          )}
                        </motion.li>
                      );
                    })}
                  </ul>

                  {/* bottom meta — ultra minimal */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.32, duration: 0.4 }}
                    className="absolute bottom-0 inset-x-0 flex flex-col items-center gap-3 border-t border-border/50 px-6 py-6"
                  >
                    <p className="font-heading text-[11px] tracking-[0.14em] uppercase text-text-muted">
                      Mohand Darwish — Alexandria • Available for new work
                    </p>
                    <Link
                      href="#booking"
                      onClick={(e) =>
                        handleNavClick(e, { label: "Contact", href: "#booking" })
                      }
                      className="font-heading text-sm font-medium text-text-secondary hover:text-accent underline underline-offset-4 decoration-border hover:decoration-accent/50 transition-colors"
                    >
                      Book a call →
                    </Link>
                  </motion.div>
                </nav>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
