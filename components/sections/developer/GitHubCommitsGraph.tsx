"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';

/** A calendar cell exactly as the API returned it: GitHub's date and count,
 *  plus a 0-4 shade level. Nothing is recomputed client-side. */
interface ContributionCell {
    date: string;
    count: number;
    level: number; // 0-4
}

interface ContributionPayload {
    login: string;
    range: { from: string; to: string };
    totalContributions: number;
    weeks: (ContributionCell | null)[][];
    currentStreak: number;
    longestStreak: number;
    fetchedAt: number;
}

interface GitHubCommitsGraphProps {
    username?: string;
    // null = unknown (load failed): the parent must render "unavailable",
    // never a confident 0-day streak.
    onStreakCalculated?: (streak: number | null) => void;
}

const GITHUB_USERNAME = 'mohandamged70m';

/** How long a browser-local snapshot may be reused when the API is
 *  unreachable. Matches the route's stale-while-revalidate window. */
const LOCAL_CACHE_TTL = 24 * 60 * 60 * 1000;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Build a UTC Date from a `YYYY-MM-DD` key.
 *
 *  `new Date("2026-01-01")` parses as UTC *midnight*, so any reader west of
 *  UTC got Dec 31 for a "Jan 1" cell — the row alignment, the month labels and
 *  every tooltip were off by a day. Constructing from UTC parts and formatting
 *  with `timeZone: 'UTC'` makes the label always equal the date GitHub sent. */
