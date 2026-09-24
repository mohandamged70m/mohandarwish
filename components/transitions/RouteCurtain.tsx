'use client';

import { motion, useReducedMotionConfig as useReducedMotion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const EASE = [0.22, 1, 0.36, 1] as const;

// Cover time before the lift starts, then lift duration. Exit is driven by
// the `stage` state (animate prop), not AnimatePresence — the previous
// version wrapped a plain div in AnimatePresence, so the exit slide never ran
// and the curtain just popped out of existence.
const HOLD_MS = 550;
const EXIT_MS = 420;

// Awwwards-style curtain wipe: wine panel + dark trailing panel sweep up
// to reveal the new route. Enter-only (App Router has no exit hooks) —
// on pathname change we cover instantly then slide away.
export function RouteCurtain() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [prevPath, setPrevPath] = useState(pathname);
  const [cycle, setCycle] = useState(0);
  const [visible, setVisible] = useState(false);
  const [stage, setStage] = useState<'cover' | 'exit'>('cover');

  // Adjust state during render (React-endorsed prev-comparison pattern):
  // a new pathname starts a new wipe cycle. No wipe on first mount.
  if (prevPath !== pathname && !reduceMotion) {
    setPrevPath(pathname);
    setCycle((c) => c + 1);
    setStage('cover');
    setVisible(true);
  }

  // Cover + hold, then lift away, then unmount.
  useEffect(() => {
    if (!visible) return;
    const t1 = window.setTimeout(() => setStage('exit'), HOLD_MS);
    const t2 = window.setTimeout(() => setVisible(false), HOLD_MS + EXIT_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [visible, cycle]);

  if (reduceMotion) return null;
  if (!visible) return null;

  const exiting = stage === 'exit';

  return (
    <div
      key={cycle}
      aria-hidden
      className='pointer-events-none fixed inset-0 z-[90]'
    >
      {/* trailing dark panel for depth */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: exiting ? '-100%' : '0%' }}
        transition={{ duration: exiting ? 0.42 : 0.4, ease: EASE, delay: 0.05 }}
        className='absolute inset-0 bg-bg-surface'
      />
      {/* signature wine curtain */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: exiting ? '-100%' : '0%' }}
        transition={{ duration: exiting ? 0.4 : 0.38, ease: EASE }}
        className='absolute inset-0 flex items-center justify-center bg-accent'
      >
        <motion.span
          initial={{ opacity: 0, y: 14 }}
          animate={exiting ? { opacity: 0, y: -10 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE, delay: exiting ? 0 : 0.18 }}
          className='font-heading text-sm font-semibold uppercase tracking-[0.3em] text-text-on-accent'
        >
          {pathname ?? '/'}
        </motion.span>
      </motion.div>
    </div>
  );
}
