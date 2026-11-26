"use client";
import { useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
    X, Monitor, Smartphone, Tablet, Clock, Gauge, MousePointer2, Trash2,
    ArrowDownWideNarrow, Link2, Zap, Radio,
} from 'lucide-react';
import { BOOK_SECTION, EVENT_LABEL, formatMs, sawBookPage, sentLabel, type SessionDoc, type SessionEvent } from '@/lib/analytics/types';

/**
 * One visit, end to end.
 *
 * The left column is the story in order; the right is everything we know about
 * whoever was reading. It follows the booking editor's shape on purpose - same
 * modal chrome, same two-column split, same footer - so nothing here has to be
 * learned twice.
 */

/** "EG" -> the flag. A datum about the visitor, not an icon standing in for one. */
const flagOf = (code?: string): string => {
    if (!code || code.length !== 2) return '';
    try {
        return String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt(0)));
    } catch {
        return '';
    }
};

/**
 * Windows has no flag emoji: it draws "EG" as the two letters. This self-hosted
 * Twemoji font covers only the flag code points, and only loads on browsers that
 * can't draw them. Call once from whatever shows flags; a repeat call is harmless.
 */
export function loadFlagFont(): void {
    // The original project loaded a self-hosted polyfill font. This portfolio
    // relies on the platform emoji fonts (see Flag below) — no extra download.
}

/** The visitor's flag, drawn by the font above where the system can't. */
export const Flag = ({ code, fallback }: { code?: string; fallback: ReactNode }) => {
    const flag = flagOf(code);
    if (!flag) return <>{fallback}</>;
    return (
        <span role="img" aria-label={code} style={{ fontFamily: '"Twemoji Country Flags", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif' }}>
            {flag}
        </span>
    );
};

/** A long tag value (an ad click id runs to 90+ characters) cut to its two ends. */
const shortTag = (v: string) => (v.length > 32 ? `${v.slice(0, 16)}…${v.slice(-8)}` : v);

/** A visit is live if it has not ended and we heard from it inside a minute. */
export const isLive = (s: SessionDoc): boolean =>
    !s.Ended && Date.now() - (s.LastSeenAt || 0) < 60_000;

const EVENT_COLOR: Record<string, string> = {
    section: 'var(--dash-accent-text)',
    project: 'var(--dash-success)',
    project_end: 'color-mix(in srgb, var(--dash-success) 40%, transparent)',
    out: 'var(--dash-accent-text)',
    social: 'var(--dash-accent)',
    social_back: 'color-mix(in srgb, var(--dash-accent) 40%, transparent)',
    cv: 'var(--dash-warning)',
    contact: 'var(--dash-accent)',
    contact_tab: 'color-mix(in srgb, var(--dash-accent) 53%, transparent)',
    contact_sent: 'var(--dash-success)',
    copy: 'var(--dash-warning)',
    scroll: 'var(--dash-text-3)',
    idle: 'var(--dash-text-3)',
    wake: 'var(--dash-text-3)',
    hide: 'var(--dash-text-3)',
    show: 'var(--dash-text-3)',
    rage: 'var(--dash-danger)',
    print: 'var(--dash-warning)',
    end: 'var(--dash-text-3)',
};

export const DeviceIcon = ({ type, size = 16 }: { type?: string; size?: number }) => {
    if (type === 'phone') return <Smartphone size={size} />;
    if (type === 'tablet') return <Tablet size={size} />;
    return <Monitor size={size} />;
};

/** Turn one event into the sentence it deserves. */
function describe(e: SessionEvent): string {
    const label = EVENT_LABEL[e.k] || e.k;
    if (!e.v) return label;
    if (e.k === 'out') {
        const [id, kind] = e.v.split(':');
        const what = kind === 'live' ? 'the live demo' : kind === 'github' ? 'the repo' : 'the download';
        return `Followed ${what} on ${id}`;
    }
    if (e.k === 'scroll') {
        const [section, pct] = e.v.split(':');
        return `Read ${pct}% down ${section}`;
    }
    if (e.k === 'rage') {
        return e.v === 'dead' ? 'Clicked something that does nothing' : 'Clicked the same spot over and over';
    }
    if (e.k === 'copy') return `Copied ${e.v === 'text' ? 'some text' : `your ${e.v}`}`;
    if (e.k === 'section' && e.v === BOOK_SECTION) return 'Opened the book page (/book)';
    if (e.k === 'section' && e.v === 'secret') return 'Opened the sign-in page';
    if (e.k === 'contact_sent') {
        if (e.v === 'book') return 'Booked a call on the book page (/book)';
        if (e.v === 'meeting') return 'Booked a call in the contact modal';
        if (e.v === 'message') return 'Sent a message';
    }
    return `${label} ${e.v}`;
}

