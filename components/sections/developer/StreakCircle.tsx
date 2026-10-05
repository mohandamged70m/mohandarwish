"use client";

import { useRef, useEffect, useState, lazy, Suspense } from 'react';
import { motion } from 'motion/react';
import { Flame } from 'lucide-react';
import type { LottieHandle } from 'lottie-react';
import StreakErrorBoundary from './StreakErrorBoundary';

// lottie-react (~heavy) + Fire.json only appear in the below-the-fold Developer
// tab, so both stay out of the eager bundle: lazy player + dynamic JSON import.
const Lottie = lazy(() => import('lottie-react').then((m) => ({ default: m.Lottie })));

interface StreakCircleProps {
    streak: number;
    isLoading?: boolean;
}

const StreakCircle = ({ streak, isLoading = false }: StreakCircleProps) => {
    const hasStreak = streak > 0;
    const lottieRef = useRef<LottieHandle>(null);
    const [fireData, setFireData] = useState<object | null>(null);
    const [prefersReduced, setPrefersReduced] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );

    useEffect(() => {
        const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onChange = () => setPrefersReduced(mql.matches);
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, []);

    // Load the animation JSON on demand (kept out of the eager graph).
    useEffect(() => {
        if (prefersReduced) return;
        let active = true;
        import('./Fire.json').then((m) => {
            if (active) setFireData(m.default as object);
        });
        return () => {
            active = false;
        };
    }, [prefersReduced]);

    // Ensure the animation is always playing once loaded (resilient to remounts/HMR)
    useEffect(() => {
        if (!fireData) return;
        const id = requestAnimationFrame(() => {
            lottieRef.current?.play();
        });
        return () => cancelAnimationFrame(id);
    }, [fireData]);

    const showAnimation = !prefersReduced && fireData !== null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0,
                userSelect: 'none',
            }}
        >
            {/* Fire - 100x100 box always reserved (no layout shift). Static Flame
                icon is the fallback while lottie loads, on reduced-motion, or
                if the lottie chunk fails (boundary -> fallback). */}
            <div
                style={{
                    width: 100,
                    height: 100,
                    display: 'grid',
                    placeItems: 'center',
                    filter:
                        hasStreak && !isLoading
                            ? 'drop-shadow(0 6px 18px rgba(255,100,0,0.55))'
                            : 'grayscale(0.85) opacity(0.35)',
                    transition: 'filter 0.5s ease',
                    marginBottom: -8,
                    position: 'relative',
                }}
            >
                {/* Static fallback underneath */}
                <span
                    aria-hidden
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'grid',
                        placeItems: 'center',
                        color: hasStreak && !isLoading ? '#ff6a00' : 'var(--text-muted)',
                        opacity: showAnimation && hasStreak && !isLoading ? 0 : 1,
                        transition: 'opacity 0.4s ease',
                    }}
                >
                    <Flame size={64} strokeWidth={1.6} fill="currentColor" fillOpacity={0.25} />
                </span>
                {showAnimation && (
                    <StreakErrorBoundary fallback={null}>
                        <Suspense fallback={null}>
                            <Lottie
                                lottieRef={lottieRef}
                                src={fireData}
                                loop
                                autoplay
                                rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
                                style={{ width: '100%', height: '100%', position: 'relative' }}
                            />
                        </Suspense>
                    </StreakErrorBoundary>
                )}
            </div>

            {/* Number - uses page text color so it's always legible */}
            <div
                style={{
                    fontSize: '3rem',
                    fontWeight: 900,
                    lineHeight: 1,
                    fontFamily: 'var(--font-inter)',
                    letterSpacing: '-0.05em',
                    color: isLoading || !hasStreak ? 'var(--text-muted)' : 'var(--text-primary)',
                    transition: 'color 0.4s ease',
                    minWidth: 48,
                    textAlign: 'center',
                }}
            >
                {isLoading ? '-' : streak}
            </div>

            {/* Label */}
            <div
                style={{
                    fontSize: '0.6rem',
                    fontWeight: 800,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: hasStreak && !isLoading ? 'rgba(255,140,0,0.75)' : 'var(--text-muted)',
                    marginTop: 4,
                    transition: 'color 0.4s ease',
                }}
            >
                day streak
            </div>
        </motion.div>
    );
};

export default StreakCircle;
