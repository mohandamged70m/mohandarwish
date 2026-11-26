/* eslint-disable react/no-unescaped-entities -- ported copy uses natural-language labels */
"use client";
import { useEffect, useState } from 'react';
import { CalendarDays, Link2, RefreshCw, Unlink, ShieldCheck } from 'lucide-react';
import { httpsCallable, getFunctions } from '@/lib/dash-functions';
import app from '@/lib/dash-db';
import Alert from '@/components/dashboard-v2/ui/Alert';
import useSafeAlert from '@/hooks/useSafeAlert';
import MConfirmModal from '../ConfirmModal';
import { clearCalendarReturn, waitingCalendarReturn, type CalendarReturn } from '@/lib/calendarReturn';

interface CalendarStatus {
    connected: boolean;
    account: string | null;
    connectedAt: number | null;
    broken: boolean;
}

const RETURN_TEXT: Record<CalendarReturn, { type: 'success' | 'error'; message: string }> = {
    connected: { type: 'success', message: 'Google Calendar connected.' },
    denied: { type: 'error', message: "Connecting was cancelled on Google's page." },
    expired: { type: 'error', message: 'That connection attempt expired - try again.' },
    permissions: { type: 'error', message: "Both calendar permissions are needed - tick them on Google's page and try again." },
    failed: { type: 'error', message: "Google Calendar couldn't be connected - try again." },
};

const calendarCall = (data: { action: 'status' | 'connect' | 'disconnect' }) =>
    httpsCallable<typeof data, CalendarStatus & { url?: string }>(getFunctions(app), 'googleCalendar')(data);

/**
 * Settings > Calendar: connects the owner's Google Calendar with their own Google
 * sign-in. Bookings then make an event with a Meet link and invite the guest, and the
 * booking page greys out the times the owner is busy. The token never reaches the
 * browser: this panel only asks the `googleCalendar` callable for the status, a
 * consent link, or a disconnect.
 */
