"use client";
import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    Copy, Check, MoreVertical, Edit2, Trash2, Activity, Plus, Briefcase, Eye, Globe,
    Footprints, Link2, Radio, Users, Mail, FileText, BellRing, BellOff,
    Search, Filter, ArrowRight, Compass, X, RotateCcw, Inbox, AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, onSnapshot, updateDoc, collection, getDocs, setDoc, deleteDoc, query, orderBy, limit as fsLimit, where } from '@/lib/dash-db';
import { db } from '@/lib/dash-db';
import { dataCall } from '@/lib/dash-transport';
import Reflow from '@/components/dashboard-v2/ui/Reflow';
import LoadingCurtain from '@/components/dashboard-v2/ui/LoadingCurtain';
import Alert from '@/components/dashboard-v2/ui/Alert';
import Toggle from '@/components/dashboard-v2/ui/Toggle';
import RollingNumber from '@/components/dashboard-v2/ui/RollingNumber';
import useSafeAlert from '@/hooks/useSafeAlert';
import MConfirmModal, { ConfirmType } from '../ConfirmModal';
import MStory, { isLive, loadFlagFont } from './Story';
import { formatMs, sawBookPage, type SessionDoc, type LinkDoc, type TotalsDoc, type DayDoc, type SocialStatsDoc } from '@/lib/analytics/types';
import { STORY_KEY } from '@/components/dashboard/primitives/Algorithm';
import useTheme from '@/hooks/useTheme';
import { ChartDataPoint, AnalyticsChart } from './AnalyticsChart';
import { RankInput, ProjectRankings } from './ProjectRankings';
import VisitRow from './VisitRow';
import { dayLabel } from './format';

/**
 * Trails - what people actually did on the portfolio.
 *
 * Three views over one dataset: every visit as its own story, the shape of
 * traffic over time, and the share links that produced some of it. All of it
 * reads `Analytics/*`, which only the trackSession Cloud Function writes.
 *
 * This replaced a tab that could only ever show one merged blob per link, and
 * nothing at all for a visitor who arrived without one.
 */

/** A share link plus the id it lives under. */
interface LinkRow extends LinkDoc {
    id: string;
    url: string;
}

interface SocialRow extends Pick<SocialStatsDoc, 'Clicks' | 'AwayMs'> {
    name: string;
}

interface SourceRow {
    name: string;
    Name?: string;
    Kind?: string;
    Sessions?: number;
    LastAt?: number;
}

/** What each kind is called on screen, and the colour it wears. */
const SOURCE_KINDS: Record<string, { label: string; color: string }> = {
    ai: { label: 'Assistant', color: 'var(--dash-accent-text)' },
    search: { label: 'Search', color: 'var(--dash-accent-text)' },
    social: { label: 'Social', color: 'var(--dash-accent-text)' },
    mail: { label: 'Email', color: 'var(--dash-warning)' },
    referral: { label: 'Link', color: 'var(--dash-success)' },
    direct: { label: 'Typed in', color: 'var(--dash-text-3)' },
};

type StoryFilter = 'all' | 'live' | 'links' | 'book' | 'contacted';
type TrailsView = 'stories' | 'overview' | 'links';

// ── the tab ──────────────────────────────────────────────────────────────
const VIEWS: Array<{ id: TrailsView; label: string; icon: typeof Footprints; tint: string }> = [
    { id: 'stories', label: 'Stories', icon: Footprints, tint: 'var(--chart-1)' },
    { id: 'overview', label: 'Overview', icon: Activity, tint: 'var(--chart-2)' },
    { id: 'links', label: 'Links', icon: Link2, tint: 'var(--chart-3)' },
];

const STORY_FILTERS: Array<{ id: StoryFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'live', label: 'Reading now' },
    { id: 'links', label: 'From a link' },
    { id: 'book', label: 'Book page' },
    { id: 'contacted', label: 'Reached contact' },
];

