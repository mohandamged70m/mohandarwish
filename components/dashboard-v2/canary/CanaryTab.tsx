"use client";
import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'motion/react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Edit2, X, Check, Plus, Trash2, Mail, Phone, FileText, ExternalLink, Video, ImageIcon, Paperclip, MoreVertical, Reply, Tags, BookOpen } from 'lucide-react';
import { collection, deleteDoc, doc, onSnapshot, updateDoc, deleteField, setDoc, writeBatch } from '@/lib/dash-db';
import { httpsCallable, getFunctions } from '@/lib/dash-functions';
import app, { db } from '@/lib/dash-db';
import { AvailabilityConfig, DEFAULT_AVAILABILITY, WEEKDAY_LABELS, ALL_HOURS, parseAvailabilityConfig, buildHostSlots, formatHourSlot } from '@/lib/availability';
import { MeetingCategory, PERSONAL_CATEGORY, CATEGORY_COLORS, MAX_CATEGORY_NAME, categoryKey, parseCategories, findCategory } from '@/lib/categories';
// Local Functions handle (lazy Dashboard chunk) - keeps firebase/functions out of eager.
const functions = getFunctions(app);

import Alert from '@/components/dashboard-v2/ui/Alert';
import useSafeAlert from '@/hooks/useSafeAlert';
import MConfirmModal from '../ConfirmModal';
import BookPageEditor from './BookPageEditor';
import MContact from '@/components/dashboard/M-Contact';
import MReply from './Reply';
import CustomTimePicker from '@/components/dashboard-v2/ui/CustomTimePicker';
import Select from '@/components/dashboard-v2/ui/Select';
import LoadingCurtain from '@/components/dashboard-v2/ui/LoadingCurtain';
import useTheme from '@/hooks/useTheme';
import useMediaQuery from '@/hooks/useMediaQuery';
import { BELOW_LG_QUERY } from '../breakpoints';
import { EASE } from '../motion';
import { hostZone, isoInstant, zoneRecord, type HostZone } from '@/lib/bookingRules';
import { COLLECTIONS } from '@/lib/collections';
import { meetingStart, slotOnHostClock, slotOccupied, cancelRequest, calendarErrorText } from './meetings';
import MailFailures from './MailFailures';
import { ViaBadge, ColorSwatches, CategoryBadge } from './Badges';
import './canary.css';

type OptionsTab = 'hours' | 'categories' | 'book';
const OPTIONS_TABS: { key: OptionsTab; label: string; icon: typeof Clock }[] = [
    { key: 'hours', label: 'Working hours', icon: Clock },
    { key: 'categories', label: 'Categories', icon: Tags },
    { key: 'book', label: 'Book page', icon: BookOpen },
];

interface Attachment {
    name: string;
    url: string;
}

interface Meeting {
    id: string;
    title: string;
    /** "hh:mm AM/PM" on the owner's clock, worked out from `startMs` for display. */
    time: string;
    /** The owner's calendar day, as a local Date at midnight. */
    date: Date;
    /** When it starts: the stored UTC instant. */
    startMs: number;
    email?: string;
    link?: string;
    reason?: string;
    userTimezone?: number;
    googleEventId?: string;
    /** Category id. Absent = Personal, which is where every guest booking lands. */
    category?: string;
    /** Where a guest booked it: the /book page or the contact modal. Absent = older, or added here. */
    via?: 'book' | 'contact';
}

interface Email {
    id: string;
    name: string;
    email: string;
    message: string;
    number: string;
    whatsapp: boolean;
    timestamp: number;
    attachments: Attachment[];
    repliedAt?: number;
}

/** A CanaryMeetings document. */
interface MeetingData {
    Name?: string;
    /** UTC ISO instant. */
    start?: string;
    Email?: string;
    MeetingLink?: string;
    "What For"?: string;
    UserTimezone?: number;
    GoogleEventId?: string;
    Category?: string;
    Via?: string;
}

/** A CanaryMessages document. */
interface EmailData {
    Name: string;
    Email: string;
    Message: string;
    Number: string;
    Whatsapp: boolean;
    Timestamp: number;
    "Files Attached"?: Attachment[];
    RepliedAt?: number;
}

const TIME_OPTIONS = [
    "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
    "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"
];

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

// Section switch: the section slides in the way the owner moved (custom = direction) and
// its panels follow a beat apart. Calm, as the old anime timeline was.
const SECTION_VARIANTS: Variants = {
    hidden: (d: number) => ({ opacity: 0, x: d * 50 }),
    shown: { opacity: 1, x: 0, transition: { duration: 0.3, ease: EASE.outExpo, delayChildren: 0.02, staggerChildren: 0.03 } },
    gone: (d: number) => ({ opacity: 0, x: -d * 30, transition: { duration: 0.15, ease: EASE.inQuad } }),
};
const PANEL_VARIANTS: Variants = {
    hidden: { opacity: 0, y: 20, scale: 0.99 },
    shown: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: EASE.outExpo } },
};

// True when `d` falls on a day that has already passed (midnight-to-midnight, local).
// Rescheduling into one is allowed here - a session can genuinely be logged after the
// fact - but it goes through a confirmation first, since it is never what a misclick
// on the month arrows was meant to do.
const isPastDay = (d: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    return day < today;
};

