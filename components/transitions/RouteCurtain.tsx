'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const EASE = [0.22, 1, 0.36, 1] as const;

// Awwwards-style curtain wipe: lime panel + dark trailing panel sweep up
// to reveal the new route. Enter-only (App Router has no exit hooks) —
// on pathname change we cover instantly then slide away.
export function RouteCurtain() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [prevPath, setPrevPath] = useState(pathname);
  const [cycle, setCycle] = useState(0);
  const [visible, setVisible] = useState(false);

  // Adjust state during render (React-endorsed prev-comparison pattern):
  // a new pathname starts a new wipe cycle. No wipe on first mount.
  if (prevPath !== pathname && !reduceMotion) {
    setPrevPath(pathname);
    setCycle((c) => c + 1);
    setVisible(true);
  }

  // Auto-dismiss the curtain after cover + hold + reveal.
  useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(() => setVisible(false), 950);
    return () => window.clearTimeout(t);
  }, [visible, cycle]);

  if (reduceMotion) return null;

  return (
    <AnimatePresence>
      {visible && (
        <div
          key={cycle}
          aria-hidden
          className='pointer-events-none fixed inset-0 z-[90]'
        >
          {/* trailing dark panel for depth */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: '0%' }}
            exit={{ y: '-100%' }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.05 }}
            className='absolute inset-0 bg-bg-surface'
          />
          {/* signature lime curtain */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: '0%' }}
            exit={{ y: '-100%' }}
            transition={{ duration: 0.38, ease: EASE }}
            className='absolute inset-0 flex items-center justify-center bg-accent'
          >
            <motion.span
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: EASE, delay: 0.18 }}
              className='font-heading text-sm font-semibold uppercase tracking-[0.3em] text-text-on-accent'
            >
              {pathname ?? '/'}
            </motion.span>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
