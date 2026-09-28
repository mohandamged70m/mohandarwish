'use client';

import * as React from 'react';
import { JSX, useEffect, useRef, useState } from 'react';

type AnimatedTextProps = {
  text: string;
  className?: string;
  startDelay?: number;
  stagger?: number;
  duration?: number;
  as?: keyof JSX.IntrinsicElements;
  // When provided and changed, the entrance replays (e.g. pager returning
  // to hero). Undefined = reveal once via IntersectionObserver.
  replayKey?: number;
};

// Catchy split-text entrance: each char rises from a per-word mask with
// blur + slight rotate, staggered. Trendy 2025-26 hero feel, still a11y-safe
// (full text on parent aria-label, chars aria-hidden).
export default function AnimatedText({
  text = '',
  className = '',
  startDelay = 0,
  stagger = 60,
  duration = 500,
  as: Tag = 'span',
  replayKey,
}: AnimatedTextProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const seenKey = useRef(replayKey);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Replay the entrance when the pager returns to this section.
  useEffect(() => {
    if (replayKey === undefined) return;
    if (seenKey.current === replayKey) return;
    seenKey.current = replayKey;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    setVisible(false);
    const raf2 = { current: 0 };
    const raf1 = requestAnimationFrame(() => {
      raf2.current = requestAnimationFrame(() => setVisible(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2.current);
    };
  }, [replayKey]);

  if (!text) return null;

  const words = text.split(' ');
  let globalIndex = 0;
  const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';

  return React.createElement(
    Tag,
    {
      ref: ref as React.Ref<HTMLElement>,
      className,
      style: { display: 'inline-block' } as React.CSSProperties,
      'aria-label': text,
    },
    ...words.map((word, wIndex) => (
      <span
        key={wIndex}
        aria-hidden='true'
        style={{
          display: 'inline-block',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          verticalAlign: 'bottom',
          paddingBottom: '0.08em',
          marginBottom: '-0.08em',
        }}
      >
        {word.split('').map((char, cIndex) => {
          const i = globalIndex++;
          return (
            <span
              key={cIndex}
              aria-hidden='true'
              style={{
                display: 'inline-block',
                opacity: visible ? 1 : 0,
                transform: visible
                  ? 'translateY(0) rotate(0deg)'
                  : 'translateY(110%) rotate(5deg)',
                filter: visible ? 'blur(0px)' : 'blur(8px)',
                transition:
                  'opacity ' + duration + 'ms ' + ease +
                  ', transform ' + (duration + 150) + 'ms ' + ease +
                  ', filter ' + duration + 'ms ' + ease,
                transitionDelay: '' + (startDelay + i * stagger) + 'ms',
                transformOrigin: 'bottom left',
                willChange: visible ? 'auto' : 'opacity, transform, filter',
              }}
            >
              {char}
            </span>
          );
        })}
        {wIndex < words.length - 1 ? '\u00A0' : ''}
      </span>
    ))
  );
}