function utcDate(dateKey: string): Date {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

/** "2026-10-03" → "Oct 3, 2026" (same day everywhere on Earth). */
function formatCalendarDate(dateKey: string): string {
    return utcDate(dateKey).toLocaleDateString('en-US', {
        timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
    });
}

/** Calendar day before `dateKey`, computed in UTC (DST-proof). */
function previousDate(dateKey: string): string {
    const [y, m, d] = dateKey.split('-').map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d) - 24 * 60 * 60 * 1000);
    return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}-${String(prev.getUTCDate()).padStart(2, '0')}`;
}

/** Consecutive contribution days ending today (or yesterday if today is still
 *  empty, which is the same rule github.com applies).
 *
 *  Anchored on the viewer's current day, never on the last cell. A calendar
 *  -year window runs to Dec 31, which is in the future for most of the year and
 *  carries no contributions — anchoring there reported a 0-day streak every
 *  October, when the real streak was alive. */
function calculateStreak(weeks: (ContributionCell | null)[][]): number {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const countByDate = new Map<string, number>();
    for (const week of weeks) {
        for (const cell of week) {
            if (cell) countByDate.set(cell.date, cell.count);
        }
    }

    let cursor = today;
    if (!countByDate.has(cursor)) {
        // Today is still empty (or just past the window): the streak survives if
        // yesterday counted.
        cursor = previousDate(cursor);
        if (!countByDate.has(cursor)) return 0;
    }

    let streak = 0;
    while ((countByDate.get(cursor) ?? 0) > 0) {
        streak++;
        cursor = previousDate(cursor);
    }
    return streak;
}

const GitHubCommitsGraph = ({ username = GITHUB_USERNAME, onStreakCalculated }: GitHubCommitsGraphProps) => {
    const [weeks, setWeeks] = useState<(ContributionCell | null)[][]>([]);
    const [totalContributions, setTotalContributions] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hoveredDay, setHoveredDay] = useState<ContributionCell | null>(null);
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

    // ── Fetch the rolling year (with timeout + localStorage cache + unmount guard) ──
    useEffect(() => {
        // Versioned so a snapshot written by an older payload shape (rolling
        // window vs calendar year) can never be revived by the fallback path.
        const CACHE_KEY = `gh_contrib_v5_${username}`;
        let ignore = false;
        const controller = new AbortController();

        /** Shared logic: turn the API payload into component state. */
        const applyData = (data: ContributionPayload): boolean => {
            if (ignore) return false;
            if (!Array.isArray(data?.weeks) || data.weeks.length === 0) return false;

            setWeeks(data.weeks);
            setTotalContributions(typeof data.totalContributions === 'number' ? data.totalContributions : 0);
            setIsLoading(false);
            setError(null);

            // Report streak (guarded — parent may have unmounted).
            onStreakCalculated?.(calculateStreak(data.weeks));
            return true;
        };

        const fetchContributions = async () => {
            // 1) The API — server-side GraphQL with shared caching (10s timeout).
            const tid = setTimeout(() => controller.abort(), 10_000);
            try {
                const res = await fetch('/api/github/contributions', { signal: controller.signal });
                clearTimeout(tid);
                if (ignore) return;

                if (res.ok) {
                    const json = await res.json();
                    if (ignore) return;
                    if (applyData(json)) {
                        try {
                            localStorage.setItem(CACHE_KEY, JSON.stringify({ data: json, savedAt: Date.now() }));
                        } catch { /* quota */ }
                        return;
                    }
                }
                if (!ignore) setError('Couldn’t load activity from GitHub.');
            } catch { clearTimeout(tid); /* timeout or network error — fall through */ }

            if (ignore) return;

            // 2) Last-known-good snapshot. Stamped on save (not with the
            // server's fetchedAt, which can already be an hour old because the
            // upstream call is cached) so a valid payload is never discarded
            // as "stale".
            try {
                const raw = localStorage.getItem(CACHE_KEY);
                if (raw) {
                    const { data, savedAt } = JSON.parse(raw);
                    if (typeof savedAt === 'number' && Date.now() - savedAt < LOCAL_CACHE_TTL && data && applyData(data)) return;
                }
            } catch { /* corrupt cache */ }

            if (ignore) return;

            // 3) Final fallback: small "couldn't load activity" state. No mock
            // numbers, and report unknown (null) — a failed load is not a
            // broken streak.
            setIsLoading(false);
            setError((prev) => prev ?? 'Couldn’t load activity from GitHub.');
            onStreakCalculated?.(null);
        };

        fetchContributions();

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

    // ── Derived calendar ──
    const firstDate = useMemo(() => {
        for (const week of weeks) for (const cell of week) if (cell) return cell.date;
        return '';
    }, [weeks]);

    const lastDate = useMemo(() => {
        for (let i = weeks.length - 1; i >= 0; i--) {
            const week = weeks[i];
            for (let j = week.length - 1; j >= 0; j--) if (week[j]) return week[j]!.date;
        }
        return '';
    }, [weeks]);

    // The cell to ring as "today": the newest day that has actually happened.
    // GitHub buckets days in UTC, so a visitor ahead of UTC can be on a date
    // the calendar has not reached; and a calendar-year window ends on Dec 31,
    // which is a future, empty day for most of the year — so neither "the last
    // cell" nor "today if present" is reliably right on its own.
    const todayStr = useMemo(() => {
        const now = new Date();
        const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        let newest = '';
        for (const week of weeks) {
            for (const cell of week) {
                if (cell && cell.date <= local && cell.date > newest) newest = cell.date;
            }
        }
        return newest;
    }, [weeks]);

    const monthLabels = useMemo(() => {
        const labels: { label: string; weekIndex: number }[] = [];
        let last = '';
        weeks.forEach((week, wi) => {
            const first = week.find(Boolean);
            if (!first) return;
            const month = first.date.slice(5, 7);
            if (month !== last) {
                labels.push({ label: MONTHS[Number(month) - 1], weekIndex: wi });
                last = month;
            }
        });
        // A label on the very last column would clip past the right edge.
        return labels.filter((l) => l.weekIndex < weeks.length - 1);
    }, [weeks]);

    const peak = useMemo(() => {
        let best: ContributionCell | null = null;
        for (const week of weeks) for (const cell of week) if (cell && (!best || cell.count > best.count)) best = cell;
        return best;
    }, [weeks]);

    const streak = useMemo(() => calculateStreak(weeks), [weeks]);

    // ── Tooltip positioning (rAF-throttled, 1 layout per hover) ──
    const handleCellHover = useCallback((day: ContributionCell, e: React.MouseEvent<HTMLDivElement>) => {
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
    // Always fits: the cell size is derived from the measured width and the
    // row comes out exactly that wide, so a phone shows all 12 months with no
    // horizontal scroll. Fractional pixels are kept (no Math.floor) so a
    // 360px screen doesn't dump the leftover into one fat column.
    const NUM_WEEKS = weeks.length || 53;
    // Tighter gaps buy back cell size where it is scarcest.
    const GAP = containerWidth > 0 && containerWidth < 480 ? 2 : 3;
    // Below ~316px a 53-column year can no longer shrink without going
    // sub-pixel; overflow-x stays on purely as a safety net for that case.
    const MIN_CELL = 4;
    const CELL = containerWidth > 0
        ? Math.max(MIN_CELL, (containerWidth - (NUM_WEEKS - 1) * GAP) / NUM_WEEKS)
        : 12;
    // The legend is a key, not a data mark: keep it readable when cells are tiny.
    const LEGEND_CELL = Math.max(CELL, 9);

    const graphHeight = 7 * CELL + 6 * GAP;

    // The calendar year is derived from the data itself, so the label can
    // never drift from what GitHub returned.
    const year = firstDate ? Number(firstDate.slice(0, 4)) : null;

    // ── Chevron button style ── 44×44 min target for thumb tap (WCAG 2.5.5)
    const chevronBtn = (enabled: boolean): React.CSSProperties => ({
        background: 'none', border: 'none', padding: '10px 12px',
        minWidth: 44, minHeight: 44,
        cursor: enabled ? 'pointer' : 'default',
        color: enabled ? 'var(--accent)' : 'var(--text-muted)', opacity: enabled ? 1 : 0.3,
        transition: 'opacity 0.2s, color 0.2s', fontSize: '0.75rem', fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        borderRadius: 8,
    });

    const graphLabel = isLoading
        ? 'Loading contribution activity'
        : `Contribution calendar for @${username}: ${totalContributions.toLocaleString()} contributions in ${year ?? 'the last year'}, from ${firstDate ? formatCalendarDate(firstDate) : ''} to ${lastDate ? formatCalendarDate(lastDate) : ''}.${peak && peak.count > 0 ? ` Busiest day: ${peak.count} contributions on ${formatCalendarDate(peak.date)}.` : ''}`;

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
            {/* ── Header ── */}
            <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}
            >
                {/* Left: icon + count */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div style={{
                        width: 24, height: 24, borderRadius: 6, background: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="white" aria-hidden="true">
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                        </svg>
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                            {isLoading ? '–' : totalContributions.toLocaleString()}
                        </span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: 5 }}>
                            contributions
                        </span>
                    </div>
                </div>

                {/* Center: year stepper. 2023-2025 all return 0 contributions,
                    so today there is exactly one year to show and both
                    chevrons render disabled — same shape as the reference.
                    Enabling them means fetching that year's window. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, userSelect: 'none' }}>
                    <button
                        type="button"
                        disabled
                        style={chevronBtn(false)}
                        aria-label="Previous year"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    <span style={{
                        fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)',
                        minWidth: 38, textAlign: 'center', display: 'inline-block',
                        letterSpacing: '-0.01em',
                    }}>
                        {year ?? '—'}
                    </span>
                    <button
                        type="button"
                        disabled
                        style={chevronBtn(false)}
                        aria-label="Next year"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                </div>

                {/* Right: profile link */}
                <a href={`https://github.com/${username}`} target="_blank" rel="noopener noreferrer"
                    style={{
                        fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent)', textDecoration: 'none',
                        opacity: 0.8, transition: 'opacity 0.2s', letterSpacing: '0.04em', textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}
                >@{username}</a>
            </motion.div>

            {/* ── Graph: horizontally scrollable when cells hit their floor ── */}
            <div
                ref={graphRef}
                role="img"
                aria-label={graphLabel}
                aria-busy={isLoading}
                tabIndex={0}
                className="commits-scroll"
                style={{ overflowX: 'auto', overflowY: 'hidden', paddingBottom: 2 }}
            >
                <motion.div
                    initial={prefersReduced ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: prefersReduced ? 0.01 : 0.3, ease: [0.16, 1, 0.3, 1] }}
                    style={{ position: 'relative', paddingTop: 16, width: 'max-content', minWidth: '100%' }}
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
                                Array.from({ length: 53 }).map((_, wi) => (
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
                                            // Pad slot: a day before the window began, or the
                                            // tail of the in-progress week.
                                            if (!day) {
                                                return <div key={di} style={{ width: CELL, height: CELL }} aria-hidden="true" />;
                                            }
                                            const isHovered = hoveredDay?.date === day.date;
                                            const isToday = day.date === todayStr;

                                            return (
                                                <div
                                                    key={di}
                                                    onMouseEnter={(e) => handleCellHover(day, e)}
                                                    onMouseLeave={handleCellLeave}
                                                    style={{
                                                        width: CELL, height: CELL, borderRadius: 3,
                                                        background: isToday ? 'var(--accent)' : `var(--commits-l${day.level})`,
                                                        cursor: 'pointer',
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
                                                        border: isToday ? `${CELL >= 9 ? 2 : 1}px solid white` : 'none',
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

                {/* Error state fills the graph's footprint so nothing below
                    jumps, and is announced once via role="status". */}
                {!isLoading && error && (
                    <div role="status" style={{
                        height: graphHeight, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        textAlign: 'center', padding: '0 12px',
                        fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)',
                    }}>
                        {error}
                    </div>
                )}
            </div>

            {/* Screen-reader summary of the graph as text. */}
            {!isLoading && (
                <p className="sr-only">
                    {totalContributions.toLocaleString()} contributions in {year ?? 'the last year'}
                    {firstDate && lastDate ? `, from ${formatCalendarDate(firstDate)} to ${formatCalendarDate(lastDate)}` : ''}.
                    Current streak: {streak} day{streak === 1 ? '' : 's'}.
                </p>
            )}

            {/* ── Legend (static — was a motion.div animating on mount) ── */}
            <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 10 }}
            >
                <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', marginRight: 4, fontWeight: 600, letterSpacing: '0.02em' }}>Less</span>
                {[0, 1, 2, 3, 4].map(level => (
                    <div key={level} style={{
                        width: LEGEND_CELL, height: LEGEND_CELL, borderRadius: 3,
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
            {hoveredDay && (
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
                                    <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: `var(--commits-l${hoveredDay.level})`, flexShrink: 0 }} />
                                    <span><strong style={{ fontWeight: 800 }}>{hoveredDay.count}</strong> contribution{hoveredDay.count !== 1 ? 's' : ''}</span>
                                </div>
                                <div style={{ fontSize: '0.58rem', fontWeight: 500, color: 'var(--text-muted)', marginTop: 2 }}>
                                    on {formatCalendarDate(hoveredDay.date)}
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