const DCalendarPanel = ({ isDark }: { isDark: boolean }) => {
    const [status, setStatus] = useState<CalendarStatus | null>(null);
    const [busy, setBusy] = useState(false);
    const [confirmOff, setConfirmOff] = useState(false);
    // How connecting went, when Google just sent the owner back here.
    const [back, setBack] = useState(waitingCalendarReturn);
    const { alert, showAlert, hideAlert } = useSafeAlert();

    useEffect(() => {
        clearCalendarReturn();
        let live = true;
        calendarCall({ action: 'status' }).then(
            (r) => { if (live) setStatus(r.data); },
            () => { if (live) showAlert({ type: 'error', message: "Couldn't read the calendar connection." }); },
        );
        return () => { live = false; };
    }, [showAlert]);

    const connect = async () => {
        setBusy(true);
        try {
            const { data } = await calendarCall({ action: 'connect' });
            if (!data.url) throw new Error('no url');
            // Same tab: Google's consent page, then back to the dashboard.
            window.location.assign(data.url);
        } catch {
            setBusy(false);
            showAlert({ type: 'error', message: "Couldn't start connecting - try again." });
        }
    };

    const disconnect = async () => {
        setConfirmOff(false);
        setBusy(true);
        try {
            setStatus((await calendarCall({ action: 'disconnect' })).data);
            showAlert({ type: 'success', message: 'Google Calendar disconnected.' });
        } catch {
            showAlert({ type: 'error', message: "Couldn't disconnect - try again." });
        } finally {
            setBusy(false);
        }
    };

    const state = !status ? 'loading' : !status.connected ? 'off' : status.broken ? 'broken' : 'on';
    const pill = {
        loading: { text: 'Checking', bg: 'var(--dash-surface-2)', fg: 'var(--dash-text-3)' },
        off: { text: 'Not connected', bg: 'var(--dash-surface-2)', fg: 'var(--dash-text-3)' },
        broken: { text: 'Needs reconnecting', bg: 'color-mix(in srgb, var(--danger) 12%, transparent)', fg: 'var(--dash-danger)' },
        on: { text: 'Connected', bg: 'var(--dash-accent-soft)', fg: 'var(--dash-success)' },
    }[state];
    const cardStyle = { border: '1px solid var(--dash-border)', background: 'var(--dash-surface-2)' } as const;
    const since = status?.connectedAt
        ? new Date(status.connectedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '';

    return (
        <div className="glass-panel p-6 sm:p-8 flex flex-col gap-7 w-full">
            {alert?.show && <Alert type={alert.type} message={alert.message} onClose={hideAlert} duration={alert.duration} />}
            {back && !alert?.show && <Alert type={RETURN_TEXT[back].type} message={RETURN_TEXT[back].message} onClose={() => setBack(null)} />}

            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-4 min-w-0">
                    <span className="grid place-items-center shrink-0 rounded-sm" style={{ width: 48, height: 48, background: 'var(--dash-accent)', color: 'var(--on-primary)' }}>
                        <CalendarDays size={24} />
                    </span>
                    <div className="min-w-0">
                        <h3 className="heading-md text-lg sm:text-xl m-0">Google Calendar</h3>
                        <p className="text-dash-text-3 text-xs sm:text-sm leading-relaxed mt-1 max-w-2xl">
                            Every booking makes an event with a Google Meet link in your calendar and invites the guest.
                            Times you are busy in your calendar can't be booked on the site.
                        </p>
                    </div>
                </div>
                <span className="inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: pill.bg, color: pill.fg }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />
                    {pill.text}
                </span>
            </div>

            <div className="rounded-sm p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap" style={cardStyle}>
                <div className="min-w-0">
                    {state === 'on' || state === 'broken' ? (
                        <>
                            <div className="text-sm font-bold text-dash-text break-all">{status?.account || 'Your Google account'}</div>
                            <div className="text-dash-text-3 text-xs mt-0.5">
                                {state === 'broken'
                                    ? 'Google stopped accepting this connection. Bookings are paused until you reconnect.'
                                    : `Connected since ${since}.`}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="text-sm font-bold text-dash-text">{state === 'loading' ? 'Checking the connection' : 'Not connected'}</div>
                            <div className="text-dash-text-3 text-xs mt-0.5">Until it is, visitors can't book calls with a Meet link.</div>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {state !== 'loading' && (
                        <button
                            type="button"
                            onClick={connect}
                            disabled={busy}
                            className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-sm text-sm font-bold cursor-pointer disabled:opacity-80"
                        >
                            {state === 'off' ? <Link2 size={16} /> : <RefreshCw size={16} />}
                            {state === 'off' ? 'Connect' : 'Reconnect'}
                        </button>
                    )}
                    {(state === 'on' || state === 'broken') && (
                        <button
                            type="button"
                            onClick={() => setConfirmOff(true)}
                            disabled={busy}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm text-sm font-bold cursor-pointer transition-colors disabled:opacity-80"
                            style={{ border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)', color: 'var(--dash-danger)' }}
                        >
                            <Unlink size={16} />
                            Disconnect
                        </button>
                    )}
                </div>
            </div>

            <div className="flex items-start gap-3">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-dash-text-3" />
                <p className="text-dash-text-3 text-xs leading-relaxed m-0 max-w-2xl">
                    Google asks for two permissions only: to manage events, and to see when you are busy. The site never reads what
                    your other events are, and the booking page only learns which times are taken. The sign-in token stays on the server, encrypted.
                </p>
            </div>

            <MConfirmModal
                isOpen={confirmOff}
                title="Disconnect Google Calendar?"
                message="Visitors won't be able to book calls until you connect it again. Existing events stay in your calendar."
                confirmText="Disconnect"
                type="danger"
                onConfirm={disconnect}
                onClose={() => setConfirmOff(false)}
            />
        </div>
    );
};

export default DCalendarPanel;
