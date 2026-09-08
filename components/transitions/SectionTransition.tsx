'use client';

import { motion, useAnimationControls, useReducedMotion } from 'motion/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type SectionDef = { id: string; label: string };

type SectionTransitionCtx = {
  activeId: string;
  cycle: number;
  direction: 1 | -1;
  isTransitioning: boolean;
  navigateTo: (id: string, moveFocus?: boolean) => void;
};

const defaultCtx: SectionTransitionCtx = {
  activeId: 'hero',
  cycle: 0,
  direction: 1,
  isTransitioning: false,
  navigateTo: () => {},
};

const Ctx = createContext<SectionTransitionCtx>(defaultCtx);

export function useSectionTransition(): SectionTransitionCtx {
  return useContext(Ctx);
}

// Dispatched by nav / buttons; the pager mounted on the home page performs
// the curtain + slide transition. Booking stays a modal (no pager section).
// moveFocus is true for keyboard-activated controls (click detail === 0) so
// focus follows the section change instead of stranding on the trigger.
export function requestSectionNavigate(id: string, moveFocus = false): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<{ id: string; moveFocus: boolean }>('section-navigate', {
      detail: { id, moveFocus },
    })
  );
}

const EASE = [0.22, 1, 0.36, 1] as const;
const COVER_MS = 240;
const HOLD_MS = 460;
// ui-ux exit-faster-than-enter: lift resolves snappier than the cover.
const EXIT_MS = 180;
const COOLDOWN_MS = 1150;
const WHEEL_THRESHOLD = 60;

type LenisHandle = { stop?: () => void; start?: () => void };

function getLenis(): LenisHandle | undefined {
  try {
    return (window as unknown as { __lenis?: LenisHandle }).__lenis;
  } catch {
    return undefined;
  }
}

// Desktop pager is active on md+ with a fine pointer and no reduced motion.
// Mobile / touch / reduced-motion keep the free-scroll page (no curtain).
function pagerEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (!window.matchMedia('(min-width: 768px)').matches) return false;
  if (!window.matchMedia('(pointer: fine)').matches) return false;
  return true;
}

function scrollToSectionNow(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  // Flush top (ignores scroll-mt): each pager section fills the viewport
  // from its top edge like a full page.
  const top = el.getBoundingClientRect().top + window.scrollY;
  window.scrollTo(0, top);
}

// Keyboard users land on the section heading so focus (and the screen
// reader) follows the visible change. Headings carry data-pager-focus +
// tabindex -1; falls back to the section container.
function focusSectionHeading(id: string): void {
  try {
    const root = document.getElementById(id);
    if (!root) return;
    const target =
      root.querySelector<HTMLElement>('[data-pager-focus]') ??
      (root as HTMLElement);
    target.focus({ preventScroll: true });
  } catch {
    // non-fatal: transition already completed visually
  }
}

