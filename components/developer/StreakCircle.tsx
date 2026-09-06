"use client";

import { motion } from 'motion/react';
import { Flame } from 'lucide-react';

interface StreakCircleProps {
    streak: number;
    isLoading?: boolean;
}

const StreakCircle = ({ streak, isLoading = false }: StreakCircleProps) => {
    const hasStreak = streak > 0;

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
            {/* Fire — vector icon so the tab needs no Lottie/Fire.json asset */}
            <div
                style={{
                    width: 100,
                    height: 100,
                    display: 'grid',
                    placeItems: 'center',
                    color: hasStreak && !isLoading ? '#ff6a00' : 'var(--text-muted)',
                    filter: hasStreak && !isLoading
                        ? 'drop-shadow(0 6px 18px rgba(255,100,0,0.55))'
                        : 'grayscale(0.85)',
                    opacity: hasStreak && !isLoading ? 1 : 0.35,
                    transition: 'filter 0.5s ease, opacity 0.5s ease',
                    marginBottom: -8,
                }}
            >
                <Flame size={64} strokeWidth={1.6} fill="currentColor" fillOpacity={0.25} />
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
