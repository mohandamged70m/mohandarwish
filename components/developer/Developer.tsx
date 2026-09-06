"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import anime from 'animejs';
import { Activity, Flame, FolderGit2 } from 'lucide-react';
import GitHubCommitsGraph from './GitHubCommitsGraph';
import StreakCircle from './StreakCircle';
import FeaturedRepos from './FeaturedRepos';
import GitHubStats from './GitHubStats';

/* ──────────────────────────────────────────────────────────────
   Eyebrow section label: a small, consistent header used above
   every block so the whole section reads with one clear rhythm.
   Light by design (no heavy cards) to keep the layout simple.
   ────────────────────────────────────────────────────────────── */
interface SectionLabelProps {
    icon: React.ReactNode;
    label: string;
    hint?: string;
    centered?: boolean;
}

// Monochrome eyebrow label: muted icon + uppercase label in design tokens.
// Hint stays at full opacity on text-secondary so it keeps 4.5:1 contrast.
const SectionLabel = ({ icon, label, hint, centered = false }: SectionLabelProps) => (
    <div
        className={`flex items-center gap-2 pb-0 ${
            centered ? "justify-center" : ""
        }`}
        style={{ marginBottom: 18 }}
    >
        <span className="inline-flex shrink-0 text-text-muted">
            {icon}
        </span>
        <span className="font-heading text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {label}
        </span>
        {hint && !centered && (
            <span className="ml-auto font-body text-[0.72rem] font-medium text-text-secondary">
                {hint}
            </span>
        )}
    </div>
);

const Developer = ({ embedded = false }: { embedded?: boolean }) => {
    const statsRef = useRef<HTMLDivElement>(null);
    const activityRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    const [streak, setStreak] = useState<number>(0);
    const [streakLoading, setStreakLoading] = useState(true);

    const handleStreakCalculated = useCallback((s: number) => {
        setStreak(s);
        setStreakLoading(false);
    }, []);

    // Staggered entrance: visible by default (no opacity-0), enhanced with
    // anime only when motion is allowed — content never hides without JS.
    useEffect(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const base = { easing: 'easeOutExpo' as const };
        const instances = [
            anime({ targets: statsRef.current, opacity: [0, 1], translateY: [20, 0], duration: 700, delay: 100, ...base }),
            anime({ targets: activityRef.current, opacity: [0, 1], translateY: [24, 0], duration: 750, delay: 220, ...base }),
            anime({ targets: bottomRef.current, opacity: [0, 1], translateY: [24, 0], duration: 750, delay: 340, ...base }),
        ];
        return () => instances.forEach(inst => inst?.pause());
    }, []);

    return (
        <div
            className={embedded ? undefined : "min-h-screen bg-primary transition-colors duration-300 pt-32 pb-48"}
            style={embedded ? { width: '100%' } : undefined}
        >
            <div className={embedded ? undefined : "page-padding"} style={embedded ? { width: '100%' } : undefined}>

                {/* Headline lives in ProjectsHeader when embedded — avoid a
                    second H1/H2 competing with the section title. Standalone
                    keeps its own H1 in the same terminal-eyebrow system. */}
                {!embedded && (
                    <header className="flex flex-col items-start gap-4" style={{ marginBottom: 44 }}>
                        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-surface px-3 py-1.5 font-heading text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
                            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span className="text-text-secondary">~/developer</span>
                            <span aria-hidden className="text-border-strong">·</span>
                            <span>live from GitHub</span>
                        </span>
                        <h1 className="font-heading text-[clamp(2.25rem,6vw,4.5rem)] font-bold leading-[1.02] tracking-[-0.02em] text-balance text-text-primary">
                            Code in the open<span aria-hidden className="text-accent">.</span>
                        </h1>
                        <p className="max-w-[52ch] font-body text-[15px] leading-[1.6] text-pretty text-text-secondary sm:text-base">
                            Commits, streaks and handpicked repos — synced from GitHub and updated daily.
                        </p>
                    </header>
                )}

                {/* ── Overview stats ── */}
                <section ref={statsRef} style={{ marginBottom: 44 }}>
                    <GitHubStats />
                </section>

                {/* ── Contribution activity (borderless graph) ── */}
                <section ref={activityRef} style={{ marginBottom: 44 }}>
                    <SectionLabel
                        icon={<Activity size={14} strokeWidth={2.5} />}
                        label="Contribution Activity"
                        hint="Year by year"
                    />
                    <GitHubCommitsGraph onStreakCalculated={handleStreakCalculated} />
                </section>

                {/* ── Streak + Featured projects ── */}
                <div ref={bottomRef} className="dev-bottom-row">
                    {/* Streak: label + bare fire (StreakCircle kept exactly as-is) */}
                    <div className="dev-streak-col" style={{ flexShrink: 0 }}>
                        <SectionLabel
                            icon={<Flame size={14} strokeWidth={2.5} />}
                            label="Streak"
                            centered
                        />
                        <StreakCircle streak={streak} isLoading={streakLoading} />
                    </div>

                    {/* Featured projects: label + repo grid (no outer card; each repo is already carded) */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <SectionLabel
                            icon={<FolderGit2 size={14} strokeWidth={2.5} />}
                            label="Featured Projects"
                            hint="Handpicked from GitHub"
                        />
                        <FeaturedRepos />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Developer;