const Fact = ({ label, value, isDark }: { label: string; value: string; isDark: boolean }) => (
    <div className="flex items-baseline justify-between gap-3 py-2" style={{ borderBottom: `1px solid ${'var(--dash-border)'}` }}>
        <span className="text-xs font-bold uppercase tracking-[0.12em] shrink-0" style={{ color: 'var(--dash-text-3)' }}>{label}</span>
        <span className="text-xs font-semibold text-right min-w-0 [overflow-wrap:anywhere]" style={{ color: 'var(--dash-text)' }}>{value || '-'}</span>
    </div>
);

const Bar = ({ label, value, max, color, suffix, isDark }: {
    label: string; value: number; max: number; color: string; suffix: string; isDark: boolean;
}) => (
    <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold truncate" style={{ color: 'var(--dash-text)' }}>{label}</span>
            <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: 'var(--dash-text-3)' }}>{suffix}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--dash-surface-2)' }}>
            <div className="h-full rounded-full" style={{ width: `${Math.max(3, Math.round((value / (max || 1)) * 100))}%`, background: color, transition: 'width 220ms ease-out' }} />
        </div>
    </div>
);

interface MStoryProps {
    story: SessionDoc | null;
    isDark: boolean;
    windowWidth: number;
    onClose: () => void;
    onDelete: (id: string) => void;
}