const DCanary = () => {
    // Everything below that animates layout falls back to an instant change here.
    const reduceMotion = useReducedMotion();
    // Options tab: which section the floating bar at the bottom has picked.
    const [optionsTab, setOptionsTab] = useState<OptionsTab>('hours');
    const [optionsDir, setOptionsDir] = useState(0);
    const switchOptionsTab = (key: OptionsTab) => {
        if (key === optionsTab) return;
        const idx = (k: OptionsTab) => OPTIONS_TABS.findIndex(t => t.key === k);
        setOptionsDir(idx(key) > idx(optionsTab) ? 1 : -1);
        setOptionsTab(key);
    };
    const isDark = useTheme();
    const [viewDate, setViewDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [direction, setDirection] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
    const [viewingMeeting, setViewingMeeting] = useState<Meeting | null>(null);
    const [isBookingOpen, setIsBookingOpen] = useState(false);
    const [modalDirection, setModalDirection] = useState(0);
    const [modalViewDate, setModalViewDate] = useState(new Date());
    const belowLg = useMediaQuery(BELOW_LG_QUERY);
    const narrow = useMediaQuery('(max-width: 419px)');
    const wideModal = useMediaQuery('(min-width: 820px)');
    const [meetingDocs, setMeetingDocs] = useState<Array<{ id: string; data: MeetingData }>>([]);
    // The owner's clock (an IANA zone, or a fixed offset for an older Availability doc).
    // Until Availability loads, this machine's own offset stands in.
    const [hostClock, setHostClock] = useState<HostZone>(() => -(new Date().getTimezoneOffset() / 60));
    // Each meeting's stored instant, shown on the owner's clock. A meeting without a
    // readable `start` is left out rather than shown at a made-up time.
    const meetings = useMemo(() => meetingDocs
        .map(({ id, data: m }): Meeting | null => {
            const slot = slotOnHostClock(m.start, hostClock);
            if (!slot) return null;
            return {
                id,
                title: m.Name || 'Untitled Session',
                time: slot.time,
                date: slot.date,
                startMs: slot.startMs,
                email: m.Email,
                link: m.MeetingLink,
                reason: m["What For"],
                userTimezone: m.UserTimezone || -(new Date().getTimezoneOffset() / 60),
                googleEventId: m.GoogleEventId,
                category: typeof m.Category === 'string' ? m.Category : undefined,
                via: m.Via === 'book' || m.Via === 'contact' ? m.Via : undefined
            };
        })
        .filter((m): m is Meeting => m !== null)
        .sort((a, b) => a.startMs - b.startMs), [meetingDocs, hostClock]);
    const { alert, showAlert, hideAlert } = useSafeAlert(4000);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    // Owner-defined meeting categories (Options tab) + the filter over the bookings
    // list. Personal is not in here - it's the built-in fallback for an unset one.
    const [categories, setCategories] = useState<MeetingCategory[]>([]);
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [newCatName, setNewCatName] = useState('');
    const [newCatColor, setNewCatColor] = useState<string>(CATEGORY_COLORS[1]);
    const [editingCatId, setEditingCatId] = useState<string | null>(null);
    const [editCatName, setEditCatName] = useState('');
    const [editCatColor, setEditCatColor] = useState<string>(CATEGORY_COLORS[1]);
    const [catBusy, setCatBusy] = useState(false);
    const [confirmDeleteCat, setConfirmDeleteCat] = useState<MeetingCategory | null>(null);
    // Set when a reschedule lands on a day that has already passed: holds the save until
    // the owner confirms it, so a stray click on a past day can't silently move a session.
    const [confirmPastSave, setConfirmPastSave] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

    // Section state
    const [activeSection, setActiveSection] = useState<'bookings' | 'mails' | 'hours'>('bookings');
    // Working-hours editor state (Hours tab). availDirtyRef guards the live snapshot
    // from clobbering in-progress edits before they're saved.
    const [availDraft, setAvailDraft] = useState<AvailabilityConfig>(DEFAULT_AVAILABILITY);
    const [availDirty, setAvailDirty] = useState(false);
    const availDirtyRef = useRef(false);
    const [availSaving, setAvailSaving] = useState(false);
    const [emails, setEmails] = useState<Email[]>([]);
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
    const [replyTo, setReplyTo] = useState<Email | null>(null);
    const [openOptionsId, setOpenOptionsId] = useState<string | null>(null);
    const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

    // Section switch direction: 1 slides the next section in from the right.
    const [sectionDir, setSectionDir] = useState(0);

    // Firestore Integration: one document per meeting and per message; the categories
    // stay a map on Settings/Canary.
    useEffect(() => {
        const onError = (what: string) => (err: unknown) => {
            console.warn(`[Connection] Canary ${what} sync error:`, err);
            if (!navigator.onLine) console.warn("User is offline");
        };
        const unsubMeetings = onSnapshot(collection(db, COLLECTIONS.meetings), (snap) => {
            setMeetingDocs(snap.docs.map((d) => ({ id: d.id, data: d.data() as MeetingData })));
        }, onError('meetings'));
        const unsubMessages = onSnapshot(collection(db, COLLECTIONS.messages), (snap) => {
            setEmails(snap.docs.map((d) => {
                const e = d.data() as EmailData;
                return {
                    id: d.id,
                    name: e.Name,
                    email: e.Email,
                    message: e.Message,
                    number: e.Number,
                    whatsapp: e.Whatsapp,
                    timestamp: e.Timestamp,
                    attachments: e["Files Attached"] || [],
                    repliedAt: e.RepliedAt
                };
            }).sort((a, b) => b.timestamp - a.timestamp));
        }, onError('messages'));
        const unsubCategories = onSnapshot(doc(db, 'Settings', 'Canary'), (snapshot) => {
            setCategories(parseCategories(snapshot.exists() ? snapshot.data().Categories : undefined));
        }, onError('categories'));
        return () => { unsubMeetings(); unsubMessages(); unsubCategories(); };
    }, []);

    // Track the host's timezone so reschedules reconstruct the correct UTC instant.
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'Settings', 'Availability'), (snap) => {
            const data = snap.exists() ? snap.data() : undefined;
            if (data) setHostClock(hostZone(data));
            // Load the working-days/hours config, but don't clobber unsaved edits.
            if (!availDirtyRef.current) setAvailDraft(parseAvailabilityConfig(data));
        });
        return () => unsub();
    }, []);

    const handleTabChange = (newTab: 'bookings' | 'mails' | 'hours') => {
        if (newTab === activeSection) return;
        const indices = { bookings: 0, mails: 1, hours: 2 };
        setSectionDir(indices[newTab] > indices[activeSection] ? 1 : -1);
        setActiveSection(newTab);
    };
    // Which way the sections slide; still with reduced motion, so only the fade remains.
    const sectionCustom = reduceMotion ? 0 : sectionDir;

    const calendarDays = useMemo(() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = [];
        for (let i = 0; i < firstDayOfMonth; i++) { days.push(null); }
        for (let i = 1; i <= daysInMonth; i++) { days.push(new Date(year, month, i)); }
        while (days.length < 42) { days.push(null); }
        return days;
    }, [viewDate]);

    const changeMonth = (delta: number) => {
        setDirection(delta);
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1));
    };

    const changeModalMonth = (delta: number) => {
        setModalDirection(delta);
        setModalViewDate(new Date(modalViewDate.getFullYear(), modalViewDate.getMonth() + delta, 1));
    };

    // Personal first, then the owner's own, in the order they were added.
    const allCategories = useMemo(() => [PERSONAL_CATEGORY, ...categories], [categories]);
    const categoryOf = (m: Meeting) => findCategory(categories, m.category);

    // The filter drives BOTH the calendar dots and the day list, so a filtered month
    // reads honestly. It falls back to 'all' on its own if the category it points at
    // was just deleted, rather than showing an empty calendar with no explanation.
    const activeFilter = categoryFilter !== 'all' && !allCategories.some(c => c.id === categoryFilter) ? 'all' : categoryFilter;
    const visibleMeetings = useMemo(() => (
        activeFilter === 'all'
            ? meetings
            : meetings.filter(m => (m.category || PERSONAL_CATEGORY.id) === activeFilter)
    ), [meetings, activeFilter]);

    const selectedDayMeetings = useMemo(() => {
        return visibleMeetings.filter(m => m.date.toDateString() === selectedDate.toDateString());
    }, [visibleMeetings, selectedDate]);

    const handleReschedule = (meeting: Meeting) => {
        setEditingMeeting({ ...meeting, date: new Date(meeting.date) });
        setModalViewDate(new Date(meeting.date.getFullYear(), meeting.date.getMonth(), 1));
    };

    // What the booking looked like before this edit - drives the modal's summary line
    // and keeps Save inert until something actually changed.
    const editOriginal = editingMeeting ? meetings.find(m => m.id === editingMeeting.id) : undefined;
    const editDirty = !!(editingMeeting && editOriginal && (
        editingMeeting.title !== editOriginal.title
        || editingMeeting.time !== editOriginal.time
        || editingMeeting.date.toDateString() !== editOriginal.date.toDateString()
        || (editingMeeting.category || '') !== (editOriginal.category || '')
    ));
    // The edited time is one typed into the Custom slot, not one of the fixed hours.
    const customOn = !!editingMeeting?.time && !TIME_OPTIONS.includes(editingMeeting.time);

    // The calendar event is cancelled by its exact id only. A session stored without one
    // (added before ids were kept) is never searched for by email, name or time: that
    // search could find, and cancel, someone else's event. The owner is told instead.
    const handleDelete = async (id: string, meeting?: Meeting) => {
        setIsLoading(true);
        // What happened to the calendar event, reported once the app delete is stored.
        const done: { calendar: 'cancelled' | 'failed' | 'no-id' | 'none'; why?: string } = { calendar: 'none' };
        try {
            const cancel = meeting ? cancelRequest(meeting) : null;
            if (cancel) {
                try {
                    await httpsCallable(functions, 'syncMeeting')(cancel);
                    done.calendar = 'cancelled';
                } catch (syncErr) {
                    console.error("Google Sync Delete Error:", syncErr);
                    done.calendar = 'failed';
                    done.why = calendarErrorText(syncErr);
                }
            } else if (meeting?.email) {
                done.calendar = 'no-id';
            }

            await deleteDoc(doc(db, COLLECTIONS.meetings, id));

            if (done.calendar === 'failed') {
                showAlert({ type: 'warning', message: `Session cancelled in the app, but its calendar event was not removed: ${done.why} Remove it in Google Calendar.` });
            } else if (done.calendar === 'no-id') {
                showAlert({ type: 'warning', message: 'Session cancelled in the app. It had no linked calendar event, so remove any event for it in Google Calendar.' });
            } else {
                showAlert({ type: 'success', message: 'Session cancelled successfully' });
            }
        } catch (error) {
            console.error(error);
            showAlert({
                type: 'error',
                message: done.calendar === 'cancelled'
                    ? 'The calendar event was removed, but the session could not be deleted from the app. Try again.'
                    : 'Failed to cancel session',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveMeeting = async (pastConfirmed = false) => {
        if (!editingMeeting) return;

        const originalMeeting = meetings.find(m => m.id === editingMeeting.id);
        if (!originalMeeting) return;

        const isTimeChanged = editingMeeting.time !== originalMeeting.time;
        const isDateChanged = editingMeeting.date.toDateString() !== originalMeeting.date.toDateString();
        const isTitleChanged = editingMeeting.title !== originalMeeting.title;
        const isCategoryChanged = (editingMeeting.category || '') !== (originalMeeting.category || '');

        if (!isTimeChanged && !isDateChanged && !isTitleChanged && !isCategoryChanged) {
            setEditingMeeting(null);
            return;
        }

        if (isTimeChanged || isDateChanged) {
            if (slotOccupied(editingMeeting, meetings, hostClock)) {
                showAlert({ type: 'warning', message: 'This time slot is already occupied.' });
                return;
            }

            // Moving the session onto a day that is already over: legitimate (recording a
            // call that happened, fixing a wrong date) but always deliberate, so ask once.
            // Confirming re-enters here with pastConfirmed and falls straight through.
            if (!pastConfirmed && isPastDay(editingMeeting.date)) {
                setConfirmPastSave(true);
                return;
            }
        }

        setIsLoading(true);
        try {
            // editingMeeting.time is the HOST's wall clock; meetingStart turns it into the
            // UTC instant the same way the public booking rules do.
            const startMs = meetingStart(editingMeeting, hostClock);
            if (startMs === null) {
                showAlert({ type: 'error', message: `"${editingMeeting.time}" is not a time this can read.` });
                return;
            }
            const start = new Date(startMs);
            const end = new Date(startMs + 3600000);

            // Only a session with a linked event is moved in the calendar. One without an
            // id is updated in the app alone: finding its event by search could move or
            // cancel the wrong one.
            const calendarChanged = isTimeChanged || isDateChanged || isTitleChanged;
            const unlinked = !!editingMeeting.email && !editingMeeting.googleEventId && calendarChanged;
            if (editingMeeting.email && editingMeeting.googleEventId && calendarChanged) {
                try {
                    await httpsCallable(functions, 'syncMeeting')({
                        action: 'update',
                        eventId: editingMeeting.googleEventId,
                        name: editingMeeting.title,
                        email: editingMeeting.email,
                        reason: editingMeeting.reason || '',
                        startTime: start.toISOString(),
                        endTime: end.toISOString()
                    });
                } catch (syncErr) {
                    // Nothing was changed yet, so the session simply stays where it was.
                    console.error('Google Sync Update Error:', syncErr);
                    showAlert({ type: 'error', message: `Session not moved: ${calendarErrorText(syncErr)}` });
                    return;
                }
            }

            // The new start is stored as an instant, with the clock it was picked on.
            const updatePayload: Record<string, unknown> = { Name: editingMeeting.title };
            if (isTimeChanged || isDateChanged) Object.assign(updatePayload, { start: isoInstant(startMs), ...zoneRecord(hostClock) });

            // Personal is the absence of a category, so picking it deletes the field
            // rather than storing the sentinel id - keeps one representation, not two.
            if (isCategoryChanged) {
                updatePayload.Category = editingMeeting.category ?? deleteField();
            }

            await updateDoc(doc(db, COLLECTIONS.meetings, editingMeeting.id), updatePayload);

            setEditingMeeting(null);
            showAlert(unlinked
                ? { type: 'warning', message: 'Session updated in the app. It has no linked calendar event, so change any event for it in Google Calendar by hand.' }
                : { type: 'success', message: 'Session rescheduled successfully' });
        } catch (error) {
            console.error(error);
            showAlert({ type: 'error', message: 'Failed to update session' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteEmail = async (emailId: string) => {
        setConfirmDelete(null);
        setOpenOptionsId(null);
        try {
            await deleteDoc(doc(db, COLLECTIONS.messages, emailId));
            if (selectedEmail?.id === emailId) {
                setSelectedEmail(null);
            }
            showAlert({ type: 'success', message: 'Email deleted successfully' });
        } catch (error) {
            console.error("Error deleting email:", error);
            showAlert({ type: 'error', message: 'Failed to delete email' });
        }
    };

    const handleReplyEmail = (email: Email) => {
        setReplyTo(email);
        setOpenOptionsId(null);
    };

    // Mark a message replied after a reply is sent (CanaryMessages is admin-writable).
    const markReplied = async (emailId: string) => {
        const at = Date.now();
        try {
            await updateDoc(doc(db, COLLECTIONS.messages, emailId), { RepliedAt: at });
        } catch (error) {
            console.error('Failed to mark message replied:', error);
        }
        setEmails(prev => prev.map(e => e.id === emailId ? { ...e, repliedAt: at } : e));
        setSelectedEmail(prev => prev && prev.id === emailId ? { ...prev, repliedAt: at } : prev);
    };

    const handleAddNew = () => {
        setIsBookingOpen(true);
    };

    const modalCalendarDays = useMemo(() => {
        const year = modalViewDate.getFullYear();
        const month = modalViewDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = [];
        for (let i = 0; i < firstDayOfMonth; i++) { days.push(null); }
        for (let i = 1; i <= daysInMonth; i++) { days.push(new Date(year, month, i)); }
        while (days.length < 42) { days.push(null); }
        return days;
    }, [modalViewDate]);

    const variants = {
        enter: (d: number) => ({ x: d > 0 ? '50%' : '-50%', opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (d: number) => ({ x: d > 0 ? '-50%' : '50%', opacity: 0 })
    };

    const containerBg = 'var(--dash-surface-2)';

    const renderAttachmentCard = (file: Attachment) => {
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
        const isVideo = /\.(mp4|webm|ogg)$/i.test(file.name);

        return (
            <button
                key={file.url}
                onClick={() => setPreviewAttachment(file)}
                className="group relative flex items-center gap-3 px-3 py-3 rounded-sm border transition-all hover:scale-[1.02] active:scale-[0.98] text-left overflow-hidden min-w-[200px]"
                style={{
                    backgroundColor: 'var(--dash-surface-2)',
                    borderColor: 'var(--dash-border)'
                }}
            >
                <div className="w-8 h-8 rounded-sm bg-dash-accent/10 flex items-center justify-center shrink-0 text-dash-accent-text">
                    {isImage ? <ImageIcon size={16} /> : isVideo ? <Video size={16} /> : <FileText size={16} />}
                </div>

                <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                    <span className="text-xs font-bold truncate w-full" style={{ color: 'var(--dash-text)' }}>{file.name}</span>
                    <span className="text-xs opacity-80 uppercase tracking-wider font-bold">
                        {isImage ? 'Image' : isVideo ? 'Video' : 'Document'}
                    </span>
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink size={14} className="opacity-80" />
                </div>
            </button>
        );
    };

    // ── Working-hours editor (Hours tab) ──────────────────────────────
    const patchAvail = (patch: Partial<AvailabilityConfig>) => {
        availDirtyRef.current = true;
        setAvailDirty(true);
        setAvailDraft(prev => ({ ...prev, ...patch }));
    };
    const toggleWorkDay = (d: number) => {
        const has = availDraft.workingDays.includes(d);
        patchAvail({
            workingDays: has
                ? availDraft.workingDays.filter(x => x !== d)
                : [...availDraft.workingDays, d].sort((a, b) => a - b),
        });
    };
    const toggleHour = (h: number) => {
        const has = availDraft.hours.includes(h);
        patchAvail({
            hours: has
                ? availDraft.hours.filter(x => x !== h)
                : [...availDraft.hours, h].sort((a, b) => a - b),
        });
    };
    const saveAvailability = async () => {
        setAvailSaving(true);
        try {
            await setDoc(doc(db, 'Settings', 'Availability'), {
                workingDays: availDraft.workingDays,
                hours: availDraft.hours,
            }, { merge: true });
            availDirtyRef.current = false;
            setAvailDirty(false);
            showAlert({ type: 'success', message: 'Working hours saved' });
        } catch {
            showAlert({ type: 'error', message: 'Failed to save - are you signed in as admin?' });
        } finally {
            setAvailSaving(false);
        }
    };
    const previewSlots = buildHostSlots(availDraft);

    // ── Categories ────────────────────────────────────────────────────────
    // Written straight through on every add/rename/delete rather than batched behind
    // a Save: they're independent of the working-hours draft above, and a half-typed
    // category is never something you want held hostage by an unsaved hours edit.
    const canaryRef = () => doc(db, 'Settings', 'Canary');

    /** Shared by every category row so the renamed one and its neighbours move together. */
    const rowLayoutTransition = reduceMotion
        ? { duration: 0 }
        : { layout: { type: 'spring' as const, stiffness: 460, damping: 40, mass: 0.8 } };

    /** Rejects blanks, over-long names, and anything colliding with an existing name. */
    const validateCatName = (name: string, ignoreId?: string): string | null => {
        const trimmed = name.trim();
        if (!trimmed) return 'Give the category a name first.';
        if (trimmed.length > MAX_CATEGORY_NAME) return `Keep it under ${MAX_CATEGORY_NAME} characters.`;
        const key = categoryKey(trimmed);
        if (key === categoryKey(PERSONAL_CATEGORY.name)) return 'Personal is the built-in category - pick another name.';
        if (categories.some(c => c.id !== ignoreId && categoryKey(c.name) === key)) return 'You already have a category with that name.';
        return null;
    };

    const addCategory = async () => {
        const problem = validateCatName(newCatName);
        if (problem) { showAlert({ type: 'warning', message: problem }); return; }
        setCatBusy(true);
        try {
            const id = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            await updateDoc(canaryRef(), {
                [`Categories.${id}`]: { Name: newCatName.trim(), Color: newCatColor, Created: Date.now() },
            });
            setNewCatName('');
            showAlert({ type: 'success', message: 'Category added' });
        } catch {
            showAlert({ type: 'error', message: 'Failed to add the category - are you signed in as admin?' });
        } finally {
            setCatBusy(false);
        }
    };

    const startEditCategory = (cat: MeetingCategory) => {
        setEditingCatId(cat.id);
        setEditCatName(cat.name);
        setEditCatColor(cat.color);
    };

    const saveCategoryEdit = async () => {
        if (!editingCatId) return;
        const problem = validateCatName(editCatName, editingCatId);
        if (problem) { showAlert({ type: 'warning', message: problem }); return; }
        setCatBusy(true);
        try {
            await updateDoc(canaryRef(), {
                [`Categories.${editingCatId}.Name`]: editCatName.trim(),
                [`Categories.${editingCatId}.Color`]: editCatColor,
            });
            setEditingCatId(null);
            showAlert({ type: 'success', message: 'Category updated' });
        } catch {
            showAlert({ type: 'error', message: 'Failed to update the category' });
        } finally {
            setCatBusy(false);
        }
    };

    /** Deleting a category also clears it off its bookings, which drop back to Personal. */
    const deleteCategory = async (cat: MeetingCategory) => {
        setCatBusy(true);
        try {
            // One batch: the category and its use on every booking go together. A booking
            // whose start can't be read still counts, so it is never left in a dead bucket.
            const batch = writeBatch(db);
            batch.update(canaryRef(), { [`Categories.${cat.id}`]: deleteField() });
            meetingDocs.filter(m => m.data.Category === cat.id).forEach(m => {
                batch.update(doc(db, COLLECTIONS.meetings, m.id), { Category: deleteField() });
            });
            await batch.commit();
            if (editingCatId === cat.id) setEditingCatId(null);
            if (categoryFilter === cat.id) setCategoryFilter('all');
            showAlert({ type: 'success', message: 'Category deleted' });
        } catch {
            showAlert({ type: 'error', message: 'Failed to delete the category' });
        } finally {
            setCatBusy(false);
        }
    };

    const categoriesEditor = (
        <motion.div variants={PANEL_VARIANTS}
            className="canary-panel w-full flex flex-col gap-6 p-6 min-[460px]:p-8 rounded-sm border shadow-sm"
            style={{ backgroundColor: containerBg, borderColor: 'var(--dash-border)' }}
        >
            <div className="flex items-start gap-4">
                <span className="grid place-items-center shrink-0 rounded-sm" style={{ width: 48, height: 48, background: 'var(--dash-accent)', color: 'var(--on-primary)' }}>
                    <Tags size={24} />
                </span>
                <div>
                    <h3 className="text-lg sm:text-xl font-bold m-0" style={{ color: 'var(--dash-text)' }}>Categories</h3>
                    <p className="text-sm mt-1" style={{ color: 'var(--dash-text-3)' }}>
                        Sort bookings into buckets of your own. You set them when you edit a booking, or the assistant does over MCP - guests are never asked, so anything booked from the site arrives as Personal.
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                {/* Personal is the floor of the list, not an entry you can act on. */}
                <motion.div layout={!reduceMotion} transition={rowLayoutTransition} className="flex items-center gap-3 px-3.5 h-12 rounded-sm" style={{ background: 'var(--dash-surface-2)' }}>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PERSONAL_CATEGORY.color }} />
                    <span className="text-sm font-bold" style={{ color: 'var(--dash-text)' }}>{PERSONAL_CATEGORY.name}</span>
                    <span className="ml-auto text-xs font-bold px-2 py-1 rounded-sm shrink-0" style={{ background: 'var(--dash-surface-2)', color: 'var(--dash-text-3)' }}>
                        Default
                    </span>
                </motion.div>

                {categories.map(cat => {
                    const used = meetings.filter(m => m.category === cat.id).length;
                    const editing = editingCatId === cat.id;
                    return (
                        // One box per category that MORPHS: layout animates the row growing
                        // into the editor (and back), while the two contents cross-fade
                        // inside it - rather than one element vanishing and another
                        // appearing in its place.
                        <motion.div
                            key={cat.id}
                            layout={!reduceMotion}
                            transition={rowLayoutTransition}
                            className="rounded-sm overflow-hidden"
                            style={{
                                background: editing
                                    ? ('var(--dash-accent-text)')
                                    : ('var(--dash-border)'),
                                border: `1px solid ${editing ? 'var(--dash-accent-text)' : 'transparent'}`,
                            }}
                        >
                            <AnimatePresence mode="popLayout" initial={false}>
                                {editing ? (
                                    <motion.div
                                        key="edit"
                                        layout="position"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: reduceMotion ? 0 : 0.14 }}
                                        className="flex flex-col gap-3 p-3"
                                    >
                                        <input
                                            type="text"
                                            autoFocus
                                            value={editCatName}
                                            maxLength={MAX_CATEGORY_NAME}
                                            onChange={(e) => setEditCatName(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') saveCategoryEdit(); if (e.key === 'Escape') setEditingCatId(null); }}
                                            className="w-full h-10 rounded-sm border px-3 text-sm font-semibold outline-none focus:border-dash-accent transition-colors"
                                            style={{ backgroundColor: 'var(--dash-surface-2)', borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }}
                                        />
                                        <div className="flex items-center justify-between gap-3 flex-wrap">
                                            <ColorSwatches value={editCatColor} onPick={setEditCatColor} isDark={isDark} />
                                            <div className="flex items-center gap-1 ml-auto">
                                                <button type="button" onClick={() => setEditingCatId(null)} className="px-3 h-9 rounded-sm text-xs font-bold cursor-pointer transition-colors hover:bg-dash-surface-3 dark:hover:bg-dash-surface-3" style={{ color: 'var(--dash-text-3)' }}>Cancel</button>
                                                <button type="button" onClick={saveCategoryEdit} disabled={catBusy} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-sm text-xs font-bold cursor-pointer transition-colors disabled:opacity-50" style={{ background: 'var(--dash-accent)', color: 'var(--on-primary)' }}>
                                                    <Check size={14} /> Save
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="view"
                                        layout="position"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: reduceMotion ? 0 : 0.14 }}
                                        className="group flex items-center gap-3 px-3.5 h-12"
                                    >
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cat.color }} />
                                        <span className="text-sm font-bold truncate" style={{ color: 'var(--dash-text)' }}>{cat.name}</span>
                                        <span className="text-xs shrink-0" style={{ color: 'var(--dash-text-3)' }}>
                                            {used === 0 ? 'unused' : `${used} booking${used === 1 ? '' : 's'}`}
                                        </span>
                                        {/* Actions stay reachable by keyboard; the mouse only reveals them. */}
                                        <div className="ml-auto flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                            <button type="button" onClick={() => startEditCategory(cat)} aria-label={`Rename ${cat.name}`} className="w-8 h-8 grid place-items-center rounded-sm hover:bg-dash-surface-3 dark:hover:bg-dash-surface-3 transition-colors cursor-pointer" style={{ color: 'var(--dash-text-3)' }}>
                                                <Edit2 size={14} />
                                            </button>
                                            <button type="button" onClick={() => setConfirmDeleteCat(cat)} aria-label={`Delete ${cat.name}`} className="w-8 h-8 grid place-items-center rounded-sm hover:bg-dash-accent-soft transition-colors cursor-pointer text-dash-danger hover:text-dash-danger">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}

                {categories.length === 0 && (
                    <p className="text-sm px-1 pt-1" style={{ color: 'var(--dash-text-3)' }}>
                        No categories yet. Add one below and it becomes pickable on every booking.
                    </p>
                )}
            </div>

            {/* New category */}
            <div className="flex flex-col gap-3 pt-1">
                <label htmlFor="new-category" className="text-sm font-bold" style={{ color: 'var(--dash-text)' }}>New category</label>
                <div className="flex items-center gap-2">
                    <input
                        id="new-category"
                        type="text"
                        value={newCatName}
                        maxLength={MAX_CATEGORY_NAME}
                        placeholder="Category name"
                        onChange={(e) => setNewCatName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); }}
                        className="flex-1 min-w-0 h-11 rounded-sm border px-4 text-sm font-medium outline-none focus:border-dash-accent transition-colors"
                        style={{ backgroundColor: 'var(--dash-surface-2)', borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }}
                    />
                    <button
                        type="button"
                        onClick={addCategory}
                        disabled={catBusy || !newCatName.trim()}
                        className="inline-flex items-center justify-center gap-2 px-5 h-11 rounded-sm text-sm font-bold cursor-pointer transition-colors disabled:opacity-80 disabled:cursor-not-allowed shrink-0"
                        style={{ background: 'var(--dash-accent)', color: 'var(--on-primary)' }}
                    >
                        <Plus size={16} /> Add
                    </button>
                </div>
                <ColorSwatches value={newCatColor} onPick={setNewCatColor} isDark={isDark} />
            </div>
        </motion.div>
    );

    const hoursPanel = (
            <motion.div variants={PANEL_VARIANTS}
                className="canary-panel w-full flex flex-col gap-7 p-6 min-[460px]:p-8 rounded-sm border shadow-sm"
                style={{ backgroundColor: containerBg, borderColor: 'var(--dash-border)' }}
            >
                <div className="flex items-start gap-4">
                    <span className="grid place-items-center shrink-0 rounded-sm" style={{ width: 48, height: 48, background: 'var(--dash-accent)', color: 'var(--on-primary)' }}>
                        <Clock size={24} />
                    </span>
                    <div>
                        <h3 className="text-lg sm:text-xl font-bold m-0" style={{ color: 'var(--dash-text)' }}>Working hours &amp; days</h3>
                        <p className="text-sm mt-1 max-w-xl" style={{ color: 'var(--dash-text-3)' }}>
                            Pick exactly which days and hours guests can book - toggle any hour on or off individually, gaps in the middle included. These drive the public booking calendar; off-days and unpicked hours are hidden from guests.
                        </p>
                    </div>
                </div>

                {/* Working days */}
                <div className="flex flex-col gap-3">
                    <label className="text-sm font-bold" style={{ color: 'var(--dash-text)' }}>Working days</label>
                    <div className="flex flex-wrap gap-2">
                        {WEEKDAY_LABELS.map((label, d) => {
                            const on = availDraft.workingDays.includes(d);
                            return (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => toggleWorkDay(d)}
                                    aria-pressed={on}
                                    className="px-4 py-2 rounded-sm text-sm font-bold border transition-colors cursor-pointer"
                                    style={on
                                        ? { background: 'var(--dash-accent)', color: 'var(--on-primary)', borderColor: 'var(--dash-accent-text)' }
                                        : { background: 'transparent', color: 'var(--dash-text-3)', borderColor: 'var(--dash-border)' }}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                    {availDraft.workingDays.length === 0 && (
                        <p className="text-sm" style={{ color: 'var(--dash-danger)' }}>No working days selected - guests won&apos;t be able to book any day.</p>
                    )}
                </div>

                {/* Working hours (individually toggleable) */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                        <label className="text-sm font-bold" style={{ color: 'var(--dash-text)' }}>Working hours</label>
                        <span className="text-xs" style={{ color: 'var(--dash-text-3)' }}>{availDraft.hours.length} selected</span>
                    </div>
                    <div className="gap-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))' }}>
                        {ALL_HOURS.map(h => {
                            const on = availDraft.hours.includes(h);
                            return (
                                <button
                                    key={h}
                                    type="button"
                                    onClick={() => toggleHour(h)}
                                    aria-pressed={on}
                                    className="px-2 py-2 rounded-sm text-xs font-bold border transition-colors cursor-pointer text-center"
                                    style={on
                                        ? { background: 'var(--dash-accent)', color: 'var(--on-primary)', borderColor: 'var(--dash-accent-text)' }
                                        : { background: 'transparent', color: 'var(--dash-text-3)', borderColor: 'var(--dash-border)' }}
                                >
                                    {formatHourSlot(h)}
                                </button>
                            );
                        })}
                    </div>
                    {availDraft.hours.length === 0 && (
                        <p className="text-sm" style={{ color: 'var(--dash-danger)' }}>No hours selected - guests won&apos;t be able to book any time.</p>
                    )}
                </div>

                {/* Preview */}
                {previewSlots.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold" style={{ color: 'var(--dash-text)' }}>What guests will see</label>
                        <div className="flex flex-wrap gap-2">
                            {previewSlots.map(s => (
                                <span key={s} className="px-3 py-1.5 rounded-sm text-xs font-semibold" style={{ background: 'var(--dash-surface-2)', color: 'var(--dash-text-3)' }}>{s}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Save */}
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={saveAvailability}
                        disabled={!availDirty || availSaving}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-sm text-sm font-bold cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: 'var(--dash-accent)', color: 'var(--on-primary)' }}
                    >
                        <Check size={16} />
                        {availSaving ? 'Saving…' : 'Save hours'}
                    </button>
                </div>
            </motion.div>
    );

    // Options is split into sections instead of stacking every panel on one page; a
    // floating bar at the bottom switches between them, like the Projects sub-nav.
    // Portaled to <body>: the section slides with a transform, and a transformed ancestor
    // would pin a position:fixed bar to the section instead of the viewport.
    const optionsBar = typeof document !== 'undefined' && activeSection === 'hours' && createPortal(
        <nav aria-label="Options sections" className="canary-options-bar fixed bottom-5 left-1/2 -translate-x-1/2 z-[1100]">
            <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-1 p-1.5 rounded-sm md:gap-1.5 md:p-2 shadow-[0_4px_20px_var(--shadow-color)] dark:shadow-[0_4px_20px_var(--shadow-color)]"
                style={{ backgroundColor: 'var(--dash-surface-2)', border: '1px solid var(--dash-border)' }}
            >
                {OPTIONS_TABS.map(tab => {
                    const isActive = optionsTab === tab.key;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            aria-current={isActive ? 'page' : undefined}
                            onClick={() => switchOptionsTab(tab.key)}
                            className="relative flex items-center gap-1.5 px-3 py-2 rounded-sm text-xs font-semibold md:gap-2.5 md:px-5 md:py-2.5 md:text-sm transition-colors duration-200 cursor-pointer"
                            style={{ color: isActive ? 'var(--on-primary)' : 'var(--dash-text-3)', background: 'transparent', border: 'none' }}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="options-subnav-pill"
                                    className="absolute inset-0 rounded-sm"
                                    style={{ background: 'var(--dash-accent)', border: '1px solid var(--dash-accent)' }}
                                    transition={reduceMotion ? { duration: 0 } : { type: 'spring', damping: 28, stiffness: 380 }}
                                />
                            )}
                            <Icon strokeWidth={2.2} className="relative z-10 w-[15px] h-[15px] md:w-[18px] md:h-[18px]" />
                            <span className="relative z-10 whitespace-nowrap">{tab.label}</span>
                        </button>
                    );
                })}
            </motion.div>
        </nav>,
        document.body,
    );

    const hoursEditor = (
        // Bottom padding keeps the last panel's buttons clear of the floating bar.
        <motion.div key="hours" custom={sectionCustom} variants={SECTION_VARIANTS} initial="hidden" animate="shown" exit="gone" className="w-full pb-28">
            <AnimatePresence mode="wait" custom={optionsDir} initial={false}>
                <motion.div
                    key={optionsTab}
                    custom={optionsDir}
                    variants={{
                        enter: (d: number) => ({ x: reduceMotion ? 0 : (d > 0 ? 40 : -40), opacity: 0 }),
                        center: { x: 0, opacity: 1 },
                        exit: (d: number) => ({ x: reduceMotion ? 0 : (d > 0 ? -40 : 40), opacity: 0 }),
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    className="w-full"
                    style={{ maxWidth: optionsTab === 'book' ? undefined : 760 }}
                >
                    {optionsTab === 'hours' ? hoursPanel
                        : optionsTab === 'categories' ? categoriesEditor
                        : <BookPageEditor isDark={isDark} containerBg={containerBg} showAlert={showAlert} />}
                </motion.div>
            </AnimatePresence>
            {optionsBar}
        </motion.div>
    );

    return (
        <div className="canary-page w-full h-full flex flex-col gap-6" style={{ opacity: 1 }}>
            <LoadingCurtain open={isLoading} portal />
            {/* Header Navbar */}
            <div role="tablist" aria-label="Canary sections" className="canary-tabs flex gap-2 overflow-x-auto shrink-0 self-center min-[960px]:self-start">
                <button
                    role="tab"
                    aria-selected={activeSection === 'bookings'}
                    onClick={() => handleTabChange('bookings')}
                    className={`
                        canary-tab flex items-center gap-2 px-5 font-sans font-bold text-sm whitespace-nowrap border-none cursor-pointer
                    `}
                >
                    <CalendarIcon size={16} />
                    <span className="hidden sm:inline">Bookings</span>
                </button>
                <button
                    role="tab"
                    aria-selected={activeSection === 'mails'}
                    onClick={() => handleTabChange('mails')}
                    className="canary-tab flex items-center gap-2 px-5 font-sans font-bold text-sm whitespace-nowrap border-none cursor-pointer"
                >
                    <Mail size={16} />
                    <span className="hidden sm:inline">Mails</span>
                    {emails.length > 0 && (
                        <span className={`px-1.5 py-0.5 rounded-sm text-xs font-bold ${activeSection === 'mails' ? 'bg-dash-accent text-dash-text' : 'bg-dash-surface-3 text-dash-text-2 dark:bg-dash-surface-2 dark:text-dash-text'}`}>
                            {emails.length}
                        </span>
                    )}
                </button>
                <button
                    role="tab"
                    aria-selected={activeSection === 'hours'}
                    onClick={() => handleTabChange('hours')}
                    className="canary-tab flex items-center gap-2 px-5 font-sans font-bold text-sm whitespace-nowrap border-none cursor-pointer"
                >
                    <Clock size={16} />
                    <span className="hidden sm:inline">Options</span>
                </button>
            </div>

            {/* Mail the functions gave up on; renders nothing while all of it went out. */}
            <MailFailures isDark={isDark} showAlert={showAlert} />

            {/* A section enters only when the owner switches to it. On the tab's first
                paint it is already in place: the dashboard fades the whole tab in once, and
                a second entrance on top of that was the double animation. */}
            <AnimatePresence mode="wait" initial={false} custom={sectionCustom}>
            {activeSection === 'hours' ? hoursEditor : activeSection === 'bookings' ? (
                // alignItems is set here rather than through lg:items-stretch so the
                // bookings column always matches the calendar beside it. The calendar is
                // a fixed 6-row month, so that height never moves - which is what stops
                // the panel growing and shrinking as you step between an empty day and a
                // busy one. Inline because this file's responsive variants lose to their
                // own base class (see the grid-cols note in the modal).
                <motion.div key="bookings" custom={sectionCustom} variants={SECTION_VARIANTS} initial="hidden" animate="shown" exit="gone" className="grid grid-cols-1 lg:grid-cols-canary gap-8" style={{ alignItems: belowLg ? 'start' : 'stretch' }}>
                    {/* Left: Calendar Component */}
                    <motion.div variants={PANEL_VARIANTS} className="canary-panel canary-calendar w-full h-fit flex flex-col gap-3 p-3 md:p-4 rounded-sm border shadow-sm relative overflow-visible"
                        style={{
                            backgroundColor: containerBg,
                            borderColor: 'var(--dash-border)',
                            }}>
                        <div className="absolute top-0 right-0 w-64 h-64 bg-dash-accent/5 blur-[100px] rounded-full" />

                        {/* Integrated Navigation Inside Box */}
                        <div className="flex items-center justify-between relative z-10 mb-4">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-2xl font-bold m-0" style={{ color: 'var(--dash-text)' }}>
                                        {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
                                    </h3>

                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button onClick={() => changeMonth(-1)} className="w-8 h-8 flex items-center justify-center hover:bg-dash-surface-3 dark:hover:bg-dash-surface/5 rounded-sm transition-all border border-transparent hover:border-dash-border" style={{ color: 'var(--dash-text-2)' }}>
                                    <ChevronLeft size={16} />
                                </button>
                                <button onClick={() => changeMonth(1)} className="w-8 h-8 flex items-center justify-center hover:bg-dash-surface-3 dark:hover:bg-dash-surface/5 rounded-sm transition-all border border-transparent hover:border-dash-border" style={{ color: 'var(--dash-text-2)' }}>
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Day Headers */}
                        <div className="grid grid-cols-7 gap-1">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                                <div key={idx} className="canary-weekday text-center font-bold tracking-widest">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="relative mt-4">
                            <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                                <motion.div
                                    key={viewDate.toISOString()}
                                    custom={direction}
                                    variants={variants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    className="grid grid-cols-7 gap-1 w-full"
                                >
                                    {calendarDays.map((date, idx) => {
                                        const isSelected = date?.toDateString() === selectedDate.toDateString();
                                        const isToday = date?.toDateString() === new Date().toDateString();
                                        const dayMeetings = date ? visibleMeetings.filter(m => m.date.toDateString() === date.toDateString()) : [];

                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                aria-pressed={isSelected}
                                                aria-label={date ? date.toDateString() : 'Empty day'}
                                                disabled={!date}
                                                onClick={() => date && setSelectedDate(date)}
                                                // Slightly landscape rather than square: six rows of square cells at
                                                // this column width made the month taller than a laptop viewport, so
                                                // the whole page picked up a scrollbar and clipped the button below.
                                                // The ratio still scales with the panel, so nothing is hard-coded.
                                                style={{ aspectRatio: '1 / 0.6', minHeight: 34 }}
                                                className={`canary-day relative flex flex-col items-center justify-center gap-1
                                                ${date ? '' : 'opacity-0 pointer-events-none'}
                                            `}
                                            >
                                                {isSelected && date && (
                                                    <motion.div
                                                        layoutId="main-selected-day-bg"
                                                        initial={false}
                                                        transition={{ type: "spring", stiffness: 500, damping: 40, mass: 1 }}
                                                        style={{
                                                            position: 'absolute', inset: 0,
                                                            borderRadius: 4,
                                                            backgroundColor: 'var(--primary-soft)',
                                                            border: '1px solid var(--primary)',
                                                            boxShadow: 'var(--shadow-sm)',
                                                            zIndex: 0
                                                        }}
                                                    />
                                                )}
                                                {date && (
                                                    <>
                                                        <span className={`canary-day-number relative z-10 font-semibold ${isSelected ? 'text-dash-text' : isToday ? 'text-dash-accent-text' : ''}`} style={{ color: !isSelected && !isToday ? 'var(--dash-text)' : undefined }}>
                                                            {date.getDate()}
                                                        </span>

                                                        <div className="flex gap-0.5 md:gap-1 justify-center relative z-10">
                                                            {dayMeetings.slice(0, narrow ? 1 : 3).map((m) => (
                                                                <div
                                                                    key={m.id}
                                                                    className="canary-dot"
                                                                    style={{ backgroundColor: isSelected ? 'var(--primary)' : categoryOf(m).color }}
                                                                />
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </button>
                                        );
                                    })}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </motion.div>

                    {/* Meeting List - Right Panel */}
                    <motion.div variants={PANEL_VARIANTS} className="canary-panel flex flex-col gap-4 min-[460px]:gap-6 p-4 min-[460px]:p-8 rounded-sm border shadow-sm min-h-0"
                        style={{
                            backgroundColor: containerBg,
                            borderColor: 'var(--dash-border)',
                            }}>
                        <div className="flex flex-col gap-3">

                            <h3 className="text-2xl font-bold m-0" style={{ color: 'var(--dash-text)' }}>
                                {selectedDate.toLocaleDateString('default', { weekday: 'long', day: 'numeric', month: 'short' })}
                            </h3>

                            {/* Only worth showing once there's something to filter BY. */}
                            {categories.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {[{ id: 'all', name: 'All', color: PERSONAL_CATEGORY.color }, ...allCategories].map(c => {
                                        const on = activeFilter === c.id;
                                        return (
                                            <button
                                                key={c.id}
                                                type="button"
                                                aria-pressed={on}
                                                onClick={() => setCategoryFilter(c.id)}
                                                className="canary-filter inline-flex items-center gap-1.5 font-semibold cursor-pointer"
                                            >
                                                {c.id !== 'all' && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.color }} />}
                                                {c.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pr-2" style={{
                            scrollbarWidth: 'thin',
                            scrollbarColor: 'var(--dash-border) transparent'
                        }}>
                            {selectedDayMeetings.length > 0 ? (
                                selectedDayMeetings.map((meeting) => (
                                    <div
                                        key={meeting.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setViewingMeeting(meeting)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setViewingMeeting(meeting); } }}
                                        className="group p-4 rounded-sm border transition-all hover:translate-x-1 cursor-pointer"
                                        style={{
                                            borderColor: 'var(--dash-border)',
                                            backgroundColor: 'var(--dash-surface-2)'
                                        }}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                                                <h4 className="text-sm font-bold m-0 truncate" style={{ color: 'var(--dash-text)' }}>{meeting.title}</h4>
                                                {meeting.email && (
                                                    <div className="flex items-center gap-1.5 min-w-0" style={{ color: 'var(--dash-text-2)' }}>
                                                        <Mail size={11} className="opacity-80 shrink-0" />
                                                        <span className="text-xs truncate">{meeting.email}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 text-xs font-medium flex-wrap" style={{ color: 'var(--dash-text-2)' }}>
                                                    <div className="flex items-center gap-1.5 p-1 rounded-sm bg-dash-surface-2 dark:bg-dash-surface/5">
                                                        <Clock size={12} className="opacity-70" />
                                                        <span>{meeting.time}</span>
                                                    </div>
                                                    {meeting.link && (
                                                        <div className="flex items-center gap-1.5 p-1 rounded-sm text-dash-accent-text bg-dash-accent/10">
                                                            <Video size={12} />
                                                            <span className="font-semibold">Meet link</span>
                                                        </div>
                                                    )}
                                                    {meeting.category && <CategoryBadge cat={categoryOf(meeting)} />}
                                                    {meeting.via && <ViaBadge via={meeting.via} />}
                                                </div>
                                                <span className="text-xs opacity-80 italic font-normal line-clamp-1">{meeting.reason || 'No description'}</span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => setConfirmDelete(meeting.id)}
                                                    className="p-2 hover:bg-dash-accent-soft rounded-sm transition-all group/del"
                                                    aria-label="Delete session"
                                                >
                                                    <Trash2 size={14} className="text-dash-danger group-hover/del:text-dash-danger" />
                                                </button>
                                                <ChevronRight size={16} className="opacity-70 group-hover:opacity-70 group-hover:translate-x-0.5 transition-all" style={{ color: 'var(--dash-text-2)' }} />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="canary-empty flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                                    <CalendarIcon size={28} />
                                    <span className="text-sm font-semibold">No sessions on this day</span>
                                    <p className="text-xs m-0">Pick another date, or add a session to fill this day.</p>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleAddNew}
                            className="w-full py-3 md:py-4 rounded-sm font-bold text-dash-text text-xs md:text-sm flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                            style={{ background: 'linear-gradient(135deg, var(--dash-bg) 0%, var(--dash-surface-3) 100%)', boxShadow: '0 8px 30px var(--shadow-color)' }}
                        >
                            <Plus size={16} />
                            CREATE NEW SESSION
                        </button>
                    </motion.div>
                </motion.div>
            ) : (
                /* Mails Section */
                <motion.div key="mails" custom={sectionCustom} variants={SECTION_VARIANTS} initial="hidden" animate="shown" exit="gone" className="grid grid-cols-1 lg:grid-cols-mail gap-6 md:gap-8 h-full min-h-[600px] max-h-[900px]">
                    {/* Left: Mails List */}
                    <motion.div variants={PANEL_VARIANTS} className="canary-panel flex flex-col gap-4 p-6 md:p-8 rounded-sm border shadow-sm h-full overflow-hidden"
                        style={{
                            backgroundColor: containerBg,
                            borderColor: 'var(--dash-border)',
                            }}>
                        <div className="flex flex-col gap-2">

                            <h3 className="text-2xl font-bold m-0" style={{ color: 'var(--dash-text)' }}>Inbox</h3>
                        </div>

                        <div role="listbox" aria-label="Messages" className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 mr-1 custom-scrollbar">
                            {emails.length > 0 ? (
                                emails.map((email) => (
                                    <div
                                        key={email.id}
                                        role="option"
                                        aria-selected={selectedEmail?.id === email.id}
                                        tabIndex={0}
                                        onClick={() => setSelectedEmail(email)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedEmail(email); } }}
                                        className="canary-mail group relative p-3 md:p-4 cursor-pointer transition-all"
                                        style={{
                                            borderColor: selectedEmail?.id === email.id ? 'var(--primary)' : 'var(--dash-border)',
                                            backgroundColor: selectedEmail?.id === email.id ? 'var(--primary-soft)' : 'var(--dash-surface-raised)'
                                        }}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex flex-col gap-1 overflow-hidden flex-1 min-w-0">
                                                <h4 className="text-sm font-bold m-0 truncate" style={{ color: 'var(--dash-text)' }}>{email.name}</h4>
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <Mail size={11} className="opacity-50 shrink-0" />
                                                    <span className="text-xs opacity-70 truncate select-all">{email.email}</span>
                                                </div>
                                                {email.number && (
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <Phone size={11} className="opacity-50 shrink-0" />
                                                        <span className="text-xs opacity-70 truncate select-all">{email.number}</span>
                                                        {email.whatsapp && (
                                                            <span className="text-xs font-bold text-dash-success bg-dash-success/15 px-1.5 py-0.5 rounded-full shrink-0">WhatsApp</span>
                                                        )}
                                                    </div>
                                                )}
                                                <p className="m-0 text-xs opacity-80 line-clamp-1 mt-0.5">{email.message}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs font-bold opacity-80">{new Date(email.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                                    {email.attachments.length > 0 && (
                                                        <div className="flex items-center gap-1 text-xs font-bold text-dash-accent-text">
                                                            <Paperclip size={10} />
                                                            <span>{email.attachments.length}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Options Menu Button */}
                                            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        setMenuPos({
                                                            top: rect.bottom + 4,
                                                            right: window.innerWidth - rect.right
                                                        });
                                                        setOpenOptionsId(openOptionsId === email.id ? null : email.id);
                                                    }}
                                                    aria-label={`Options for ${email.name}`}
                                                    aria-haspopup="menu"
                                                    aria-expanded={openOptionsId === email.id}
                                                    className="canary-more p-2 rounded-sm border-none bg-transparent cursor-pointer"
                                                >
                                                    <MoreVertical size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="canary-empty flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                                    <Mail size={28} />
                                    <span className="text-sm font-semibold">No messages yet</span>
                                    <p className="text-xs m-0">New enquiries will appear here as soon as they arrive.</p>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Right: Mail View */}
                    <motion.div variants={PANEL_VARIANTS} className="canary-panel flex flex-col gap-6 p-6 md:p-8 rounded-sm border shadow-sm h-full overflow-hidden"
                        style={{
                            backgroundColor: containerBg,
                            borderColor: 'var(--dash-border)',
                            }}>
                        {selectedEmail ? (
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={selectedEmail.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                    className="flex flex-col gap-6 h-full overflow-y-auto pr-2 custom-scrollbar"
                                >
                                    {/* Header & Actions */}
                                    <div className="flex flex-col gap-6">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-center gap-4">

                                                <div className="flex flex-col gap-1">
                                                    <h2 className="text-xl md:text-2xl font-bold m-0 leading-tight" style={{ color: 'var(--dash-text)' }}>
                                                        {selectedEmail.name}
                                                    </h2>
                                                    <div className="flex items-center gap-2 text-xs font-medium opacity-50">
                                                        <span>{new Date(selectedEmail.timestamp).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                                        <span>•</span>
                                                        <span>{new Date(selectedEmail.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                                                        {selectedEmail.repliedAt && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="inline-flex items-center gap-1 text-dash-success opacity-100">
                                                                    <Check size={12} /> Replied
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleReplyEmail(selectedEmail)}
                                                    className="p-2.5 md:px-4 md:py-2 rounded-sm bg-dash-accent text-dash-text shadow-lg shadow-[0_8px_24px_var(--shadow-color)] hover:bg-dash-accent active:scale-95 transition-all flex items-center gap-2"
                                                    title="Reply"
                                                >
                                                    <Reply size={18} />
                                                    <span className="hidden md:inline font-bold text-sm">{selectedEmail.repliedAt ? 'Reply again' : 'Reply'}</span>
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete(selectedEmail.id)}
                                                    className="p-2.5 rounded-sm bg-dash-accent-soft text-dash-danger hover:bg-dash-danger/20 active:scale-95 transition-all border border-transparent hover:border-dash-danger/20"
                                                    title="Delete Message"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Metadata Card */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-sm border"
                                            style={{
                                                backgroundColor: 'var(--dash-surface-2)',
                                                borderColor: 'var(--dash-border)'
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-dash-surface-2 dark:bg-dash-surface/5 opacity-70">
                                                    <Mail size={14} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs uppercase font-bold opacity-80">Email Address</span>
                                                    <span className="text-sm font-semibold select-all" style={{ color: 'var(--dash-text)' }}>{selectedEmail.email}</span>
                                                </div>
                                            </div>

                                            {selectedEmail.number && (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-dash-surface-2 dark:bg-dash-surface/5 opacity-70">
                                                        <Clock size={14} className="rotate-0" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs uppercase font-bold opacity-80">Phone Number</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-semibold select-all" style={{ color: 'var(--dash-text)' }}>{selectedEmail.number}</span>
                                                            {selectedEmail.whatsapp && (
                                                                <a
                                                                    href={`https://wa.me/${selectedEmail.number.replace(/\D/g, '')}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="px-1.5 py-0.5 rounded bg-dash-success/15 text-dash-success text-xs font-bold uppercase tracking-wider border border-dash-success/30 hover:bg-dash-success/20 transition-colors cursor-pointer no-underline"
                                                                    title="Chat on WhatsApp"
                                                                >
                                                                    WA
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="my-2 h-[1px] w-full bg-gradient-to-r from-transparent via-black/5 dark:via-white/10 to-transparent" />

                                    {/* Message Body */}
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs font-bold uppercase tracking-[0.2em] opacity-80 ml-1">Message Content</span>
                                        <div className="p-4 md:p-6 rounded-sm" style={{ backgroundColor: 'var(--dash-surface-2)' }}>
                                            <p className="m-0 text-sm md:text-base leading-loose whitespace-pre-wrap font-medium opacity-90" style={{ color: 'var(--dash-text-2)' }}>
                                                {selectedEmail.message}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Attachments */}
                                    {selectedEmail.attachments.length > 0 && (
                                        <div className="flex flex-col gap-4 mt-2">
                                            <div className="flex items-center justify-between pb-2 border-b border-dashed" style={{ borderColor: 'var(--dash-border)' }}>
                                                <div className="flex items-center gap-2">
                                                    <Paperclip size={16} className="text-dash-accent-text" />
                                                    <span className="text-xs font-bold uppercase tracking-widest opacity-80">
                                                        Attachments ({selectedEmail.attachments.length})
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-3">
                                                {selectedEmail.attachments.map(renderAttachmentCard)}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        ) : (
                            <div className="canary-empty flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                                <Mail size={32} />
                                <span className="text-sm font-semibold">Select a message to view</span>
                                <p className="text-xs m-0">Choose one from the inbox to read and reply.</p>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )
            }
            </AnimatePresence>

            {/* Meeting details (info-first; Edit hands off to the edit modal) */}
            {
                typeof document !== 'undefined' && createPortal(
                    <AnimatePresence mode="wait">
                        {viewingMeeting && (
                            <motion.div
                                key="canary-view-overlay"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[2000] flex items-center justify-center bg-[var(--scrim)] p-2 md:p-4"
                            >
                                <div className="absolute inset-0" onClick={() => setViewingMeeting(null)} />
                                <motion.div
                                    key="canary-view-content"
                                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                    animate={{ scale: 1, opacity: 1, y: 0 }}
                                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                                    className="relative w-full max-w-lg rounded-sm overflow-hidden flex flex-col shadow-2xl max-h-[95vh]"
                                    style={{ backgroundColor: 'var(--dash-surface-2)', border: `1px solid ${'var(--dash-border)'}` }}
                                >
                                    {/* Header */}
                                    <div className="p-5 md:p-6 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--dash-border)' }}>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="grid place-items-center shrink-0 rounded-sm" style={{ width: 44, height: 44, background: 'var(--dash-accent)', color: 'var(--on-primary)' }}>
                                                <CalendarIcon size={22} />
                                            </span>
                                            <div className="min-w-0">
                                                <h3 className="text-lg font-bold m-0 truncate" style={{ color: 'var(--dash-text)' }}>{viewingMeeting.title}</h3>
                                                <p className="text-xs font-semibold uppercase tracking-wider m-0" style={{ color: 'var(--dash-text-3)' }}>Booking details</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setViewingMeeting(null)} className="p-2 hover:bg-dash-surface-3 dark:hover:bg-dash-surface/5 rounded-sm transition-colors shrink-0" style={{ color: 'var(--dash-text-2)' }} aria-label="Close">
                                            <X size={18} />
                                        </button>
                                    </div>

                                    {/* Body */}
                                    <div className="p-5 md:p-6 flex flex-col gap-5 overflow-y-auto custom-scrollbar">
                                        {viewingMeeting.email && (
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--dash-text-3)' }}>Email</span>
                                                <a href={`mailto:${viewingMeeting.email}`} className="text-sm font-semibold hover:text-dash-accent-text transition-colors break-all select-all inline-flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
                                                    <Mail size={14} className="opacity-80 shrink-0" />
                                                    {viewingMeeting.email}
                                                </a>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--dash-text-3)' }}>Date</span>
                                                <span className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>{viewingMeeting.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--dash-text-3)' }}>Time</span>
                                                <span className="text-sm font-semibold inline-flex items-center gap-2" style={{ color: 'var(--dash-text)' }}><Clock size={14} className="opacity-80 shrink-0" />{viewingMeeting.time}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1.5 items-start">
                                            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--dash-text-3)' }}>Category</span>
                                            <CategoryBadge cat={categoryOf(viewingMeeting)} size="md" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--dash-text-3)' }}>What it&apos;s for</span>
                                            <span className="text-sm leading-relaxed" style={{ color: 'var(--dash-text-2)' }}>{viewingMeeting.reason || 'No description provided.'}</span>
                                        </div>
                                        {viewingMeeting.link && (
                                            <a href={viewingMeeting.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-sm text-sm font-bold transition-colors self-start no-underline" style={{ background: 'var(--dash-accent)', color: 'var(--on-primary)' }}>
                                                <Video size={16} /> Join meeting
                                            </a>
                                        )}
                                    </div>

                                    {/* Footer actions */}
                                    <div className="p-5 md:p-6 border-t flex items-center justify-between gap-3" style={{ borderColor: 'var(--dash-border)' }}>
                                        <button
                                            type="button"
                                            onClick={() => { const id = viewingMeeting.id; setViewingMeeting(null); setConfirmDelete(id); }}
                                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-sm text-sm font-bold cursor-pointer transition-colors"
                                            style={{ border: '1px solid var(--dash-danger)', color: 'var(--dash-danger)' }}
                                        >
                                            <Trash2 size={16} /> Delete
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { const m = viewingMeeting; setViewingMeeting(null); handleReschedule(m); }}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm text-sm font-bold cursor-pointer transition-all"
                                            style={{ background: 'var(--dash-accent)', color: 'var(--on-primary)' }}
                                        >
                                            <Edit2 size={16} /> Edit
                                        </button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>,
                    document.body
                )
            }

            {/* Modal */}
            {
                typeof document !== 'undefined' && createPortal(
                    <AnimatePresence mode="wait">
                        {editingMeeting && (
                            <motion.div
                                key="canary-modal-overlay"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[2000] flex items-center justify-center bg-[var(--scrim)] p-2 md:p-4"
                            >
                                <div className="absolute inset-0" onClick={() => setEditingMeeting(null)} />

                                <motion.div
                                    key="canary-modal-content"
                                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                    animate={{ scale: 1, opacity: 1, y: 0 }}
                                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                                    className="relative w-full max-w-3xl rounded-sm overflow-hidden flex flex-col shadow-2xl max-h-[92vh]"
                                    style={{ backgroundColor: 'var(--dash-surface)', border: `1px solid ${'var(--dash-border)'}` }}
                                >
                                    {/* Header: says what this is and which booking, so the fields
                                        below don't have to carry that job on their own. */}
                                    <div className="px-5 md:px-7 py-4 md:py-5 border-b flex items-start justify-between gap-3" style={{ borderColor: 'var(--dash-border)' }}>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="grid place-items-center shrink-0 rounded-sm" style={{ width: 42, height: 42, background: 'var(--dash-accent)', color: 'var(--on-primary)' }}>
                                                <Edit2 size={20} />
                                            </span>
                                            <div className="min-w-0">
                                                <h3 className="text-base md:text-lg font-bold m-0 leading-tight" style={{ color: 'var(--dash-text)' }}>Edit booking</h3>
                                                <p className="text-xs m-0 mt-0.5 truncate" style={{ color: 'var(--dash-text-3)' }}>
                                                    {editOriginal
                                                        ? `Booked for ${editOriginal.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} at ${editOriginal.time}`
                                                        : 'Booking details'}
                                                    {editingMeeting.email ? ` · ${editingMeeting.email}` : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <button onClick={() => setEditingMeeting(null)} aria-label="Close" className="w-9 h-9 grid place-items-center shrink-0 hover:bg-dash-surface-3 dark:hover:bg-dash-surface-3 rounded-sm transition-colors cursor-pointer" style={{ color: 'var(--dash-text-2)' }}>
                                            <X size={18} />
                                        </button>
                                    </div>

                                    <div className="px-5 md:px-7 py-5 md:py-6 overflow-y-auto custom-scrollbar">
                                        {/* Explicit columns rather than a md: variant: responsive grid-cols
                                            variants do not survive this file's class ordering (the base
                                            grid-cols wins), and the width is already tracked here. */}
                                        <div style={{ display: 'grid', gridTemplateColumns: wideModal ? '1fr 264px' : '1fr', gap: wideModal ? '2rem' : '1.5rem' }}>
                                            {/* Left: what the booking IS */}
                                            <div className="flex flex-col gap-5 min-w-0">
                                                <div className="flex flex-col gap-2">
                                                    <label htmlFor="booking-title" className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--dash-text-3)' }}>Booked by</label>
                                                    <input
                                                        id="booking-title"
                                                        type="text"
                                                        className="w-full h-11 rounded-sm border px-3.5 text-sm font-medium transition-colors focus:border-dash-accent outline-none"
                                                        style={{ backgroundColor: 'var(--dash-surface-2)', borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }}
                                                        value={editingMeeting.title}
                                                        onChange={(e) => setEditingMeeting({ ...editingMeeting, title: e.target.value })}
                                                        placeholder="Guest or meeting name"
                                                    />
                                                </div>

                                                <div className="flex flex-col gap-2">
                                                    <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--dash-text-3)' }}>Category</label>
                                                    <div className="flex items-center gap-2">
                                                        {/* The swatch is the only place the colour appears in this
                                                            modal, so the pick reads at a glance next to the name. */}
                                                        <span className="w-11 h-11 grid place-items-center rounded-sm shrink-0" style={{ background: `color-mix(in srgb, categoryOf(editingMeeting).color 12%, transparent)` }}>
                                                            <span className="w-3 h-3 rounded-full" style={{ background: categoryOf(editingMeeting).color }} />
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <Select
                                                                value={editingMeeting.category || PERSONAL_CATEGORY.id}
                                                                options={allCategories.map(c => ({
                                                                    value: c.id,
                                                                    label: c.name,
                                                                    hint: c.id === PERSONAL_CATEGORY.id ? 'Default' : undefined,
                                                                }))}
                                                                // Personal is stored as no category at all, hence the undefined.
                                                                onChange={(v) => setEditingMeeting({ ...editingMeeting, category: v === PERSONAL_CATEGORY.id ? undefined : v })}
                                                                isDark={isDark}
                                                                aria-label="Booking category"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-baseline justify-between gap-3">
                                                        <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--dash-text-3)' }}>Time</label>
                                                        <span className="text-xs" style={{ color: 'var(--dash-text-3)' }}>host time</span>
                                                    </div>
                                                    <div className="gap-1.5" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))' }}>
                                                        {TIME_OPTIONS.map((time) => {
                                                            const isTaken = meetings.some(m =>
                                                                m.id !== editingMeeting.id &&
                                                                m.date.toDateString() === editingMeeting.date.toDateString() &&
                                                                m.time === time
                                                            );
                                                            const on = editingMeeting.time === time;
                                                            return (
                                                                <button
                                                                    key={time}
                                                                    type="button"
                                                                    disabled={isTaken}
                                                                    onClick={() => setEditingMeeting({ ...editingMeeting, time })}
                                                                    className="h-9 rounded-sm text-xs font-bold border transition-colors disabled:cursor-not-allowed cursor-pointer"
                                                                    style={on
                                                                        ? { background: 'var(--dash-accent)', color: 'var(--on-primary)', borderColor: 'var(--dash-accent-text)' }
                                                                        : { background: 'transparent', color: isTaken ? 'var(--dash-text-3)' : ('var(--dash-text)'), borderColor: 'var(--dash-border)', opacity: isTaken ? 0.35 : 1 }}
                                                                    title={isTaken ? 'Already booked' : undefined}
                                                                >
                                                                    {time}
                                                                </button>
                                                            );
                                                        })}

                                                        {/* Custom (free) slot, styled like the others: a picker so you can
                                                            reschedule to any time, not just the fixed hours.
                                                            zIndex clears this modal's own z-[2000]. */}
                                                        <CustomTimePicker
                                                            className="h-9 rounded-sm text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap"
                                                            style={customOn
                                                                ? { background: 'var(--dash-accent)', color: 'var(--on-primary)', borderColor: 'var(--dash-accent-text)' }
                                                                : { background: 'transparent', color: 'var(--dash-text)', borderColor: 'var(--dash-border)' }}
                                                            isDark={isDark}
                                                            active={customOn}
                                                            value={editingMeeting.time}
                                                            zIndex={2100}
                                                            validate={(t) => {
                                                                const taken = meetings.some(m =>
                                                                    m.id !== editingMeeting.id &&
                                                                    m.date.toDateString() === editingMeeting.date.toDateString() &&
                                                                    m.time === t
                                                                );
                                                                return taken ? 'That time is already booked, pick another.' : null;
                                                            }}
                                                            onError={(msg) => showAlert({ type: 'warning', message: msg })}
                                                            onApply={(t) => setEditingMeeting({ ...editingMeeting, time: t })}
                                                        />
                                                    </div>
                                                </div>

                                                {editingMeeting.via && (
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--dash-text-3)' }}>Booked from</span>
                                                        <p className="text-sm leading-relaxed m-0" style={{ color: 'var(--dash-text-2)' }}>
                                                            {editingMeeting.via === 'book' ? 'The book page (mohanddarwish.vercel.app/book)' : 'The contact window on the portfolio'}
                                                        </p>
                                                    </div>
                                                )}

                                                {editingMeeting.reason && (
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--dash-text-3)' }}>What it&apos;s for</span>
                                                        <p className="text-sm leading-relaxed m-0" style={{ color: 'var(--dash-text-2)' }}>{editingMeeting.reason}</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Right: when */}
                                            <div className="flex flex-col gap-3 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-sm font-bold" style={{ color: 'var(--dash-text)' }}>
                                                        {modalViewDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <button type="button" onClick={() => changeModalMonth(-1)} aria-label="Previous month" className="w-7 h-7 grid place-items-center rounded-sm cursor-pointer transition-colors hover:bg-dash-surface-3 dark:hover:bg-dash-surface-3" style={{ color: 'var(--dash-text-2)' }}><ChevronLeft size={15} /></button>
                                                        <button type="button" onClick={() => changeModalMonth(1)} aria-label="Next month" className="w-7 h-7 grid place-items-center rounded-sm cursor-pointer transition-colors hover:bg-dash-surface-3 dark:hover:bg-dash-surface-3" style={{ color: 'var(--dash-text-2)' }}><ChevronRight size={15} /></button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-7 gap-1 text-center">
                                                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                                                        <div key={idx} className="text-xs font-bold" style={{ color: 'var(--dash-text-3)' }}>{d}</div>
                                                    ))}
                                                </div>

                                                <div className="overflow-hidden relative">
                                                    <AnimatePresence mode="popLayout" initial={false} custom={modalDirection}>
                                                        <motion.div
                                                            key={modalViewDate.toISOString()}
                                                            custom={modalDirection}
                                                            variants={variants}
                                                            initial="enter"
                                                            animate="center"
                                                            exit="exit"
                                                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                                            className="grid grid-cols-7 gap-1"
                                                        >
                                                            {modalCalendarDays.map((date, idx) => {
                                                                const isSelected = date?.toDateString() === editingMeeting.date.toDateString();
                                                                const isToday = date?.toDateString() === new Date().toDateString();
                                                                // Past days stay selectable (unlike the public booking calendar) - they
                                                                // just sit back visually, and saving onto one asks for confirmation.
                                                                const isPast = !!date && isPastDay(date);
                                                                return (
                                                                    <button
                                                                        key={idx}
                                                                        type="button"
                                                                        disabled={!date}
                                                                        onClick={() => date && setEditingMeeting({ ...editingMeeting, date })}
                                                                        title={isPast ? 'This day has already passed' : undefined}
                                                                        className={`relative grid place-items-center aspect-square rounded-sm border-none bg-transparent p-0 ${date ? 'cursor-pointer' : 'pointer-events-none'} ${date && !isSelected ? 'hover:bg-dash-surface-3 dark:hover:bg-dash-surface-3' : ''}`}
                                                                        style={{ opacity: date ? (isPast && !isSelected ? 0.4 : 1) : 0 }}
                                                                    >
                                                                        {isSelected && date && (
                                                                            <motion.span
                                                                                layoutId="modal-selected-day-bg"
                                                                                initial={false}
                                                                                transition={{ type: "spring", stiffness: 500, damping: 40, mass: 1 }}
                                                                                style={{ position: 'absolute', inset: 0, borderRadius: 8, backgroundColor: 'var(--dash-accent)', zIndex: 0 }}
                                                                            />
                                                                        )}
                                                                        <span className="relative z-10 text-xs" style={{
                                                                            color: isSelected ? 'var(--dash-text)' : (isToday ? 'var(--dash-accent-text)' : ('var(--dash-text)')),
                                                                            fontWeight: isSelected || isToday ? 700 : 500,
                                                                        }}>
                                                                            {date?.getDate()}
                                                                        </span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </motion.div>
                                                    </AnimatePresence>
                                                </div>

                                                {/* Where this edit actually lands, spelled out. */}
                                                <div className="rounded-sm px-3 py-2.5 mt-auto" style={{ background: 'var(--dash-surface-2)' }}>
                                                    <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--dash-text-3)' }}>Moving to</div>
                                                    <div className="text-sm font-bold leading-snug" style={{ color: 'var(--dash-text)' }}>
                                                        {editingMeeting.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                    </div>
                                                    <div className="text-sm font-semibold" style={{ color: 'var(--dash-accent-text)' }}>{editingMeeting.time}</div>
                                                    {isPastDay(editingMeeting.date) && (
                                                        <div className="text-xs font-semibold mt-1.5" style={{ color: 'var(--dash-warning)' }}>That day has already passed.</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer: the destructive action kept apart from the two safe ones. */}
                                    <div className="px-5 md:px-7 py-4 border-t flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: 'var(--dash-border)', backgroundColor: 'var(--dash-surface-2)' }}>
                                        <button
                                            type="button"
                                            onClick={() => setConfirmDelete(editingMeeting.id)}
                                            className="inline-flex items-center gap-2 px-3 h-10 rounded-sm text-sm font-bold cursor-pointer transition-colors text-dash-danger hover:bg-dash-accent-soft"
                                        >
                                            <Trash2 size={16} />
                                            Cancel session
                                        </button>
                                        <div className="flex items-center gap-2 ml-auto">
                                            <button
                                                type="button"
                                                onClick={() => setEditingMeeting(null)}
                                                className="px-4 h-10 rounded-sm font-bold text-sm cursor-pointer transition-colors hover:bg-dash-surface-3 dark:hover:bg-dash-surface-3"
                                                style={{ color: 'var(--dash-text-3)' }}
                                            >
                                                Discard
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleSaveMeeting()}
                                                disabled={!editDirty || isLoading}
                                                className="inline-flex items-center gap-2 px-5 h-10 rounded-sm text-dash-text font-bold text-sm cursor-pointer transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-80 disabled:cursor-not-allowed disabled:hover:brightness-100"
                                                style={{ background: 'var(--dash-accent)' }}
                                            >
                                                <Check size={17} strokeWidth={2.5} />
                                                Save changes
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>,
                    document.body
                )
            }

            {/* Confirmation & Feedback */}
            {/* Guard on .show, not on the object: useSafeAlert keeps the last alert in state
                and only flips `show` to false, so `{alert && ...}` left the toast mounted for
                good - and a mounted toast keeps re-running its own exit animation. */}
            {alert?.show && <Alert type={alert.type} message={alert.message} onClose={() => hideAlert()} duration={alert.duration ?? 4000} />}
            <MConfirmModal
                isOpen={!!confirmDelete}
                title={activeSection === 'mails' ? "Delete Message" : "Cancel Session"}
                message={activeSection === 'mails'
                    ? "Are you sure you want to delete this message? This action cannot be undone."
                    : "Are you sure you want to cancel this session? This action cannot be undone."
                }
                type="danger"
                confirmText={activeSection === 'mails' ? "Delete Message" : "Cancel Session"}
                onConfirm={() => {
                    if (confirmDelete) {
                        if (activeSection === 'mails') {
                            handleDeleteEmail(confirmDelete);
                        } else {
                            const meeting = meetings.find(m => m.id === confirmDelete);
                            handleDelete(confirmDelete, meeting);
                            setConfirmDelete(null);
                            setEditingMeeting(null);
                        }
                    }
                }}
                onClose={() => setConfirmDelete(null)}
            />

            <MConfirmModal
                isOpen={!!confirmDeleteCat}
                title="Delete category"
                message={confirmDeleteCat
                    ? `Delete "${confirmDeleteCat.name}"? ${meetings.filter(m => m.category === confirmDeleteCat.id).length} booking(s) using it will go back to Personal. The bookings themselves are kept.`
                    : ''}
                type="danger"
                confirmText="Delete category"
                onConfirm={() => {
                    if (confirmDeleteCat) deleteCategory(confirmDeleteCat);
                    setConfirmDeleteCat(null);
                }}
                onClose={() => setConfirmDeleteCat(null)}
            />

            {/* Rescheduling backwards in time - allowed, but never by accident. */}
            <MConfirmModal
                isOpen={confirmPastSave}
                title="Reschedule to a past date"
                message={editingMeeting
                    ? `${editingMeeting.date.toLocaleDateString('default', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} at ${editingMeeting.time} has already passed. Save this session there anyway?`
                    : ''}
                type="warning"
                confirmText="Reschedule anyway"
                onConfirm={() => {
                    setConfirmPastSave(false);
                    handleSaveMeeting(true);
                }}
                onClose={() => setConfirmPastSave(false)}
            />

            {/* Specialized Booking Modal */}
            {isBookingOpen && (
                <MContact
                    onClose={() => setIsBookingOpen(false)}
                    initialTab="meeting"
                    hideTabs={true}
                />
            )}

            <AnimatePresence>
                {replyTo && (
                    <MReply
                        email={replyTo}
                        isDark={isDark}
                        onClose={() => setReplyTo(null)}
                        onSent={() => markReplied(replyTo.id)}
                        notify={(message, type) => showAlert({ type, message })}
                    />
                )}
            </AnimatePresence>

            {/* Email Options Menu Portal & Attachment Preview (Omitted for brevity as they are unchanged) */}
            {
                openOptionsId && createPortal(
                    <>
                        <div
                            className="fixed inset-0 z-[999]"
                            onClick={() => setOpenOptionsId(null)}
                        />
                        <div className="fixed z-[1000] glass-panel min-w-[140px] p-2 animate-pop flex flex-col gap-1 shadow-2xl" style={{
                            top: `${menuPos.top}px`,
                            right: `${menuPos.right}px`,
                            borderRadius: '4px',
                            backgroundColor: 'var(--dash-surface)',
                            border: '1px solid var(--dash-border)',
                            }}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const email = emails.find(e => e.id === openOptionsId);
                                    if (email) handleReplyEmail(email);
                                }}
                                className="canary-menu-item w-full text-left flex items-center gap-2 bg-transparent border-none cursor-pointer rounded-sm text-sm p-2.5 transition-colors"
                            >
                                <Reply size={16} /> Reply
                            </button>

                            <div className="mx-2 my-0.5 h-[1px]" style={{ backgroundColor: 'var(--dash-surface-2)' }} />

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDelete(openOptionsId);
                                    setOpenOptionsId(null);
                                }}
                                className="canary-menu-item canary-menu-item--danger w-full text-left flex items-center gap-2 bg-transparent border-none cursor-pointer rounded-sm text-sm p-2.5 transition-colors"
                            >
                                <Trash2 size={16} /> Delete
                            </button>
                        </div>
                    </>,
                    document.body
                )
            }

            {
                typeof document !== 'undefined' && createPortal(
                    <AnimatePresence>
                        {previewAttachment && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setPreviewAttachment(null)}
                                className="fixed inset-0 z-[2000] flex items-center justify-center bg-[var(--scrim)] p-4 sm:p-8"
                            >
                                <div
                                    className="relative max-w-5xl max-h-full w-full rounded-sm overflow-hidden shadow-2xl bg-black"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        onClick={() => setPreviewAttachment(null)}
                                        className="absolute top-4 right-4 z-50 p-2 rounded-full bg-[var(--scrim)] hover:bg-[var(--scrim)] text-dash-text transition-colors"
                                    >
                                        <X size={24} />
                                    </button>

                                    <div className="flex w-full h-full items-center justify-center bg-dash-surface">
                                        {/\.(jpg|jpeg|png|gif|webp)$/i.test(previewAttachment.name) ? (
                                            <img
                                                src={previewAttachment.url}
                                                alt={previewAttachment.name}
                                                className="max-w-full max-h-[85vh] object-contain"
                                            />
                                        ) : /\.(mp4|webm|ogg)$/i.test(previewAttachment.name) ? (
                                            <video
                                                controls
                                                autoPlay
                                                src={previewAttachment.url}
                                                className="max-w-full max-h-[85vh]"
                                            />
                                        ) : (
                                            <iframe
                                                src={previewAttachment.url}
                                                title={previewAttachment.name}
                                                className="w-full h-[85vh] bg-dash-surface"
                                            />
                                        )}
                                    </div>

                                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-dash-text">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold truncate">{previewAttachment.name}</span>
                                            <a
                                                href={previewAttachment.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-4 py-2 rounded-sm bg-dash-surface-2 hover:bg-dash-surface-3 transition-colors flex items-center gap-2 text-sm font-bold"
                                            >
                                                <ExternalLink size={14} /> Open Original
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>,
                    document.body
                )
            }
        </div >
    );
};

export default DCanary;
