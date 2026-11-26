"use client";
import { useEffect, useMemo, useState } from 'react';
import { Plug, Copy, Check, ShieldAlert, RotateCcw, ShieldCheck, Power, Sparkles, Bot, Activity, Pencil, Eye, X } from 'lucide-react';
import { doc, onSnapshot, setDoc, collection, query, orderBy, limit } from '@/lib/dash-db';
import { db } from '@/lib/dash-db';
import Alert from '@/components/dashboard-v2/ui/Alert';
import useSafeAlert from '@/hooks/useSafeAlert';
import MConfirmModal from '../ConfirmModal';

interface McpConfig {
    enabled: boolean;
    writesEnabled: boolean;
    // In-dashboard "Spark" copilot orb. Separate from the MCP server; when false the
    // Dashboard skips mounting the Assistant entirely. Defaults on.
    assistantEnabled: boolean;
    url: string;
    revokedBefore?: number;
}

interface AuditEntry {
    id: string;
    tool: string;
    write: boolean;
    ok: boolean;
    error?: string;
    args?: Record<string, unknown>;
    at: number;
    iat?: number;
}

/** "3m ago" / "2h ago" / date for older. */
function timeAgo(ms: number): string {
    const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// The MCP server's vanity URL - shown by default so the field is never empty.
const DEFAULT_URL = '';

/**
 * Settings panel for the remote MCP server (agentic portfolio access). Reads/writes
 * the Settings/MCP config doc directly - the OAuth + protocol live in the `mcp`
 * Cloud Function; this panel only flips switches the function reads each request.
 */
const DMcpPanel = ({ isDark }: { isDark: boolean }) => {
    const [cfg, setCfg] = useState<McpConfig>({ enabled: true, writesEnabled: false, assistantEnabled: true, url: '' });
    const [copied, setCopied] = useState(false);
    const [audit, setAudit] = useState<AuditEntry[]>([]);
    const [writesOnly, setWritesOnly] = useState(false);
    const [confirmRevoke, setConfirmRevoke] = useState(false);
    const { alert, showAlert, hideAlert } = useSafeAlert();

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'Settings', 'MCP'), (snap) => {
            const d = (snap.exists() ? snap.data() : {}) as Partial<McpConfig>;
            const next: McpConfig = {
                enabled: d.enabled !== false,
                writesEnabled: d.writesEnabled === true,
                assistantEnabled: d.assistantEnabled !== false,
                url: d.url || '',
                revokedBefore: d.revokedBefore || 0,
            };
            setCfg(next);
        }, () => { /* admin-only; ignore */ });
        return () => unsub();
    }, []);

    // Live audit trail of every tool call the connected AI made (newest first).
    useEffect(() => {
        const q = query(collection(db, 'McpAudit'), orderBy('at', 'desc'), limit(120));
        const unsub = onSnapshot(q, (snap) => {
            setAudit(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditEntry, 'id'>) })));
        }, () => { /* admin-only; ignore */ });
        return () => unsub();
    }, []);

    const visibleAudit = useMemo(
        () => (writesOnly ? audit.filter((a) => a.write) : audit),
        [audit, writesOnly],
    );

    const effectiveUrl = cfg.url || DEFAULT_URL;

    const patch = async (data: Partial<McpConfig>, okMsg?: string) => {
        try {
            await setDoc(doc(db, 'Settings', 'MCP'), data, { merge: true });
            if (okMsg) showAlert({ type: 'success', message: okMsg });
        } catch {
            showAlert({ type: 'error', message: 'Failed to save - are you signed in as admin?' });
        }
    };

    const copyUrl = async () => {
        try {
            await navigator.clipboard.writeText(effectiveUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard blocked */ }
    };

    const toggle = (on: boolean, onClick: () => void, label: string) => (
        <button
            type="button"
            onClick={onClick}
            role="switch"
            aria-checked={on}
            aria-label={label}
            className="relative shrink-0 rounded-full transition-colors"
            style={{ width: 46, height: 28, background: 'var(--dash-surface-3)' }}
        >
            <span className="absolute top-[3px] rounded-full bg-dash-surface shadow-sm transition-all" style={{ width: 22, height: 22, left: on ? 21 : 3 }} />
        </button>
    );

    const card = 'rounded-sm p-4 sm:p-5 flex items-center justify-between gap-4';
    const cardStyle = { border: '1px solid var(--dash-border)', background: 'var(--dash-surface-2)' } as const;

    return (<>
        <div className="glass-panel p-6 sm:p-8 flex flex-col gap-7 w-full">
            {alert?.show && <Alert type={alert.type} message={alert.message} onClose={hideAlert} duration={alert.duration} />}

            {/* Header + status */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-4 min-w-0">
                    <span className="grid place-items-center shrink-0 rounded-sm" style={{ width: 48, height: 48, background: 'var(--dash-accent)', color: 'var(--on-primary)' }}>
                        <Plug size={24} />
                    </span>
                    <div className="min-w-0">
                        <h3 className="heading-md text-lg sm:text-xl m-0">MCP - Agentic Access</h3>
                        <p className="text-dash-text-3 text-xs sm:text-sm leading-relaxed mt-1 max-w-2xl">
                            Connect an AI client (e.g. Claude) over OAuth so it can read and manage your portfolio -
                            bookings, messages, treasury and projects - without opening the dashboard.
                        </p>
                    </div>
                </div>
                <span
                    className="inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-xs font-bold"
                    style={cfg.enabled
                        ? { background: 'var(--dash-accent-soft)', color: 'var(--dash-success)' }
                        : { background: 'var(--dash-surface-2)', color: 'var(--dash-text-3)' }}
                >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />
                    {cfg.enabled ? 'Active' : 'Disabled'}
                </span>
            </div>

            {/* Server URL */}
            <div className="flex flex-col gap-2">
                <label className="dashboard-label">Server URL</label>
                <div className="flex items-stretch gap-2">
                    <input
                        className="dashboard-input flex-1 min-w-0 font-heading text-sm cursor-default select-all"
                        spellCheck={false}
                        value={effectiveUrl}
                        readOnly
                        aria-label="MCP server URL"
                    />
                    <button
                        type="button"
                        onClick={copyUrl}
                        aria-label={copied ? 'Copied' : 'Copy server URL'}
                        title={copied ? 'Copied' : 'Copy server URL'}
                        className="btn-primary shrink-0 inline-flex items-center justify-center gap-2 px-4 rounded-sm text-sm font-bold cursor-pointer"
                    >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                </div>
                <p className="text-dash-text-3 text-xs leading-relaxed">
                    In Claude: <strong>Settings → Connectors → Add custom connector</strong>, paste this URL, then sign in with your admin Google account.
                </p>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className={card} style={cardStyle}>
                    <div className="flex items-start gap-3 min-w-0">
                        <Power size={18} className="mt-0.5 shrink-0" style={{ color: cfg.enabled ? 'var(--accent)' : 'var(--dash-text-3)' }} />
                        <div className="min-w-0">
                            <div className="text-sm font-bold text-dash-text">Enable MCP server</div>
                            <div className="text-dash-text-3 text-xs mt-0.5">When off, all connected clients are refused.</div>
                        </div>
                    </div>
                    {toggle(cfg.enabled, () => patch({ enabled: !cfg.enabled }), 'Enable MCP server')}
                </div>

                <div className={card} style={cardStyle}>
                    <div className="flex items-start gap-3 min-w-0">
                        {cfg.writesEnabled
                            ? <ShieldAlert size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--dash-warning)' }} />
                            : <ShieldCheck size={18} className="mt-0.5 shrink-0 text-dash-text-3" />}
                        <div className="min-w-0">
                            <div className="text-sm font-bold text-dash-text">Allow writes</div>
                            <div className="text-dash-text-3 text-xs mt-0.5">Lets the AI add / edit / delete. Reads always work.</div>
                        </div>
                    </div>
                    {toggle(cfg.writesEnabled, () => patch({ writesEnabled: !cfg.writesEnabled }), 'Allow writes')}
                </div>
            </div>

            {/* Revoke */}
            <div className="flex items-center justify-between gap-4 flex-wrap pt-5" style={{ borderTop: '1px solid var(--dash-border)' }}>
                <div>
                    <div className="text-sm font-bold text-dash-text">Revoke all access</div>
                    <div className="text-dash-text-3 text-xs mt-0.5">Invalidates every issued token. The client must sign in again.</div>
                </div>
                <button
                    type="button"
                    onClick={() => setConfirmRevoke(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm text-sm font-bold cursor-pointer transition-colors"
                    style={{ border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)', color: 'var(--dash-danger)' }}
                >
                    <RotateCcw size={16} />
                    Revoke
                </button>
            </div>

            {/* Activity log - every tool call the connected AI made. */}
            <div className="flex flex-col gap-4 pt-6" style={{ borderTop: '1px solid var(--dash-border)' }}>
                <div className="flex items-start gap-4 min-w-0">
                    <span className="grid place-items-center shrink-0 rounded-sm" style={{ width: 48, height: 48, background: 'var(--dash-accent)', color: 'var(--dash-accent-text)' }}>
                        <Activity size={24} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h3 className="heading-md text-lg sm:text-xl m-0">Activity log</h3>
                        <p className="text-dash-text-3 text-xs sm:text-sm leading-relaxed mt-1 max-w-2xl">
                            Every tool call the connected AI makes, newest first - what it read, what it changed, and whether it worked. The clock check is skipped.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setWritesOnly((v) => !v)}
                        className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-bold cursor-pointer transition-colors"
                        style={{ border: '1px solid var(--dash-border)', color: writesOnly ? 'var(--dash-accent)' : 'var(--dash-text-3)' }}
                    >
                        {writesOnly ? <Pencil size={14} /> : <Activity size={14} />}
                        {writesOnly ? 'Writes only' : 'All calls'}
                    </button>
                </div>

                <div className="flex flex-col gap-1.5 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                    {visibleAudit.length === 0 && (
                        <div className="text-dash-text-3 text-sm py-6 text-center">
                            No recorded activity yet. Tool calls will appear here as the AI uses the server.
                        </div>
                    )}
                    {visibleAudit.map((a) => {
                        const argEntries = Object.entries(a.args || {});
                        return (
                            <div key={a.id} className="rounded-sm px-3 py-2.5" style={cardStyle}>
                                <div className="flex items-start gap-3 min-w-0 w-full">
                                    <span
                                        className="grid place-items-center shrink-0 rounded-lg mt-0.5"
                                        style={{
                                            width: 30, height: 30,
                                            background: a.write ? 'var(--warning-soft)' : 'var(--dash-surface-3)',
                                            color: a.write ? 'var(--warning)' : 'var(--dash-text-3)',
                                        }}
                                        title={a.write ? 'Write' : 'Read'}
                                    >
                                        {a.write ? <Pencil size={14} /> : <Eye size={14} />}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-bold text-dash-text font-heading">{a.tool}</span>
                                            <span
                                                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                                                style={a.ok
                                                    ? { background: 'var(--success-soft)', color: 'var(--success)' }
                                                    : { background: 'color-mix(in srgb, var(--danger) 14%, transparent)', color: 'var(--dash-danger)' }}
                                            >
                                                {a.ok ? <Check size={10} /> : <X size={10} />}{a.ok ? 'ok' : 'error'}
                                            </span>
                                            <span className="text-dash-text-3 text-[11px] ml-auto shrink-0">{timeAgo(a.at)}</span>
                                        </div>
                                        {argEntries.length > 0 && (
                                            <div className="text-dash-text-3 text-xs mt-1 leading-relaxed break-words">
                                                {argEntries.map(([k, v], i) => (
                                                    <span key={k}>
                                                        {i > 0 && <span className="opacity-40"> · </span>}
                                                        <span className="opacity-60">{k}:</span> {String(v)}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {!a.ok && a.error && (
                                            <div className="text-xs mt-1 break-words" style={{ color: 'var(--dash-danger)' }}>{a.error}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Dashboard AI assistant (Spark) - the in-dashboard copilot orb. This is a
                SEPARATE feature from the MCP server above: turning it off just removes
                the orb from this dashboard (it does not affect external MCP clients). */}
            <div className="flex flex-col gap-4 pt-6" style={{ borderTop: '1px solid var(--dash-border)' }}>
                <div className="flex items-start gap-4 min-w-0">
                    <span className="grid place-items-center shrink-0 rounded-sm" style={{ width: 48, height: 48, background: 'var(--dash-accent-soft)', color: 'var(--dash-accent-text)' }}>
                        <Sparkles size={24} />
                    </span>
                    <div className="min-w-0">
                        <h3 className="heading-md text-lg sm:text-xl m-0">Dashboard AI assistant</h3>
                        <p className="text-dash-text-3 text-xs sm:text-sm leading-relaxed mt-1 max-w-2xl">
                            “Spark”, the floating copilot orb inside this dashboard. Independent of the MCP server above -
                            this switch only controls the in-app assistant.
                        </p>
                    </div>
                </div>
                <div className={card} style={cardStyle}>
                    <div className="flex items-start gap-3 min-w-0">
                        <Bot size={18} className="mt-0.5 shrink-0" style={{ color: cfg.assistantEnabled ? 'var(--dash-accent)' : 'var(--dash-text-3)' }} />
                        <div className="min-w-0">
                            <div className="text-sm font-bold text-dash-text">Show the assistant</div>
                            <div className="text-dash-text-3 text-xs mt-0.5">When off, the Spark orb is removed from the dashboard.</div>
                        </div>
                    </div>
                    {toggle(
                        cfg.assistantEnabled,
                        () => patch({ assistantEnabled: !cfg.assistantEnabled }, cfg.assistantEnabled ? 'Assistant hidden' : 'Assistant enabled'),
                        'Show the dashboard assistant',
                    )}
                </div>
            </div>
        </div>
        <MConfirmModal
            isOpen={confirmRevoke}
            title="Revoke all MCP access"
            message="Every issued token is invalidated immediately. Connected clients must sign in again."
            type="danger"
            confirmText="Revoke all access"
            onConfirm={() => { setConfirmRevoke(false); void patch({ revokedBefore: Date.now() }, 'All MCP access revoked'); }}
            onClose={() => setConfirmRevoke(false)}
        />
    </>);
};

export default DMcpPanel;