export function SectionTransition({
  sections,
  children,
}: {
  sections: SectionDef[];
  children: ReactNode;
}): ReactNode {
  const reduceMotion = useReducedMotion();
  const [activeId, setActiveId] = useState(sections[0]?.id ?? 'hero');
  const [cycle, setCycle] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [stage, setStage] = useState<'idle' | 'cover' | 'hold' | 'exit'>('idle');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [pendingId, setPendingId] = useState('');
  // Screen-reader announcement for pointer/wheel arrivals (keyboard arrivals
  // are covered by focus moving to the heading — announcing both would echo).
  const [announcement, setAnnouncement] = useState('');
  const focusOnEnterRef = useRef(false);

  // SECTIONS is a module-level constant (see app/page.tsx), so `sections`
  // is referentially stable and safe to close over in callbacks.
  const activeRef = useRef(activeId);
  const transitioningRef = useRef(false);
  const lastNavRef = useRef(0);
  const wheelAccRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
    },
    []
  );

  // Fresh load (refresh, or client navigation back to "/") always starts
  // at hero like a normal page. Skipped when arriving with an explicit
  // intent: cross-page scroll-target / pending booking, or a hash link.
  useEffect(() => {
    try {
      if (sessionStorage.getItem('scroll-target')) return;
      if (sessionStorage.getItem('pending-booking')) return;
    } catch {
      // storage blocked — fall through to the top reset
    }
    if (window.location.hash) return;
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const navigateTo = useCallback(
    (id: string, moveFocus = false) => {
      const list = sections;
      // Accept content ids too ("projects" → "projects-wrap") so nav and
      // buttons don't need to know about wrapper naming.
      const resolved =
        list.some((s) => s.id === id)
          ? id
          : list.find((s) => s.id === `${id}-wrap`)?.id;
      if (!resolved) return;
      id = resolved;
    if (transitioningRef.current) return;
    if (activeRef.current === id) {
      // Already there — still honor keyboard focus requests.
      if (moveFocus) focusSectionHeading(id);
      return;
    }

    const order = list.map((s) => s.id);
    const dir: 1 | -1 = order.indexOf(id) > order.indexOf(activeRef.current) ? 1 : -1;
    const label = list.find((s) => s.id === id)?.label ?? id;

    // Mobile / touch / reduced-motion: silent instant jump, no curtain.
    if (!pagerEnabled()) {
      activeRef.current = id;
      setActiveId(id);
      scrollToSectionNow(id);
      if (moveFocus) focusSectionHeading(id);
      else setAnnouncement(label + ' section');
      return;
    }

    transitioningRef.current = true;
    focusOnEnterRef.current = moveFocus;
    lastNavRef.current = Date.now();
    wheelAccRef.current = 0;
    setPendingId(id);
    setDirection(dir);
    setCycle((c) => c + 1);
    setIsTransitioning(true);
    setStage('cover');
    document.documentElement.dataset.sectionTransition = '1';
    try {
      getLenis()?.stop?.();
    } catch {
      // non-fatal: native scroll still works under the curtain
    }

    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [
      window.setTimeout(() => {
        // Jump happens fully covered — the slide layer (SectionSlide) +
        // staggered letters carry the visible motion.
        scrollToSectionNow(id);
        setStage('hold');
      }, COVER_MS),
      window.setTimeout(() => {
        activeRef.current = id;
        setActiveId(id);
        setStage('exit');
        // Screen-reader users get one signal: focused heading for keyboard
        // arrivals, live-region announcement for pointer/wheel arrivals.
        if (focusOnEnterRef.current) focusSectionHeading(id);
        else setAnnouncement(label + ' section');
      }, COVER_MS + HOLD_MS),
      window.setTimeout(() => {
        setStage('idle');
        setIsTransitioning(false);
        transitioningRef.current = false;
        delete document.documentElement.dataset.sectionTransition;
        try {
          getLenis()?.start?.();
        } catch {
          // non-fatal
        }
      }, COVER_MS + HOLD_MS + EXIT_MS),
    ];
    },
    [sections]
  );

  // Nav / buttons talk to the pager through a CustomEvent (nav lives in the
  // root layout, outside this provider — same pattern as open-booking).
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string; moveFocus: boolean }>).detail;
      if (detail && typeof detail.id === 'string' && detail.id) {
        navigateTo(detail.id, detail.moveFocus === true);
      }
    };
    window.addEventListener('section-navigate', onNavigate);
    return () => window.removeEventListener('section-navigate', onNavigate);
  }, [navigateTo]);

  // Wheel hijack (desktop pager only): vertical wheel pages between sections.
  // Fullpage-style edges: a section taller than the viewport scrolls
  // natively first — paging only fires at its top/bottom edge. Scrollbar
  // drag + touch swipe are untouched and keep free-scrolling.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!pagerEnabled()) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest?.(
          '[role="dialog"], input, textarea, select, [contenteditable], [data-lenis-prevent]'
        )
      ) {
        return;
      }
      const dy = e.deltaY;
      const dx = e.deltaX ?? 0;
      if (dy === 0 || Math.abs(dy) < Math.abs(dx)) return;

      // Pin the page while the curtain runs / in cooldown.
      if (transitioningRef.current || Date.now() - lastNavRef.current < COOLDOWN_MS) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const ids = sections.map((s) => s.id);
      const mid = window.scrollY + window.innerHeight * 0.5;
      let cur = 0;
      ids.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top + window.scrollY <= mid) cur = i;
      });
      const curId = ids[cur] ?? activeRef.current;

      // Overflowing section: let the wheel scroll inside it until the edge
      // in this direction is reached — otherwise its tail is unreachable.
      const curEl = curId ? document.getElementById(curId) : null;
      if (curEl) {
        const rect = curEl.getBoundingClientRect();
        if (dy > 0 && rect.bottom > window.innerHeight + 1) {
          wheelAccRef.current = 0;
          return;
        }
        if (dy < 0 && rect.top < -1) {
          wheelAccRef.current = 0;
          return;
        }
      }

      e.preventDefault();
      e.stopPropagation();
      if (wheelAccRef.current !== 0 && Math.sign(dy) !== Math.sign(wheelAccRef.current)) {
        wheelAccRef.current = 0;
      }
      wheelAccRef.current += dy;
      if (Math.abs(wheelAccRef.current) < WHEEL_THRESHOLD) return;
      wheelAccRef.current = 0;

      activeRef.current = curId;
      const next = cur + (dy > 0 ? 1 : -1);
      if (next < 0 || next >= ids.length) return;
      navigateTo(ids[next]);
    };
    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => window.removeEventListener('wheel', onWheel, { capture: true });
  }, [navigateTo, sections]);

  // Silent active sync for free-scroll (scrollbar / touch): keeps context
  // honest without starting a transition or replaying entrances.
  const sectionKey = useMemo(() => sections.map((s) => s.id).join('|'), [sections]);
  useEffect(() => {
    const ids = sectionKey.split('|');
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (transitioningRef.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.target.id) {
            activeRef.current = entry.target.id;
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [sectionKey]);

  const value = useMemo<SectionTransitionCtx>(
    () => ({ activeId, cycle, direction, isTransitioning, navigateTo }),
    [activeId, cycle, direction, isTransitioning, navigateTo]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Polite single announcement for pointer/wheel arrivals. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
      <SectionCurtain
        stage={stage}
        direction={direction}
        label={sections.find((s) => s.id === pendingId)?.label ?? ''}
        reduceMotion={reduceMotion ?? false}
      />
    </Ctx.Provider>
  );
}

function SectionCurtain({
  stage,
  direction,
  label,
  reduceMotion,
}: {
  stage: 'idle' | 'cover' | 'hold' | 'exit';
  direction: 1 | -1;
  label: string;
  reduceMotion: boolean;
}): ReactNode {
  if (stage === 'idle' || reduceMotion || typeof document === 'undefined') return null;

  // Forward/down enters from the bottom and exits to the top; mirrored up.
  const from = direction === 1 ? '100%' : '-100%';
  const to = direction === 1 ? '-100%' : '100%';
  const exiting = stage === 'exit';
  const letters = label.split('');

  return createPortal(
    <div aria-hidden className="fixed inset-0 z-[200]">
      {/* trailing dark panel for depth */}
      <motion.div
        initial={{ y: from }}
        animate={{ y: exiting ? to : '0%' }}
        transition={{ duration: exiting ? 0.18 : 0.2, ease: EASE }}
        className="absolute inset-0 flex items-center justify-center overflow-hidden bg-accent"
      />
      {/* signature wine curtain */}
      <motion.div
        initial={{ y: from }}
        animate={{ y: exiting ? to : '0%' }}
        transition={{ duration: exiting ? 0.28 : 0.2, ease: EASE }}
        className="absolute inset-0 flex items-center justify-center overflow-hidden bg-accent"
      >
        <span className="flex overflow-hidden font-heading text-[clamp(1.75rem,5vw,3rem)] font-bold uppercase tracking-[0.12em] text-text-on-accent">
          {letters.map((ch, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: '110%', filter: 'blur(6px)' }}
              animate={
                stage === 'cover'
                  ? { opacity: 0, y: '110%', filter: 'blur(6px)' }
                  : { opacity: 1, y: '0%', filter: 'blur(0px)' }
              }
              transition={{ delay: 0.08 + i * 0.035, duration: 0.32, ease: EASE }}
              className="inline-block will-change-transform"
            >
              {ch === ' ' ? ' ' : ch}
            </motion.span>
          ))}
        </span>
      </motion.div>
    </div>,
    document.body
  );
}

// Slide layer (parallel to the curtain): when this section becomes the pager
// target, its content settles in with a rise + unblur — no remount, so
// carousel state, tabs and hooks are preserved.
export function SectionSlide({
  section,
  children,
  className,
}: {
  section: string;
  children: ReactNode;
  className?: string;
}): ReactNode {
  const { activeId, cycle, direction } = useSectionTransition();
  const reduceMotion = useReducedMotion();
  const controls = useAnimationControls();
  const seenCycle = useRef(cycle);

  useEffect(() => {
    if (reduceMotion) return;
    if (seenCycle.current === cycle) return;
    seenCycle.current = cycle;
    if (activeId !== section) return;
    controls.set({ y: direction * 44, filter: 'blur(6px)' });
    controls
      .start({ y: 0, filter: 'blur(0px)', transition: { duration: 0.55, ease: EASE } })
      .catch(() => {
        // transition superseded — safe to ignore
      });
    return () => {
      controls.stop();
    };
  }, [activeId, cycle, direction, section, controls, reduceMotion]);

  return (
    <motion.div
      animate={controls}
      initial={false}
      style={{ willChange: 'transform, filter' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