const MStory = ({ story, isDark, windowWidth, onClose, onDelete }: MStoryProps) => {
    const wide = windowWidth >= 900;

    const sections = useMemo(() => {
        if (!story) return [];
        return Object.entries(story.Sections || {})
            .filter(([, ms]) => ms > 0)
            .sort((a, b) => b[1] - a[1]);
    }, [story]);

    const projects = useMemo(() => {
        if (!story) return [];
        return Object.entries(story.Projects || {}).sort((a, b) => (b[1].Ms || 0) - (a[1].Ms || 0));
    }, [story]);

    const socials = useMemo(() => {
        if (!story) return [];
        return Object.entries(story.Socials || {}).sort((a, b) => (b[1].Clicks || 0) - (a[1].Clicks || 0));
    }, [story]);

    const deepest = useMemo(() => {
        if (!story) return 0;
        return Object.values(story.Scroll || {}).reduce((top, pct) => Math.max(top, pct), 0);
    }, [story]);

    if (!story) return null;

    const live = isLive(story);
    const device = story.Device || ({} as SessionDoc['Device']);
    const entry = story.Entry || ({} as SessionDoc['Entry']);
    const started = story.StartedAt ? new Date(story.StartedAt) : null;
    const utm = Object.entries(entry.Utm || {});
    const events = story.Events || [];
    const sectionMax = sections[0]?.[1] || 1;

    const summary = [
        story.Contact?.Sent ? sentLabel(story.Contact.Sent)
            : story.Contact?.Opens ? 'opened contact but left'
                : null,
        sawBookPage(story) && story.Contact?.Sent !== 'book' ? 'saw /book' : null,
        projects.length ? `${projects.length} project${projects.length === 1 ? '' : 's'}` : null,
        story.Cv?.Opens ? 'read the CV' : null,
        story.Visit > 1 ? `visit #${story.Visit}` : 'first time',
    ].filter(Boolean).join(' · ');

    return createPortal(
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-[var(--scrim)] animate-fade-in"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="glass-panel w-full max-w-4xl flex flex-col overflow-hidden shadow-2xl"
                style={{ maxHeight: '90vh' }}
                onClick={e => e.stopPropagation()}
            >
                {/* ── header ─────────────────────────────────────────────── */}
                <div className="flex items-start gap-4 p-5 sm:p-6 border-b" style={{ borderColor: 'var(--dash-border)' }}>
                    <div className="w-11 h-11 rounded-sm grid place-items-center shrink-0 text-xl"
                        style={{ background: 'var(--dash-surface-2)' }}>
                        <Flag code={story.Geo?.Code} fallback={<DeviceIcon type={device.Type} size={20} />} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="heading-sm m-0 truncate">
                                {story.Geo?.Country || 'Somewhere'}
                            </h2>
                            {live && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold"
                                    style={{ background: 'var(--dash-accent-soft)', color: 'var(--dash-success)' }}>
                                    <Radio size={10} className="animate-pulse" /> READING NOW
                                </span>
                            )}
                            {story.Link && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold"
                                    style={{ background: 'var(--dash-accent)', color: 'var(--dash-accent-text)' }}>
                                    <Link2 size={10} /> {story.Link.Name}
                                </span>
                            )}
                            {story.Legacy && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                                    style={{ background: 'var(--dash-surface-2)', color: 'var(--dash-text-3)' }}>
                                    BEFORE THE REWRITE
                                </span>
                            )}
                        </div>
                        <p className="text-xs mt-1 truncate" style={{ color: 'var(--dash-text-3)' }}>
                            {started ? started.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Date unknown'}
                            {summary ? ` · ${summary}` : ''}
                        </p>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="w-9 h-9 grid place-items-center rounded-sm cursor-pointer transition-colors hover:bg-dash-surface-3 dark:hover:bg-dash-surface-3 shrink-0" style={{ color: 'var(--dash-text-3)' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* ── stat strip ─────────────────────────────────────────── */}
                <div className="grid gap-px px-5 sm:px-6 py-4" style={{
                    gridTemplateColumns: `repeat(${windowWidth < 560 ? 2 : 4}, minmax(0, 1fr))`,
                    borderBottom: '1px solid var(--dash-border)',
                }}>
                    {[
                        { icon: <Zap size={14} />, label: 'Active', value: formatMs(story.ActiveMs || 0), tint: 'var(--dash-success)' },
                        { icon: <Clock size={14} />, label: 'Tab open', value: formatMs(story.OpenMs || 0), tint: 'var(--dash-accent-text)' },
                        { icon: <ArrowDownWideNarrow size={14} />, label: 'Read down', value: `${deepest}%`, tint: 'var(--dash-accent)' },
                        { icon: <MousePointer2 size={14} />, label: 'Events', value: String(events.length), tint: 'var(--dash-warning)' },
                    ].map(stat => (
                        <div key={stat.label} className="flex flex-col gap-1 px-1">
                            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em]" style={{ color: stat.tint }}>
                                {stat.icon}{stat.label}
                            </span>
                            <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--dash-text)' }}>{stat.value}</span>
                        </div>
                    ))}
                </div>

                {/* ── body ───────────────────────────────────────────────── */}
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
                    <div className="grid" style={{
                        gridTemplateColumns: wide ? 'minmax(0, 1fr) 296px' : 'minmax(0, 1fr)',
                        gap: wide ? '0' : '0',
                    }}>
                        {/* the story itself */}
                        <div className="p-5 sm:p-6 flex flex-col gap-6">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--dash-text-3)' }}>What they did</span>
                                {events.length === 0 && (
                                    <p className="text-sm mt-2" style={{ color: 'var(--dash-text-3)' }}>
                                        {story.Legacy
                                            ? 'This one predates per-visit recording, so only the totals survived.'
                                            : 'They left before anything happened.'}
                                    </p>
                                )}
                            </div>

                            {events.length > 0 && (
                                <ol className="flex flex-col m-0 p-0 list-none">
                                    {events.map((e, i) => (
                                        <li key={`${e.t}-${i}`} className="flex gap-3 items-start group">
                                            <div className="flex flex-col items-center self-stretch shrink-0">
                                                <span className="w-2 h-2 rounded-full mt-1.5" style={{ background: EVENT_COLOR[e.k] || 'var(--dash-text-3)' }} />
                                                {i < events.length - 1 && (
                                                    <span className="w-px flex-1 min-h-3" style={{ background: 'var(--dash-surface-2)' }} />
                                                )}
                                            </div>
                                            <div className="flex items-baseline justify-between gap-3 flex-1 pb-3 min-w-0">
                                                <span className="text-sm min-w-0 [overflow-wrap:anywhere]" style={{ color: 'var(--dash-text-2)' }}>
                                                    {describe(e)}
                                                </span>
                                                <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: 'var(--dash-text-3)' }}>
                                                    {formatMs(e.t)}
                                                </span>
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            )}

                            {story.EventsCut && (
                                <p className="text-xs" style={{ color: 'var(--dash-text-3)' }}>
                                    The timeline hit its 500-event cap; the totals above still count everything.
                                </p>
                            )}

                            {sections.length > 0 && (
                                <div className="flex flex-col gap-3">
                                    <span className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--dash-text-3)' }}>Where the time went</span>
                                    {sections.map(([name, ms]) => (
                                        <Bar key={name} label={name} value={ms} max={sectionMax} color="var(--dash-accent-text)" suffix={formatMs(ms)} isDark={isDark} />
                                    ))}
                                </div>
                            )}

                            {projects.length > 0 && (
                                <div className="flex flex-col gap-3">
                                    <span className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--dash-text-3)' }}>Projects</span>
                                    {projects.map(([id, p]) => {
                                        const outbound = [
                                            p.Live ? `${p.Live}x demo` : '',
                                            p.Github ? `${p.Github}x repo` : '',
                                            p.Download ? `${p.Download}x download` : '',
                                        ].filter(Boolean).join(' · ');
                                        return (
                                            <div key={id} className="flex flex-col gap-1">
                                                <Bar label={id} value={p.Ms || 0} max={projects[0][1].Ms || 1} color="var(--dash-success)"
                                                    suffix={`${formatMs(p.Ms || 0)} · ${p.Opens}x`} isDark={isDark} />
                                                {outbound && (
                                                    <span className="text-xs font-semibold" style={{ color: 'var(--dash-accent-text)' }}>{outbound}</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {socials.length > 0 && (
                                <div className="flex flex-col gap-3">
                                    <span className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--dash-text-3)' }}>Left for</span>
                                    {socials.map(([name, s]) => (
                                        <Bar key={name} label={name} value={s.AwayMs || 0} max={socials[0][1].AwayMs || 1} color="var(--dash-accent)"
                                            suffix={`${s.Clicks}x · away ${formatMs(s.AwayMs || 0)}`} isDark={isDark} />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* who they were */}
                        <div className="p-5 sm:p-6 flex flex-col gap-1 min-w-0"
                            style={{
                                background: 'var(--dash-surface-2)',
                                borderLeft: wide ? '1px solid var(--dash-border)' : 'none',
                                borderTop: wide ? 'none' : '1px solid var(--dash-border)',
                            }}>
                            <span className="text-xs font-bold uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--dash-text-3)' }}>Who was reading</span>
                            <Fact label="Their clock" value={device.LocalTime ? `${device.LocalTime} local` : ''} isDark={isDark} />
                            <Fact label="Timezone" value={device.Timezone} isDark={isDark} />
                            <Fact label="Device" value={[device.Type, device.OS].filter(Boolean).join(' · ')} isDark={isDark} />
                            <Fact label="Browser" value={device.Browser} isDark={isDark} />
                            <Fact label="Screen" value={device.Screen} isDark={isDark} />
                            <Fact label="Window" value={device.Viewport} isDark={isDark} />
                            <Fact label="Language" value={device.Language} isDark={isDark} />
                            <Fact label="Theme" value={device.Theme} isDark={isDark} />
                            <Fact label="Came from" value={story.Source?.Name || entry.Ref || 'Direct'} isDark={isDark} />
                            <Fact label="Landed on" value={entry.Section} isDark={isDark} />
                            <Fact label="Left from" value={story.Exit?.Section || ''} isDark={isDark} />
                            <Fact label="Idle" value={formatMs(story.IdleMs || 0)} isDark={isDark} />
                            {story.Rage > 0 && <Fact label="Frustration" value={`${story.Rage} dead clicks`} isDark={isDark} />}
                            {story.Copies > 0 && <Fact label="Copied" value={`${story.Copies}x`} isDark={isDark} />}
                            {story.Prints > 0 && <Fact label="Printed" value={`${story.Prints}x`} isDark={isDark} />}
                            {story.Perf?.LoadMs ? (
                                <Fact label="Page load" value={`${(story.Perf.LoadMs / 1000).toFixed(1)}s${story.Perf.LcpMs ? ` · LCP ${(story.Perf.LcpMs / 1000).toFixed(1)}s` : ''}`} isDark={isDark} />
                            ) : null}

                            {utm.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-3">
                                    {utm.map(([k, v]) => (
                                        <span key={k} title={`${k}: ${v}`} className="px-2 py-0.5 rounded-md text-xs font-bold max-w-full [overflow-wrap:anywhere]"
                                            style={{ background: 'var(--dash-accent)', color: 'var(--dash-accent-text)' }}>
                                            {k}: {shortTag(v)}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center gap-2 pt-4 text-xs font-semibold" style={{ color: 'var(--dash-text-3)' }}>
                                <Gauge size={12} />
                                {story.Flushes || 0} check-ins · id {story.Id.slice(0, 12)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── footer ─────────────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t" style={{ borderColor: 'var(--dash-border)' }}>
                    <button
                        type="button"
                        onClick={() => onDelete(story.Id)}
                        className="inline-flex items-center gap-2 px-3 h-10 rounded-sm text-xs font-bold cursor-pointer transition-colors text-dash-danger hover:text-dash-danger hover:bg-dash-accent-soft"
                    >
                        <Trash2 size={14} /> Delete this visit
                    </button>
                    <button type="button" onClick={onClose} className="btn btn-secondary !px-6 !py-2.5">Close</button>
                </div>
            </motion.div>
        </div>,
        document.body,
    );
};

export default MStory;
