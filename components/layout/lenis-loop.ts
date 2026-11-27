/**
 * Tiny shared frame loop for Lenis instances.
 *
 * Mirrors the site's original loop behaviour: it sleeps after 2.5s of no
 * activity and whenever the tab is hidden, so scrolling never keeps the main
 * thread hot (which was raising input delay on the marketing pages).
 */

export interface LenisDriver {
  raf(time: number): void;
  isScrolling?: boolean | string;
  isStopped?: boolean;
  on?(event: string, cb: () => void): void;
  off?(event: string, cb: () => void): void;
}

const IDLE_MS = 2500;

export function createLenisLoop(getDrivers: () => readonly LenisDriver[]): {
  wake(): void;
  destroy(): void;
} {
  let raf = 0;
  let lastActivity = performance.now();

  const tick = (time: number): void => {
    if (document.hidden) {
      raf = 0;
      return;
    }
    const drivers = getDrivers();
    // `isScrolling === "native"` means Lenis handed the gesture back to the
    // browser — no frames need pumping for that.
    const active = drivers.some((driver) => driver.isScrolling === true);
    if (active || performance.now() - lastActivity < IDLE_MS) {
      for (const driver of drivers) driver.raf(time);
      raf = requestAnimationFrame(tick);
    } else {
      raf = 0; // sleep until the next real interaction
    }
  };

  const wake = (): void => {
    lastActivity = performance.now();
    if (!raf) raf = requestAnimationFrame(tick);
  };

  const markActive = (): void => {
    lastActivity = performance.now();
  };
  for (const driver of getDrivers()) driver.on?.("scroll", markActive);

  const onVisibility = (): void => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else {
      wake();
    }
  };
  window.addEventListener("wheel", wake, { passive: true });
  window.addEventListener("touchmove", wake, { passive: true });
  window.addEventListener("keydown", wake);
  document.addEventListener("visibilitychange", onVisibility);

  raf = requestAnimationFrame(tick);

  return {
    wake,
    destroy() {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("wheel", wake);
      window.removeEventListener("touchmove", wake);
      window.removeEventListener("keydown", wake);
      for (const driver of getDrivers()) driver.off?.("scroll", markActive);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
