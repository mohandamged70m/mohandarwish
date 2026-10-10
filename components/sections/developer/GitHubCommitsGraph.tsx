"use client";

import { useEffect, useState, useRef, useMemo, useCallback, startTransition } from 'react';
import { motion } from 'motion/react';

interface ContributionDay {
    date: string;
    count: number;
    level: number; // 0-4
}

interface GitHubCommitsGraphProps {
    username?: string;
    // null = unknown (load failed): the parent must render "unavailable",
    // never a confident 0-day streak.
    onStreakCalculated?: (streak: number | null) => void;
}

/** Count consecutive contribution days ending today (or yesterday if today is empty).
 *  Uses the viewer's LOCAL calendar days: GitHub buckets a contribution under
 *  the commit's local date (a 00:20 +0300 commit lands on that date even though
 *  it is still "yesterday" in UTC), and github.com renders per-viewer — so UTC
 *  math undercounts every evening/morning for UTC+N visitors. */
function calculateStreak(yearlyData: Record<number, ContributionDay[]>): number {
    const countByDate = new Map<string, number>();
    Object.values(yearlyData).forEach(days =>
        days.forEach(d => { if (d.count >= 0) countByDate.set(d.date, d.count); }),
    );

    // Local YYYY-MM-DD - matches the dates GitHub buckets commits under.
    const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Noon-anchored so DST transitions can never skip a step.
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const check = new Date(today);

    // If today has no contributions yet, start counting from yesterday
    if ((countByDate.get(fmt(today)) || 0) === 0) {
        check.setDate(check.getDate() - 1);
    }

    let streak = 0;
    while ((countByDate.get(fmt(check)) || 0) > 0) {
        streak++;
        check.setDate(check.getDate() - 1);
    }
    return streak;
}

const GITHUB_USERNAME = 'mohandamged70m';