const DTrails = () => {
    const [windowWidth, setWindowWidth] = useState(1200);
    const isDark = useTheme();
    const [isLoading, setIsLoading] = useState(false);
    const { alert, showAlert, hideAlert } = useSafeAlert(4000);

    const [view, setView] = useState<TrailsView>('stories');
    const [sessions, setSessions] = useState<SessionDoc[]>([]);
    const [dailySeries, setDailySeries] = useState<Array<{ date: string; value: number; projectViews: number; socialClicks: number }>>([]);
    const [totals, setTotals] = useState<TotalsDoc | null>(null);
    const [links, setLinks] = useState<LinkRow[]>([]);
    const [socials, setSocials] = useState<SocialRow[]>([]);
    const [sources, setSources] = useState<SourceRow[]>([]);
    const [rankProjects, setRankProjects] = useState<RankInput[]>([]);

    const [storyFilter, setStoryFilter] = useState<StoryFilter>('all');
    const [dataReady, setDataReady] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [showQuickBounces, setShowQuickBounces] = useState(false);
    useEffect(() => { loadFlagFont(); }, []);
    // Scope the cream + maroon theme to this tab and its portals.
    useEffect(() => {
        document.body.classList.add('trails-theme');
        void dataCall('dedupeTrails', { windowMs: 60_000 }).catch(() => { });
        return () => document.body.classList.remove('trails-theme');
    }, []);
    const [search, setSearch] = useState('');
    const [linkFilter, setLinkFilter] = useState<string | null>(null);
    const [openStoryId, setOpenStoryId] = useState<string | null>(null);
    // A "someone opened your link" email parks the visit id before login. Read it
    // once at mount; the story opens as soon as the visits arrive.
    const [pendingStory, setPendingStory] = useState<string>(() => {
        if (typeof window === 'undefined') return '';
        try { return sessionStorage.getItem(STORY_KEY) || ''; } catch { return ''; }
    });

    const [chartFilter, setChartFilter] = useState<'daily' | 'weekly' | 'monthly'>('daily');

    const [name, setName] = useState('');
    const [forField, setForField] = useState('');
    const [copied, setCopied] = useState<string | null>(null);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
    const [editingLink, setEditingLink] = useState<LinkRow | null>(null);
    const [draft, setDraft] = useState<{ Name: string; For: string; Notify: boolean; AutoCv: boolean; Greeting: string; Pinned: string[] } | null>(null);

    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean; title: string; message: string; onConfirm: () => void; type?: ConfirmType;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const isExtraSmall = windowWidth < 400;

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // ── data ─────────────────────────────────────────────────────────────
    useEffect(() => {
        // Every listener below reads /Analytics, which the rules open to the admin
        // alone - so they are refused together or not at all. Say it once instead of
        // five times, and say it at all: four of these had no error callback, so a
        // refusal surfaced only as a wall of uncaught "Error in snapshot listener" in
        // the console while the page sat there looking merely empty.
        let told = false;
        const onDenied = () => {
            if (told) return;
            told = true;
            setLoadError(true);
            setDataReady(true);
            showAlert({ type: 'error', message: 'Could not load visits.' });
        };

        const stories = onSnapshot(
            query(collection(db, 'Analytics', 'Sessions', 'Items'), orderBy('StartedAt', 'desc'), fsLimit(300)),
            snap => {
                setSessions(snap.docs
                    .map(d => ({ ...(d.data() as SessionDoc), Id: d.id }))
                    .filter(s => !s.Hidden && !s.Owner));
                setLoadError(false);
                setDataReady(true);
            },
            onDenied,
        );

        const days = onSnapshot(collection(db, 'Analytics', 'Days', 'Items'), snap => {
            const rows = snap.docs
                .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.id))
                .map(d => {
                    const v = d.data() as Partial<DayDoc>;
                    return {
                        date: d.id,
                        value: Number(v.Sessions || 0),
                        projectViews: Number(v.Projects || 0),
                        socialClicks: Number(v.Socials || 0),
                    };
                })
                .sort((a, b) => a.date.localeCompare(b.date));
            setDailySeries(rows);
        }, onDenied);

        const totalsUnsub = onSnapshot(doc(db, 'Analytics', 'Totals'), snap => {
            setTotals(snap.exists() ? (snap.data() as TotalsDoc) : null);
        }, onDenied);

        const linksUnsub = onSnapshot(collection(db, 'Analytics', 'Links', 'Items'), snap => {
            const rows: LinkRow[] = snap.docs.map(d => {
                const data = d.data() as LinkDoc;
                return {
                    ...data,
                    id: d.id,
                    Tailor: data.Tailor || { AutoCv: false, Greeting: '', Pinned: [] },
                    url: `${window.location.origin}/mohanddarwish/${data.Code || ''}`,
                };
            });
            rows.sort((a, b) => (b.LastOpenAt || 0) - (a.LastOpenAt || 0) || Number(b.id) - Number(a.id));
            setLinks(rows);
        }, onDenied);

        const socialsUnsub = onSnapshot(collection(db, 'Analytics', 'Socials', 'Items'), snap => {
            setSocials(snap.docs
                .map(d => ({ name: d.id, ...(d.data() as SocialStatsDoc) }))
                .sort((a, b) => (b.Clicks || 0) - (a.Clicks || 0)));
        }, onDenied);

        const sourcesUnsub = onSnapshot(collection(db, 'Analytics', 'Sources', 'Items'), snap => {
            setSources(snap.docs
                .map(d => ({ name: d.id, ...(d.data() as Omit<SourceRow, 'name'>) }))
                .sort((a, b) => (b.Sessions || 0) - (a.Sessions || 0)));
        }, onDenied);

        const projectsUnsub = onSnapshot(collection(db, 'Projects'), snap => {
            setRankProjects(snap.docs.map(d => {
                const data = d.data();
                const v = (data.Views || {}) as { Project?: number; Live?: number; Github?: number; Download?: number };
                return {
                    id: d.id,
                    name: d.id,
                    icon: data['Project Icon'] || '',
                    views: Number(v.Project || 0) || 0,
                    liveViews: Number(v.Live || 0) || 0,
                    githubViews: Number(v.Github || 0) || 0,
                    downloadViews: Number(v.Download || 0) || 0,
                };
            }));
        });

        return () => { stories(); days(); totalsUnsub(); linksUnsub(); socialsUnsub(); sourcesUnsub(); projectsUnsub(); };
    }, [showAlert]);

    // Claim the parked id so a refresh does not reopen the same story forever.
    useEffect(() => {
        if (!pendingStory) return;
        try { sessionStorage.removeItem(STORY_KEY); } catch { /* nothing to clear */ }
    }, [pendingStory]);

    // Derived rather than stored, so whatever is open stays in step with its live
    // document and the deep link needs no state-copying effect of its own.
    const openStory = useMemo(() => {
        const wanted = openStoryId || pendingStory;
        return wanted ? sessions.find(s => s.Id === wanted) || null : null;
    }, [sessions, openStoryId, pendingStory]);

    // ── derived ──────────────────────────────────────────────────────────
    const countedSessions = useMemo(
        () => sessions.filter(s => !s.Owner && !s.Hidden && (showQuickBounces || (s.ActiveMs || 0) >= 1000)),
        [sessions, showQuickBounces],
    );

    const matchesFilter = useCallback((s: SessionDoc, filter: StoryFilter) => {
        if (filter === 'live') return isLive(s);
        if (filter === 'links') return !!s.Link;
        if (filter === 'book') return sawBookPage(s);
        if (filter === 'contacted') return !!(s.Contact?.Opens || s.Contact?.Sent);
        return true;
    }, []);

    const filterCounts = useMemo(() => {
        const counts: Record<StoryFilter, number> = { all: 0, live: 0, links: 0, book: 0, contacted: 0 };
        for (const s of countedSessions) {
            for (const f of STORY_FILTERS) if (matchesFilter(s, f.id)) counts[f.id] += 1;
        }
        return counts;
    }, [countedSessions, matchesFilter]);

    const visibleStories = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return countedSessions.filter(s => {
            if (linkFilter && s.Link?.Id !== linkFilter) return false;
            if (!matchesFilter(s, storyFilter)) return false;
            if (!needle) return true;
            return [
                s.Geo?.Country, s.Geo?.Code, s.Device?.Browser, s.Device?.OS,
                s.Link?.Name, s.Link?.For, s.Entry?.Ref,
            ].some(field => (field || '').toLowerCase().includes(needle));
        });
    }, [countedSessions, search, storyFilter, linkFilter, matchesFilter]);

    const groupedStories = useMemo(() => {
        const groups: Array<{ label: string; rows: SessionDoc[] }> = [];
        for (const s of visibleStories) {
            const label = dayLabel(Number(s.StartedAt) || 0);
            const group = groups.find(g => g.label === label);
            if (group) group.rows.push(s);
            else groups.push({ label, rows: [s] });
        }
        return groups;
    }, [visibleStories]);

    const liveCount = filterCounts.live;

    const chartData = useMemo(() => {
        if (!dailySeries.length) return [] as ChartDataPoint[];
        let aggregated: ChartDataPoint[];

        if (chartFilter === 'daily') {
            const sliceCount = windowWidth < 450 ? -30 : windowWidth < 768 ? -60 : -180;
            aggregated = dailySeries.slice(sliceCount).map(s => {
                const d = new Date(s.date);
                return {
                    label: `${d.getDate()}/${d.getMonth() + 1}`,
                    dateNum: d.getDate(),
                    value: s.value,
                    projectViews: s.projectViews,
                    socialClicks: s.socialClicks,
                    fullDate: s.date,
                    type: 'daily' as const,
                };
            });
        } else if (chartFilter === 'weekly') {
            const weeks: Record<string, { total: number; p: number; s: number }> = {};
            dailySeries.forEach(s => {
                // The date keys are UTC, so bucket by the UTC Monday - using local
                // getDay() put anyone west of UTC in the wrong week.
                const d = new Date(s.date);
                const day = d.getUTCDay();
                const monday = new Date(d);
                monday.setUTCDate(d.getUTCDate() - day + (day === 0 ? -6 : 1));
                if (isNaN(monday.getTime())) return;
                const key = monday.toISOString().split('T')[0];
                if (!weeks[key]) weeks[key] = { total: 0, p: 0, s: 0 };
                weeks[key].total += s.value;
                weeks[key].p += s.projectViews;
                weeks[key].s += s.socialClicks;
            });
            aggregated = Object.entries(weeks).map(([date, vals]) => {
                const d = new Date(date);
                return {
                    label: `${d.getDate()}/${d.getMonth() + 1}`,
                    dateNum: d.getMonth() + 1,
                    value: vals.total, projectViews: vals.p, socialClicks: vals.s,
                    fullDate: date, type: 'weekly' as const,
                };
            }).sort((a, b) => a.fullDate.localeCompare(b.fullDate));
        } else {
            const months: Record<string, { total: number; p: number; s: number }> = {};
            dailySeries.forEach(s => {
                const key = s.date.slice(0, 7);
                if (!months[key]) months[key] = { total: 0, p: 0, s: 0 };
                months[key].total += s.value;
                months[key].p += s.projectViews;
                months[key].s += s.socialClicks;
            });
            aggregated = Object.entries(months).map(([key, vals]) => {
                const [year, month] = key.split('-');
                const date = new Date(Number(year), Number(month) - 1, 1);
                return {
                    label: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
                    dateNum: Number(year),
                    value: vals.total, projectViews: vals.p, socialClicks: vals.s,
                    fullDate: key, type: 'monthly' as const,
                };
            }).sort((a, b) => a.fullDate.localeCompare(b.fullDate));
        }

        // Same date a year earlier, for the ghost comparison line.
        const byDate = new Map(dailySeries.map(s => [s.date, s.value]));
        return aggregated.map(item => {
            const d = new Date(item.fullDate);
            if (isNaN(d.getTime())) return { ...item, prevValue: 0 };
            d.setFullYear(d.getFullYear() - 1);
            return { ...item, prevValue: byDate.get(d.toISOString().split('T')[0]) || 0 };
        });
    }, [dailySeries, chartFilter, windowWidth]);

    // ── link actions ─────────────────────────────────────────────────────
    const createLink = async () => {
        if (!name.trim() || !forField.trim()) return;
        setIsLoading(true);
        try {
            // Typed Convex link ops keep the live tracker's tables in sync; a raw
            // Analytics/Links/Items write would leave the public site unaware.
            await dataCall('createLink', {
                name: name.trim(),
                for: forField.trim(),
                notify: true,
                autoCv: false,
            });
            setName('');
            setForField('');
            showAlert({ type: 'success', message: 'Link ready. It emails you the moment it is opened.' });
        } catch {
            showAlert({ type: 'error', message: 'Could not create that link.' });
        } finally {
            setIsLoading(false);
        }
    };

    const patchLink = useCallback(async (id: string, patch: Record<string, unknown>, message?: string) => {
        try {
            await dataCall('updateLink', { docId: id, patch });
            if (message) showAlert({ type: 'success', message });
        } catch {
            showAlert({ type: 'error', message: 'Could not save that change.' });
        }
    }, [showAlert]);

    const saveDraft = async () => {
        if (!editingLink || !draft) return;
        if (!draft.Name.trim() || !draft.For.trim()) return;
        await patchLink(editingLink.id, {
            Name: draft.Name.trim(),
            For: draft.For.trim(),
            Notify: draft.Notify,
            Tailor: { AutoCv: draft.AutoCv, Greeting: draft.Greeting.trim().slice(0, 160), Pinned: draft.Pinned },
        }, 'Link updated.');
        setEditingLink(null);
        setDraft(null);
    };

    const deleteLink = async (id: string) => {
        setActiveMenu(null);
        try {
            await dataCall('deleteLink', { docId: id });
            showAlert({ type: 'success', message: 'Link removed. Its visits are still on record.' });
        } catch {
            showAlert({ type: 'error', message: 'Could not remove that link.' });
        }
    };

    /** Throw away every story that came through one link, and zero its counters. */
    const forgetLinkVisits = async (id: string) => {
        setActiveMenu(null);
        setIsLoading(true);
        try {
            // The Convex op removes sessions, tombstones them and reconciles all
            // aggregates in one transaction (never a partial client-side sweep).
            const result = await dataCall<{ deleted?: number }>('forgetLinkVisits', { docId: id });
            const count = typeof result?.deleted === 'number' ? result.deleted : 0;
            showAlert({ type: 'success', message: `Forgot ${count} visit${count === 1 ? '' : 's'}.` });
        } catch {
            showAlert({ type: 'error', message: 'Could not clear those visits.' });
        } finally {
            setIsLoading(false);
        }
    };

    const deleteStory = async (id: string) => {
        try {
            // The server deletes the session and subtracts its contribution from
            // every aggregate atomically (including the link counters).
            await dataCall('deleteSession', { sessionId: id });
            setOpenStoryId(null);
            setPendingStory('');
            showAlert({ type: 'success', message: 'Visit deleted.' });
        } catch {
            showAlert({ type: 'error', message: 'Could not delete that visit.' });
        }
    };

    const copyToClipboard = async (link: string, id: string) => {
        try {
            await navigator.clipboard.writeText(link);
            setCopied(id);
            setTimeout(() => setCopied(null), 2000);
        } catch {
            showAlert({ type: 'error', message: 'Could not copy that.' });
        }
    };

    const openMenu = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setMenuPos({ top: rect.bottom + 4, right: document.documentElement.clientWidth - rect.right });
        setActiveMenu(activeMenu === id ? null : id);
    };

    const startEdit = (link: LinkRow) => {
        setEditingLink(link);
        setDraft({
            Name: link.Name || '',
            For: link.For || '',
            Notify: link.Notify !== false,
            AutoCv: link.Tailor?.AutoCv === true,
            Greeting: link.Tailor?.Greeting || '',
            Pinned: link.Tailor?.Pinned || [],
        });
        setActiveMenu(null);
    };

    // ── render ───────────────────────────────────────────────────────────
    // Sits beside the tabs. The tab is the title; this only adds what the tab
    // can't say, which is what you are looking at right now.
    const viewCaption = view === 'stories'
        ? 'Every visit, in the order it happened'
        : view === 'links'
            ? 'Private doors into the portfolio, one per person'
            : dailySeries.length ? `Since ${dailySeries[0].date}` : 'Nothing recorded yet';

    const counters = [
        { label: 'Visits', value: totals?.Sessions ?? 0, icon: <Footprints size={18} />, tint: 'var(--dash-accent-text)' },
        { label: 'People', value: totals?.Visitors ?? 0, icon: <Users size={18} />, tint: 'var(--dash-success)' },
        { label: 'Link opens', value: totals?.LinkOpens ?? 0, icon: <Link2 size={18} />, tint: 'var(--dash-accent)' },
        { label: 'Reached contact', value: totals?.Contacts ?? 0, icon: <Mail size={18} />, tint: 'var(--dash-accent)' },
    ];

    return (
        <div className="trails-page flex flex-col gap-4 h-full overflow-y-auto lg:overflow-hidden p-1 sm:p-0">
            <LoadingCurtain open={isLoading} portal />
            <div className="shrink-0">
                <p className="trail-subtitle">{viewCaption}</p>
            </div>

            {/* One header row - tabs, what you're looking at, and the live pill.
                Everything below it is content. */}
            <div className="flex items-center gap-x-3 gap-y-2 flex-wrap shrink-0">
                <div role="tablist" aria-label="Trails views" className="flex overflow-x-auto" style={{
                    gap: isExtraSmall ? '4px' : '6px',
                    backgroundColor: 'var(--dash-surface-2)',
                    padding: isExtraSmall ? '4px' : '5px',
                    borderRadius: '14px',
                    width: isExtraSmall ? '100%' : 'fit-content',
                }}>
                    {VIEWS.map(item => {
                        const Icon = item.icon;
                        const active = view === item.id;
                        return (
                            <button
                                key={item.id}
                                role="tab"
                                aria-selected={active}
                                onClick={() => setView(item.id)}
                                className="relative flex items-center whitespace-nowrap cursor-pointer font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-accent"
                                style={{
                                    gap: isExtraSmall ? '6px' : '8px',
                                    padding: isExtraSmall ? '8px 12px' : '9px 16px',
                                    borderRadius: '10px',
                                    color: active ? `${item.tint}` : 'var(--dash-text-2)',
                                    fontSize: isExtraSmall ? '13px' : '14px',
                                    flex: isExtraSmall ? 1 : 'none',
                                }}
                            >
                                {active && (
                                    <motion.span
                                        layoutId="trails-view-pill"
                                        className="absolute inset-0 rounded-[10px]"
                                        style={{ background: `color-mix(in srgb, ${item.tint} 14%, transparent)` }}
                                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                    />
                                )}
                                <Icon size={isExtraSmall ? 15 : 17} className="relative z-10" />
                                <span className="relative z-10">
                                    {item.id === 'links' ? `${item.label} (${links.length})` : item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {liveCount > 0 && (
                    <button
                        onClick={() => { setView('stories'); setStoryFilter('live'); }}
                        className="inline-flex items-center gap-2 px-3 h-9 rounded-full text-xs font-bold cursor-pointer transition-colors"
                        style={{ background: 'var(--dash-accent-soft)', color: 'var(--dash-success)' }}
                    >
                        <Radio size={13} className="animate-pulse" />
                        {liveCount} reading now
                    </button>
                )}

            </div>

            <div className="flex-1 min-h-0">
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={view}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full min-h-0 flex flex-col"
                    >
                        {view === 'stories' && (
                            <div className="flex flex-col h-full min-h-0">
                                {/* The title, the filters and the search stay put. Only the
                                    rows underneath move, which is the thing you are reading. */}
                                <div className="shrink-0 flex flex-col gap-4 pb-4">
                                    {/* filters */}
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {STORY_FILTERS.map(f => {
                                                const active = storyFilter === f.id;
                                                return (
                                                    <button
                                                        key={f.id}
                                                        type="button"
                                                        aria-pressed={active}
                                                        onClick={() => setStoryFilter(f.id)}
                                                        className={`inline-flex items-center gap-2 h-9 px-3 rounded-sm text-xs font-semibold cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-accent ${active
                                                            ? 'bg-dash-accent text-white'
                                                            : 'bg-dash-surface-raised text-dash-text-2 hover:bg-dash-surface-hover'}`}
                                                    >
                                                        {f.label}
                                                        <span className={`tabular-nums px-1.5 py-0.5 rounded-sm text-[11px] ${active ? 'bg-white/15 text-white' : 'bg-dash-surface-hover text-dash-text-2'}`}>
                                                            {filterCounts[f.id]}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="relative flex-1 min-w-[180px]">
                                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-dash-text-3" />
                                            <input
                                                type="text"
                                                value={search}
                                                onChange={e => setSearch(e.target.value)}
                                                placeholder="Search visits, countries, browsers…"
                                                aria-label="Search visits"
                                                className="trail-search w-full rounded-sm border pl-10 pr-10 outline-none transition-colors focus:border-dash-accent"
                                                style={{
                                                    backgroundColor: 'var(--dash-surface)',
                                                    borderColor: 'var(--dash-border)',
                                                    color: 'var(--dash-text)',
                                                }}
                                            />
                                            {search && (
                                                <button
                                                    type="button"
                                                    aria-label="Clear search"
                                                    onClick={() => setSearch('')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-sm cursor-pointer text-dash-text-2 hover:bg-dash-surface-hover focus-visible:outline-2 focus-visible:outline-dash-accent"
                                                >
                                                    <X size={15} />
                                                </button>
                                            )}
                                        </div>

                                        {linkFilter && (
                                            <button
                                                onClick={() => setLinkFilter(null)}
                                                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-sm text-xs font-bold cursor-pointer bg-dash-accent text-white"
                                            >
                                                <Filter size={13} />
                                                {links.find(l => l.id === linkFilter)?.Name || 'Link'}
                                                <Plus size={13} className="rotate-45" />
                                            </button>
                                        )}

                                        <label className="inline-flex items-center gap-2 h-9 px-2 rounded-sm cursor-pointer text-xs font-semibold text-dash-text-2">
                                            <Toggle
                                                checked={showQuickBounces}
                                                onChange={setShowQuickBounces}
                                                aria-label="Show quick bounces"
                                            />
                                            Show quick bounces
                                        </label>
                                    </div>
                                </div>

                                {/* the list - the only part that scrolls */}
                                <div className="trail-scroll flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
                                    {loadError ? (
                                        <div className="trail-panel border-dashed p-10 text-center flex flex-col items-center gap-3">
                                            <AlertCircle size={24} className="text-dash-danger" />
                                            <p className="trail-primary">Could not load visits</p>
                                            <p className="trail-secondary">Check the connection and try again.</p>
                                            <button type="button" onClick={() => window.location.reload()}
                                                className="btn btn-secondary inline-flex items-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-dash-accent">
                                                <RotateCcw size={14} /> Retry
                                            </button>
                                        </div>
                                    ) : !dataReady ? (
                                        <div className="trail-panel" aria-busy="true" aria-label="Loading visits">
                                            {[0, 1, 2, 3].map(i => (
                                                <div key={i} className="trail-skeleton-row skeleton" />
                                            ))}
                                        </div>
                                    ) : visibleStories.length === 0 ? (
                                        <div className="trail-panel border-dashed p-10 text-center flex flex-col items-center gap-3">
                                            <Inbox size={24} className="text-dash-text-3" />
                                            <p className="trail-primary">No visits match these filters</p>
                                            <p className="trail-secondary">Try clearing the search or showing quick bounces.</p>
                                            <button type="button"
                                                onClick={() => { setSearch(''); setStoryFilter('all'); setLinkFilter(null); }}
                                                className="btn btn-secondary inline-flex items-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-dash-accent">
                                                <RotateCcw size={14} /> Reset filters
                                            </button>
                                        </div>
                                    ) : (
                                        <ul role="list" className="trail-panel flex flex-col">
                                            {groupedStories.map(group => (
                                                <li key={group.label} role="presentation">
                                                    <div className="trail-day-header">{group.label}</div>
                                                    <ul role="list">
                                                        {group.rows.map(story => (
                                                            <VisitRow key={story.Id} session={story} onOpen={setOpenStoryId} />
                                                        ))}
                                                    </ul>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}

                        {view === 'overview' && (
                            <div className="flex flex-col h-full min-h-0 w-full">
                                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 pb-12">
                                    <div className="flex flex-col gap-8 w-full">
                                        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${windowWidth < 520 ? 140 : 180}px, 1fr))` }}>
                                            {counters.map(c => (
                                                <div key={c.label} className="rounded-[24px] border p-5 flex flex-col gap-3"
                                                    style={{
                                                        background: 'var(--dash-surface-2)',
                                                        borderColor: 'var(--dash-border)',
                                                    }}>
                                                    <span className="w-9 h-9 rounded-sm grid place-items-center"
                                                        style={{ background: `color-mix(in srgb, c.tint 12%, transparent)`, color: c.tint }}>
                                                        {c.icon}
                                                    </span>
                                                    <div className="flex flex-col">
                                                        <RollingNumber
                                                            text={c.value.toLocaleString()}
                                                            className="text-3xl font-bold tracking-tight tabular-nums"
                                                            style={{ color: isDark ? 'var(--dash-text)' : 'var(--dash-text)' }}
                                                        />
                                                        <span className="text-[9px] font-bold uppercase tracking-[0.2em] mt-1" style={{ color: 'var(--dash-text-3)' }}>
                                                            {c.label}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <AnalyticsChart
                                            data={chartData}
                                            filter={chartFilter}
                                            setFilter={setChartFilter}
                                            isDark={isDark}
                                            windowWidth={windowWidth}
                                        />

                                        <ProjectRankings projects={rankProjects} isDark={isDark} />

                                        {sources.length > 0 && (
                                            <div className={`w-full ${isDark ? 'bg-[var(--dash-bg)] border-dash-border' : 'bg-dash-surface border-dash-border shadow-sm'} rounded-[28px] p-5 sm:p-8 border`}>
                                                <div className="flex items-center gap-3 mb-6">
                                                    <div className={`${isDark ? 'bg-dash-accent-soft text-dash-success' : 'bg-dash-accent-soft text-dash-success'} w-10 h-10 flex items-center justify-center rounded-sm`}>
                                                        <Compass size={20} />
                                                    </div>
                                                    <div>
                                                        <h3 className={`${isDark ? 'text-dash-text' : 'text-dash-text'} text-xl sm:text-2xl font-bold tracking-[-0.02em] leading-none`}>
                                                            How they found you
                                                        </h3>
                                                        <p className={`${isDark ? 'text-dash-text-3' : 'text-dash-text-3'} text-[10px] font-bold uppercase tracking-[0.15em] mt-1.5`}>
                                                            {(() => {
                                                                const ai = sources.filter(s => s.Kind === 'ai').reduce((t, s) => t + (s.Sessions || 0), 0);
                                                                const all = sources.reduce((t, s) => t + (s.Sessions || 0), 0);
                                                                return ai
                                                                    ? `${ai} of ${all} sent by an assistant`
                                                                    : 'Search, assistants, links and typed-in visits';
                                                            })()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    {sources.map(s => {
                                                        const kind = SOURCE_KINDS[s.Kind || 'referral'] || SOURCE_KINDS.referral;
                                                        return (
                                                            <div key={s.name} className={`flex items-center justify-between gap-4 px-4 py-3 rounded-sm border ${isDark ? 'bg-dash-surface-2 border-dash-border' : 'bg-dash-surface-2 border-dash-border'}`}>
                                                                <span className="flex items-center gap-2.5 min-w-0">
                                                                    <span className={`text-sm font-bold truncate ${isDark ? 'text-dash-text' : 'text-dash-text'}`}>{s.Name || s.name}</span>
                                                                    <span className="text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full shrink-0"
                                                                        style={{ color: kind.color, background: `color-mix(in srgb, kind.color 12%, transparent)` }}>
                                                                        {kind.label}
                                                                    </span>
                                                                </span>
                                                                <span className="shrink-0 text-[11px] font-bold tabular-nums" style={{ color: 'var(--dash-text-3)' }}>
                                                                    {(s.Sessions || 0).toLocaleString()} {(s.Sessions || 0) === 1 ? 'visit' : 'visits'}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {socials.length > 0 && (
                                            <div className={`w-full ${isDark ? 'bg-[var(--dash-bg)] border-dash-border' : 'bg-dash-surface border-dash-border shadow-sm'} rounded-[28px] p-5 sm:p-8 border`}>
                                                <div className="flex items-center gap-3 mb-6">
                                                    <div className={`${isDark ? 'bg-dash-accent-soft text-dash-accent-text' : 'bg-dash-accent-soft text-dash-accent-text'} w-10 h-10 flex items-center justify-center rounded-sm`}>
                                                        <Globe size={20} />
                                                    </div>
                                                    <div>
                                                        <h3 className={`${isDark ? 'text-dash-text' : 'text-dash-text'} text-xl sm:text-2xl font-bold tracking-[-0.02em] leading-none`}>
                                                            Where they went next
                                                        </h3>
                                                        <p className={`${isDark ? 'text-dash-text-3' : 'text-dash-text-3'} text-[10px] font-bold uppercase tracking-[0.15em] mt-1.5`}>
                                                            Social links, and how long they stayed away
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    {socials.map(s => (
                                                        <div key={s.name} className={`flex items-center justify-between gap-4 px-4 py-3 rounded-sm border ${isDark ? 'bg-dash-surface-2 border-dash-border' : 'bg-dash-surface-2 border-dash-border'}`}>
                                                            <span className={`text-sm font-bold truncate ${isDark ? 'text-dash-text' : 'text-dash-text'}`}>{s.name}</span>
                                                            <span className="flex items-center gap-4 shrink-0 text-[11px] font-bold tabular-nums" style={{ color: 'var(--dash-text-3)' }}>
                                                                <span>{(s.Clicks || 0).toLocaleString()} clicks</span>
                                                                <span style={{ color: 'var(--dash-accent-text)' }}>{formatMs(s.AwayMs || 0)} away</span>
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {view === 'links' && (
                            <div className="flex flex-col h-full min-h-0">
                                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 pb-12">
                                    <div className="grid gap-6 items-start" style={{
                                        gridTemplateColumns: windowWidth >= 1100 ? 'minmax(0, 320px) minmax(0, 1fr)' : 'minmax(0, 1fr)',
                                    }}>
                                        {/* Pinned once there are two columns: you can keep making links
                                            without scrolling back up past everything you already made. */}
                                        <div className="glass-panel p-6 sm:p-7"
                                            style={windowWidth >= 1100 ? { position: 'sticky', top: 0 } : undefined}>
                                            <h3 className="heading-sm mb-5">New link</h3>
                                            <div className="flex flex-col gap-4">
                                                <div className="flex flex-col gap-2">
                                                    <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--dash-text-3)' }} htmlFor="trails-link-name">Who it is for</label>
                                                    <input id="trails-link-name" type="text" className="input-field" value={name}
                                                        onChange={e => setName(e.target.value)} placeholder="e.g. Google" />
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--dash-text-3)' }} htmlFor="trails-link-for">What it is about</label>
                                                    <input id="trails-link-for" type="text" className="input-field" value={forField}
                                                        onChange={e => setForField(e.target.value)} placeholder="e.g. Frontend role" />
                                                </div>
                                                <button onClick={createLink} disabled={!name.trim() || !forField.trim()}
                                                    className="btn btn-primary w-full py-3.5 mt-1">
                                                    Create link
                                                </button>
                                                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--dash-text-3)' }}>
                                                    New links email you the moment they are opened, with a button
                                                    straight to that visit.
                                                </p>
                                            </div>
                                        </div>

                                        {links.length === 0 ? (
                                            <div className="glass-surface rounded-sm border-dashed p-12 text-center text-dash-text-2">
                                                No links yet.
                                            </div>
                                        ) : (
                                        <Reflow className="grid gap-4" style={{
                                            gridTemplateColumns: windowWidth >= 720 ? 'repeat(auto-fit, minmax(320px, 1fr))' : 'minmax(0, 1fr)',
                                        }} items={links} keyOf={link => link.id} render={link => (
                                                <div className="glass-panel p-5 sm:p-6 flex flex-col gap-4">
                                                    <div className="flex justify-between items-start gap-3">
                                                        <div className="flex flex-col min-w-0">
                                                            <h3 className="font-bold text-lg leading-tight truncate">{link.Name}</h3>
                                                            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--dash-text-3)' }}>{link.For}</p>
                                                        </div>
                                                        <button onClick={e => openMenu(e, link.id)} aria-label={`Options for ${link.Name}`}
                                                            className="p-1 shrink-0 cursor-pointer transition-colors hover:text-dash-accent-text" style={{ color: 'var(--dash-text-3)' }}>
                                                            <MoreVertical size={18} />
                                                        </button>
                                                    </div>

                                                    <div className="flex items-center gap-3 p-3 rounded-sm border"
                                                        style={{ background: 'var(--dash-surface-2)', borderColor: 'var(--dash-border)' }}>
                                                        <code className="text-[10px] font-heading flex-1 truncate" style={{ color: 'var(--dash-text-3)' }}>{link.url}</code>
                                                        <button onClick={() => copyToClipboard(link.url, link.id)} aria-label="Copy link"
                                                            className="cursor-pointer transition-colors hover:text-dash-accent-text" style={{ color: 'var(--dash-text-3)' }}>
                                                            {copied === link.id ? <Check size={15} className="text-dash-success" /> : <Copy size={15} />}
                                                        </button>
                                                    </div>

                                                    <div className="flex items-center gap-4 text-[11px] font-bold tabular-nums" style={{ color: 'var(--dash-text-3)' }}>
                                                        <span className="flex items-center gap-1.5"><Eye size={13} />{link.Opens || 0} opens</span>
                                                        <span className="flex items-center gap-1.5"><Footprints size={13} />{link.Sessions || 0} visits</span>
                                                        {link.LastOpenAt ? (
                                                            <span className="truncate">{new Date(link.LastOpenAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                                        ) : null}
                                                    </div>

                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <button
                                                            onClick={() => patchLink(link.id, { Notify: link.Notify === false }, link.Notify === false ? 'You will be emailed on every open.' : 'Notifications off for this link.')}
                                                            className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                                                            style={{
                                                                background: 'var(--dash-surface-3)',
                                                                color: link.Notify !== false ? 'var(--dash-accent-text)' : 'var(--dash-text-3)',
                                                            }}
                                                        >
                                                            {link.Notify !== false ? <BellRing size={13} /> : <BellOff size={13} />}
                                                            {link.Notify !== false ? 'Emails on' : 'Emails off'}
                                                        </button>
                                                        {link.Tailor?.AutoCv && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[10px] font-bold"
                                                                style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
                                                                <FileText size={13} /> CV opens itself
                                                            </span>
                                                        )}
                                                        {(link.Tailor?.Pinned?.length || 0) > 0 && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[10px] font-bold"
                                                                style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                                                                <Briefcase size={13} /> {link.Tailor.Pinned.length} pinned
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={() => { setLinkFilter(link.id); setStoryFilter('all'); setView('stories'); }}
                                                            disabled={!link.Sessions}
                                                            className="ml-auto inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-[10px] font-bold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-default"
                                                            style={{ background: 'var(--dash-accent)', color: 'var(--dash-accent-text)' }}
                                                        >
                                                            See visits <ArrowRight size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* link options menu */}
            {activeMenu && createPortal(
                <>
                    <div className="fixed inset-0 z-[999]" onClick={() => setActiveMenu(null)} />
                    <div className="fixed z-[1000] glass-panel min-w-[200px] p-2 animate-pop flex flex-col gap-1 shadow-2xl"
                        style={{ top: `${menuPos.top}px`, right: `${menuPos.right}px`, borderRadius: '16px' }}>
                        <button
                            onClick={() => { const l = links.find(x => x.id === activeMenu); if (l) startEdit(l); }}
                            className="w-full text-left flex items-center gap-2.5 bg-transparent border-none cursor-pointer rounded-lg text-sm p-2.5 transition-colors hover:bg-dash-surface-3 dark:hover:bg-dash-surface-3"
                            style={{ color: 'var(--dash-text)' }}>
                            <Edit2 size={15} /> Edit &amp; tailor
                        </button>
                        <div className="mx-2 my-1 h-px" style={{ background: 'var(--dash-surface-2)' }} />
                        <button
                            onClick={() => {
                                const id = activeMenu;
                                setConfirmConfig({
                                    isOpen: true,
                                    title: 'Forget this link’s visits',
                                    message: 'Every story recorded through this link is deleted and its counters go back to zero. The link itself keeps working.',
                                    type: 'warning',
                                    onConfirm: () => forgetLinkVisits(id),
                                });
                            }}
                            className="w-full text-left flex items-center gap-2.5 bg-transparent border-none cursor-pointer rounded-lg text-sm p-2.5 transition-colors hover:bg-dash-warning/15"
                            style={{ color: 'var(--dash-warning)' }}>
                            <Trash2 size={15} /> Forget its visits
                        </button>
                        <button
                            onClick={() => {
                                const id = activeMenu;
                                setConfirmConfig({
                                    isOpen: true,
                                    title: 'Remove link',
                                    message: 'The link stops working immediately. Visits already recorded through it stay.',
                                    type: 'danger',
                                    onConfirm: () => deleteLink(id),
                                });
                            }}
                            className="w-full text-left flex items-center gap-2.5 bg-transparent border-none cursor-pointer rounded-lg text-sm p-2.5 transition-colors hover:bg-dash-accent-soft"
                            style={{ color: 'var(--dash-danger)' }}>
                            <Trash2 size={15} /> Remove link
                        </button>
                    </div>
                </>,
                document.body,
            )}

            {/* link editor */}
            {editingLink && draft && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-[var(--scrim)] animate-fade-in"
                    onClick={() => { setEditingLink(null); setDraft(null); }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.97, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="glass-panel w-full max-w-[560px] overflow-hidden shadow-2xl flex flex-col"
                        style={{ maxHeight: '88vh' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="px-7 py-5 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--dash-border)' }}>
                            <div className="flex flex-col min-w-0">
                                <h2 className="heading-sm m-0 truncate">{editingLink.Name}</h2>
                                <span className="text-[11px]" style={{ color: 'var(--dash-text-3)' }}>What this link does differently</span>
                            </div>
                        </div>

                        <div className="px-7 py-6 flex flex-col gap-5 overflow-y-auto custom-scrollbar">
                            <div className="grid gap-4" style={{ gridTemplateColumns: windowWidth >= 520 ? '1fr 1fr' : '1fr' }}>
                                <div className="flex flex-col gap-2">
                                    <label className="input-label m-0" htmlFor="trails-edit-name">Who it is for</label>
                                    <input id="trails-edit-name" type="text" className="input-field" value={draft.Name}
                                        onChange={e => setDraft({ ...draft, Name: e.target.value })} />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="input-label m-0" htmlFor="trails-edit-for">What it is about</label>
                                    <input id="trails-edit-for" type="text" className="input-field" value={draft.For}
                                        onChange={e => setDraft({ ...draft, For: e.target.value })} />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="input-label m-0" htmlFor="trails-edit-greeting">Greeting on the hero</label>
                                <input id="trails-edit-greeting" type="text" className="input-field" maxLength={160}
                                    placeholder="Leave empty for the usual one"
                                    value={draft.Greeting}
                                    onChange={e => setDraft({ ...draft, Greeting: e.target.value })} />
                            </div>

                            <div className="flex flex-col gap-1">
                                {[
                                    {
                                        key: 'Notify' as const,
                                        title: 'Email me when it is opened',
                                        note: 'With a button that jumps straight to the visit.',
                                        value: draft.Notify,
                                    },
                                    {
                                        key: 'AutoCv' as const,
                                        title: 'Open the CV by itself',
                                        note: 'Pops once the hero finishes, for people here to read it.',
                                        value: draft.AutoCv,
                                    },
                                ].map(row => (
                                    <div key={row.key} className="flex items-center gap-4 py-3" style={{ borderBottom: '1px solid var(--dash-border)' }}>
                                        <div className="flex flex-col flex-1 min-w-0">
                                            <span className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>{row.title}</span>
                                            <span className="text-[11px]" style={{ color: 'var(--dash-text-3)' }}>{row.note}</span>
                                        </div>
                                        <Toggle
                                            checked={row.value}
                                            onChange={next => setDraft({ ...draft, [row.key]: next })}
                                            aria-label={row.title}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-col gap-2.5">
                                <span className="input-label m-0">Float these projects to the top</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {rankProjects.length === 0 && (
                                        <span className="text-xs" style={{ color: 'var(--dash-text-3)' }}>No projects yet.</span>
                                    )}
                                    {rankProjects.map(p => {
                                        const on = draft.Pinned.includes(p.id);
                                        return (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => setDraft({
                                                    ...draft,
                                                    Pinned: on ? draft.Pinned.filter(x => x !== p.id) : [...draft.Pinned, p.id].slice(0, 12),
                                                })}
                                                className="px-3 h-8 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                                                style={{
                                                    background: 'var(--dash-surface-3)',
                                                    color: on ? 'var(--dash-success)' : 'var(--dash-text-3)',
                                                }}
                                            >
                                                {p.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="px-7 py-4 border-t flex items-center justify-end gap-3" style={{ borderColor: 'var(--dash-border)' }}>
                            <button onClick={() => { setEditingLink(null); setDraft(null); }} className="btn btn-secondary !px-6 !py-2.5">Cancel</button>
                            <button onClick={saveDraft} disabled={!draft.Name.trim() || !draft.For.trim()} className="btn btn-primary !px-7 !py-2.5">
                                Save
                            </button>
                        </div>
                    </motion.div>
                </div>,
                document.body,
            )}

            <MStory
                story={openStory}
                isDark={isDark}
                windowWidth={windowWidth}
                onClose={() => { setOpenStoryId(null); setPendingStory(''); }}
                onDelete={id => setConfirmConfig({
                    isOpen: true,
                    title: 'Delete this visit',
                    message: 'The story and everything in it goes. The daily totals it already contributed to stay as they are.',
                    type: 'danger',
                    onConfirm: () => deleteStory(id),
                })}
            />

            {alert?.show && (
                <Alert type={alert.type} message={alert.message} onClose={() => hideAlert()} duration={alert.duration ?? 4000} />
            )}

            <MConfirmModal
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                type={confirmConfig.type}
                onConfirm={confirmConfig.onConfirm}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
};

export default DTrails;