const GitHubCommitsGraph = ({ username = GITHUB_USERNAME, onStreakCalculated }: GitHubCommitsGraphProps) => {
    const thisYear = new Date().getFullYear();

    const [yearlyData, setYearlyData] = useState<Record<number, ContributionDay[]>>({});
    const [yearlyTotals, setYearlyTotals] = useState<Record<number, number>>({});
    const [availableYears, setAvailableYears] = useState<number[]>([thisYear]);
    const [currentYear, setCurrentYear] = useState<number>(thisYear);

    // Computed once per render - used inside the cell map below.
    // Viewer-local date: "today" must be the same day GitHub buckets the
    // commits under (see calculateStreak).
    const todayStr = useMemo(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }, []);
    const [slideDir, setSlideDir] = useState<number>(0); // -1 = left (older), 1 = right (newer)
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hoveredDay, setHoveredDay] = useState<ContributionDay | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<HTMLDivElement>(null);
    // Cached container rect — avoids a getBoundingClientRect on the
    // container for every cell hover (was 2 forced layouts per mousemove).
    const containerRectRef = useRef<{ left: number; top: number } | null>(null);
    const tooltipRafRef = useRef(0);
    const [containerWidth, setContainerWidth] = useState(0);
    const [prefersReduced, setPrefersReduced] = useState(false);

    useEffect(() => {
        const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrefersReduced(mql.matches);
        const onChange = () => setPrefersReduced(mql.matches);
        mql.addEventListener("change", onChange);
        return () => mql.removeEventListener("change", onChange);
    }, []);

    // Wheel / touch navigation refs
    const lastNavTime = useRef(0);
    const touchStartX = useRef(0);

    // ── Fetch all years at once (with timeout + localStorage cache + unmount guard) ──
    useEffect(() => {
        const CACHE_KEY = `gh_contrib_${username}`;
        let ignore = false;
        const controller = new AbortController();

        /** Shared logic: turn raw API JSON into component state. */
        const applyData = (data: { contributions?: unknown[]; total?: Record<string, unknown>; currentStreak?: unknown; longestStreak?: unknown }) => {
            if (ignore) return false;
            if (!data.contributions || !Array.isArray(data.contributions)) return false;

            const byYear: Record<number, ContributionDay[]> = {};
            data.contributions.forEach((day: unknown) => {
                if (!day || typeof day !== 'object') return;
                const d = day as { date?: unknown; count?: unknown; level?: unknown };
                if (typeof d.date !== 'string') return;
                const count = typeof d.count === 'number' ? d.count : 0;
                const level = typeof d.level === 'number' ? d.level : 0;
                const y = parseInt(d.date.split('-')[0], 10);
                if (isNaN(y)) return;
                if (!byYear[y]) byYear[y] = [];
                byYear[y].push({ date: d.date, count, level });
            });

            const tots: Record<number, number> = {};
            if (data.total) {
                Object.entries(data.total).forEach(([k, v]) => {
                    const y = parseInt(k, 10);
                    if (!isNaN(y) && typeof v === 'number') tots[y] = v;
                });
            }
            Object.entries(byYear).forEach(([ys, days]) => {
                const y = parseInt(ys, 10);
                if (!(y in tots)) tots[y] = (days as ContributionDay[]).reduce((s, d) => s + d.count, 0);
            });

            const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
            if (ignore || years.length === 0) return false;
            setYearlyData(byYear);
            setYearlyTotals(tots);
            setAvailableYears(years);
            setCurrentYear(years[years.length - 1]);
            setIsLoading(false);

            // Report streak (guarded - parent may have unmounted).
            // Always the viewer's local calculation: the server may run in a
            // different timezone, and only the viewer's "today" matches the
            // dates GitHub buckets commits under.
            if (!ignore) {
                onStreakCalculated?.(calculateStreak(byYear));
            }
            return true;
        };

        const fetchAll = async () => {
            // 1) Try the API with a 10-second timeout (uses master controller - aborts on unmount)
            const tid = setTimeout(() => controller.abort(), 10_000);
            try {
                const res = await fetch('/api/github/contributions', { signal: controller.signal });
                clearTimeout(tid);
                if (ignore) return;

                if (res.ok) {
                    const json = await res.json();
                    if (ignore) return;
                    if (applyData(json)) {
                        try { localStorage.setItem(CACHE_KEY, JSON.stringify(json)); } catch { /* quota */ }
                        return;
                    }
                }
                if (!ignore) setError(`GitHub contributions unavailable (${res.status}).`);
            } catch { clearTimeout(tid); /* timeout or network error - fall through */ }

            if (ignore) return;

            // 2) Try localStorage cache (discarded past 15 min — ancient
            // snapshots are how stale zeros haunted the UI after recovery)
            try {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const json = JSON.parse(cached);
                    const ts = typeof json?.fetchedAt === 'number' ? json.fetchedAt : 0;
                    if (Date.now() - ts < 15 * 60 * 1000 && applyData(json)) return;
                }
            } catch { /* corrupt cache */ }

            if (ignore) return;

            // 3) Final fallback: small error state, no mock numbers.
            // Report unknown (null), not 0 — a failed load is not a broken streak.
            setIsLoading(false);
            setError((prev) => prev ?? 'Could not load GitHub contributions.');
            onStreakCalculated?.(null);
        };

        fetchAll();

        return () => {
            ignore = true;
            controller.abort();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [username]);

    // ── Measure container width (rAF-batched) + cache container offset ──
    // ResizeObserver fires at high frequency; setState per entry keeps
    // React re-rendering mid-resize and hurts INP on rotation/split-view.
    useEffect(() => {
        const el = graphRef.current;
        const cont = containerRef.current;
        if (!el) return;
        let raf = 0;
        const cacheOffset = () => {
            // Read once per resize/scroll, not once per cell hover.
            if (cont) {
                const br = cont.getBoundingClientRect();
                containerRectRef.current = { left: br.left, top: br.top };
            }
        };
        const obs = new ResizeObserver(entries => {
            const last = entries[entries.length - 1];
            if (!last) return;
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                setContainerWidth(last.contentRect.width);
                cacheOffset();
            });
        });
        obs.observe(el);
        setContainerWidth(el.clientWidth);
        cacheOffset();
        window.addEventListener("scroll", cacheOffset, { passive: true });
        window.addEventListener("resize", cacheOffset);
        return () => {
            cancelAnimationFrame(raf);
            obs.disconnect();
            window.removeEventListener("scroll", cacheOffset);
            window.removeEventListener("resize", cacheOffset);
        };
    }, []);

    // ── Year navigation ──
    const yearIdx = availableYears.indexOf(currentYear);
    const canGoOlder = yearIdx > 0;
    const canGoNewer = yearIdx < availableYears.length - 1;

    const navigateYear = useCallback((dir: number) => {
        const now = Date.now();
        if (now - lastNavTime.current < 600) return; // cooldown
        lastNavTime.current = now;
        cancelAnimationFrame(tooltipRafRef.current);
        setHoveredDay(null);

        setSlideDir(dir);
        // INP: year swap re-renders ~365 cells. Defer it so the chevron
        // click paints first; the grid follows in a transition.
        startTransition(() => {
            setCurrentYear(prev => {
                const idx = availableYears.indexOf(prev);
                const next = idx + dir;
                if (next >= 0 && next < availableYears.length) return availableYears[next];
                return prev;
            });
        });
    }, [availableYears]);

    // ── Wheel handler (horizontal scroll → year nav) ──
    useEffect(() => {
        const el = graphRef.current;
        if (!el) return;
        const handler = (e: WheelEvent) => {
            // Use horizontal scroll for year nav; let vertical scroll pass through
            const absX = Math.abs(e.deltaX);
            const absY = Math.abs(e.deltaY);
            if (absX > absY && absX > 30) {
                e.preventDefault();
                navigateYear(e.deltaX > 0 ? 1 : -1);
            }
        };
        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, [navigateYear]);

    // ── Touch swipe handlers (distinguish from page-level swipe) ──
    const touchStartY = useRef(0);
    const touchClaimed = useRef(false); // true once we decide this gesture is ours

    useEffect(() => {
        const el = graphRef.current;
        if (!el) return;

        const onStart = (e: TouchEvent) => {
            touchStartX.current = e.touches[0].clientX;
            touchStartY.current = e.touches[0].clientY;
            touchClaimed.current = false;
        };

        const onMove = (e: TouchEvent) => {
            const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
            const dy = Math.abs(e.touches[0].clientY - touchStartY.current);

            // If the swipe is clearly horizontal (2× more X than Y) and past threshold,
            // claim this gesture so the page-level swipe doesn't fire
            if (dx > 20 && dx > dy * 2 && !touchClaimed.current) {
                touchClaimed.current = true;
            }

            if (touchClaimed.current) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        const onEnd = (e: TouchEvent) => {
            if (!touchClaimed.current) return; // not our gesture - let page handle it

            e.stopPropagation();
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            if (Math.abs(dx) > 60) navigateYear(dx < 0 ? 1 : -1);
        };

        el.addEventListener('touchstart', onStart, { passive: true });
        el.addEventListener('touchmove', onMove, { passive: false });
        el.addEventListener('touchend', onEnd, { passive: true });
        return () => {
            el.removeEventListener('touchstart', onStart);
            el.removeEventListener('touchmove', onMove);
            el.removeEventListener('touchend', onEnd);
        };
    }, [navigateYear]);

    // ── Current year's contribution data ──
    const contributions = useMemo(() => yearlyData[currentYear] || [], [yearlyData, currentYear]);
    const totalContributions = yearlyTotals[currentYear] || 0;

    const weeks = useMemo(() => {
        if (contributions.length === 0) return [];
        const result: ContributionDay[][] = [];
        let week: ContributionDay[] = [];

        // Local weekday - matches how github.com renders the grid for the viewer.
        const startDay = new Date(contributions[0].date).getDay();
        for (let i = 0; i < startDay; i++) week.push({ date: '', count: -1, level: -1 });

        contributions.forEach(day => {
            week.push(day);
            if (week.length === 7) { result.push(week); week = []; }
        });
        if (week.length > 0) result.push(week);
        return result;
    }, [contributions]);

    const monthLabels = useMemo(() => {
        if (weeks.length === 0) return [];
        const labels: { label: string; weekIndex: number }[] = [];
        const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let last = -1;
        weeks.forEach((w, wi) => {
            const valid = w.find(d => d.date && d.count >= 0);
            if (valid) {
                const m = new Date(valid.date).getMonth();
                if (m !== last) { labels.push({ label: names[m], weekIndex: wi }); last = m; }
            }
        });
        return labels;
    }, [weeks]);

    // ── Tooltip positioning (rAF-throttled, 1 layout per hover) ──
    // Previously 2 getBoundingClientRect calls + 2 setStates per cell
    // enter. Now: container rect is cached, work is batched in rAF, and
    // a repeat hover on the same day skips setState entirely.
    const handleCellHover = useCallback((day: ContributionDay, e: React.MouseEvent<HTMLDivElement>) => {
        if (day.count < 0) return;
        const cell = e.currentTarget;
        cancelAnimationFrame(tooltipRafRef.current);
        tooltipRafRef.current = requestAnimationFrame(() => {
            const cached = containerRectRef.current;
            const cr = cell.getBoundingClientRect();
            const base = cached ?? { left: 0, top: 0 };
            if (!cached) {
                const cont = containerRef.current;
                if (cont) {
                    const br = cont.getBoundingClientRect();
                    containerRectRef.current = { left: br.left, top: br.top };
                }
            }
            setTooltipPos({ x: cr.left + cr.width / 2 - base.left, y: cr.top - base.top - 8 });
            setHoveredDay(prev => (prev?.date === day.date ? prev : day));
        });
    }, []);
    const handleCellLeave = useCallback(() => {
        cancelAnimationFrame(tooltipRafRef.current);
        setHoveredDay(null);
    }, []);

    useEffect(() => () => cancelAnimationFrame(tooltipRafRef.current), []);

    // ── Dynamic cell sizing ──
    const NUM_WEEKS = weeks.length || 52;
    const GAP = 3; // Increased gap for better clarity
    const CELL = containerWidth > 0
        ? Math.max(10, Math.floor((containerWidth - (NUM_WEEKS - 1) * GAP) / NUM_WEEKS))
        : 12;

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    };

    // ── Chevron button style ── 44×44 min target on mobile for thumb tap (WCAG 2.5.5)
    const chevronBtn = (enabled: boolean): React.CSSProperties => ({
        background: 'none', border: 'none', padding: '10px 12px',
        minWidth: 44, minHeight: 44,
        cursor: enabled ? 'pointer' : 'default',
        color: enabled ? 'var(--accent)' : 'var(--text-muted)', opacity: enabled ? 1 : 0.3,
        transition: 'opacity 0.2s, color 0.2s', fontSize: '0.75rem', fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        borderRadius: 8,
    });

    // ── Year-slide direction only drives the single container's
    // transform (one compositor animation, not 365 staggered cells).
    const yearEnterX = slideDir > 0 ? 24 : slideDir < 0 ? -24 : 0;

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
            {/* ── Header ── */}
            <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}
            >
                {/* Left: icon + count */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 24, height: 24, borderRadius: 6, background: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                        </svg>
                    </div>
                    <div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                            {isLoading ? '-' : totalContributions.toLocaleString()}
                        </span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: 5 }}>
                            contributions
                        </span>
                    </div>
                </div>

                {/* Center: year navigator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, userSelect: 'none' }}>
                    <button onClick={() => canGoOlder && navigateYear(-1)} style={chevronBtn(canGoOlder)} aria-label="Previous year">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    <span
                        key={currentYear}
                        style={{
                            fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)',
                            minWidth: 38, textAlign: 'center', display: 'inline-block',
                            letterSpacing: '-0.01em',
                        }}
                    >
                        {currentYear}
                    </span>
                    <button onClick={() => canGoNewer && navigateYear(1)} style={chevronBtn(canGoNewer)} aria-label="Next year">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                </div>

                {/* Right: profile link */}
                <a href={`https://github.com/${username}`} target="_blank" rel="noopener noreferrer"
                    style={{
                        fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent)', textDecoration: 'none',
                        opacity: 0.8, transition: 'opacity 0.2s', letterSpacing: '0.04em', textTransform: 'uppercase',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}
                >@{username}</a>
            </motion.div>

            {/* ── Graph: single container animation, plain-div cells ── */}
            {/* INP: was AnimatePresence mode=wait (double render) + 365
                motion.divs with staggered delays + an infinite boxShadow
                loop. Now one transform/opacity slide on the container and
                static cells — year clicks commit ~1 animation, not 365. */}
            <div ref={graphRef} style={{ overflow: 'hidden', paddingBottom: 2 }}>
                <motion.div
                    key={currentYear}
                    initial={prefersReduced ? false : { x: yearEnterX, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: prefersReduced ? 0.01 : 0.22, ease: [0.16, 1, 0.3, 1] }}
                    style={{ position: 'relative', paddingTop: 16, willChange: 'transform, opacity' }}
                >
                        {/* Month Labels */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 14 }}>
                            {monthLabels.map((m, i) => (
                                <span key={i} style={{
                                    position: 'absolute', left: m.weekIndex * (CELL + GAP),
                                    fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)',
                                    userSelect: 'none', lineHeight: 1,
                                }}>{m.label}</span>
                            ))}
                        </div>

                        {/* Grid */}
                        <div style={{ display: 'flex', gap: GAP }}>
                            {isLoading ? (
                                Array.from({ length: 52 }).map((_, wi) => (
                                    <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
                                        {Array.from({ length: 7 }).map((_, di) => (
                                            <div key={di} className="commits-cell-skeleton" style={{
                                                width: CELL, height: CELL, borderRadius: 3,
                                                animationDelay: `${(wi + di) * 20}ms`,
                                            }} />
                                        ))}
                                    </div>
                                ))
                            ) : (
                                weeks.map((week, wi) => (
                                    <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
                                        {week.map((day, di) => {
                                            const isEmpty = day.count < 0;
                                            const isHovered = hoveredDay?.date === day.date && !isEmpty;
                                            const isToday = day.date === todayStr;

                                            return (
                                                <div
                                                    key={di}
                                                    // eslint-disable-next-line react-hooks/refs
                                                    onMouseEnter={(e) => handleCellHover(day, e)}
                                                    onMouseLeave={handleCellLeave}
                                                    style={{
                                                        width: CELL, height: CELL, borderRadius: 3,
                                                        background: isEmpty ? 'transparent' : (isToday ? 'var(--accent)' : `var(--commits-l${day.level})`),
                                                        cursor: isEmpty ? 'default' : 'pointer',
                                                        // Transform-only hover: no re-render-driven
                                                        // style recalc beyond the two toggled cells.
                                                        transition: 'transform 0.15s ease-out, box-shadow 0.15s ease',
                                                        transform: isHovered ? 'scale(1.3)' : 'scale(1)',
                                                        // Static today glow — the old infinite
                                                        // boxShadow keyframe loop kept the
                                                        // compositor busy permanently.
                                                        boxShadow: isToday
                                                            ? '0 0 8px var(--accent)'
                                                            : isHovered && day.level > 0
                                                                ? `0 0 8px var(--commits-l${day.level})`
                                                                : 'none',
                                                        border: isToday ? '2px solid white' : 'none',
                                                        zIndex: (isHovered || isToday) ? 10 : 1,
                                                        position: 'relative',
                                                    }}
                                                />
                                            );
                                        })}
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
            </div>

            {!isLoading && error && (
                <p style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }} role="status">
                    {error}
                </p>
            )}

            {/* ── Legend (static — was a motion.div animating on mount) ── */}
            <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 10 }}
            >
                <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', marginRight: 4, fontWeight: 600, letterSpacing: '0.02em' }}>Less</span>
                {[0, 1, 2, 3, 4].map(level => (
                    <div key={level} style={{
                        width: CELL, height: CELL, borderRadius: 3,
                        background: `var(--commits-l${level})`, transition: 'transform 0.2s ease',
                    }}
                        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.3)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                    />
                ))}
                <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', marginLeft: 4, fontWeight: 600, letterSpacing: '0.02em' }}>More</span>
            </div>

            {/* ── Tooltip (instant — was AnimatePresence + motion + backdrop-blur
                on the hover path; blur(20px) repainted every mousemove) ── */}
            {hoveredDay && hoveredDay.count >= 0 && (
                    <div style={{
                        position: 'absolute', left: tooltipPos.x, top: tooltipPos.y,
                        pointerEvents: 'none', zIndex: 200, transform: 'translate(-50%, -100%)',
                    }}>
                        <div key={hoveredDay.date}>
                            <div style={{
                                background: 'var(--tooltip-bg)',
                                color: 'var(--tooltip-text)', padding: '7px 11px', borderRadius: 8,
                                fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap',
                                boxShadow: '0 6px 20px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)',
                                border: '1px solid var(--section-border)', lineHeight: 1.45, textAlign: 'center',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                                    <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: hoveredDay.level > 0 ? `var(--commits-l${hoveredDay.level})` : 'var(--commits-l0)', flexShrink: 0 }} />
                                    <span><strong style={{ fontWeight: 800 }}>{hoveredDay.count}</strong> contribution{hoveredDay.count !== 1 ? 's' : ''}</span>
                                </div>
                                <div style={{ fontSize: '0.58rem', fontWeight: 500, color: 'var(--text-muted)', marginTop: 2 }}>
                                    {formatDate(hoveredDay.date)}
                                </div>
                            </div>
                            <div style={{
                                width: 7, height: 7, background: 'var(--tooltip-bg)',
                                border: '1px solid var(--section-border)', borderTop: 'none', borderLeft: 'none',
                                transform: 'rotate(45deg)', position: 'absolute', bottom: -3, left: '50%', marginLeft: -3.5,
                            }} />
                        </div>
                    </div>
                )}
        </div>
    );
};

export default GitHubCommitsGraph;
