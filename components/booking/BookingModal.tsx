"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, Send, Paperclip, User, Phone, MessageSquare, Check, Mail, Calendar, Clock, ChevronLeft, ChevronRight, Globe } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import Alert from "@/components/ui/alert";
import useSafeAlert from "@/hooks/useSafeAlert";
import { AvailabilityConfig, DEFAULT_AVAILABILITY, parseAvailabilityConfig, buildHostSlots, isWorkingDay } from "@/lib/availability";
import { RevilSelect } from "@/components/ui/revil-select";
import CustomTimePicker from "@/components/booking/CustomTimePicker";
import HintTooltip from "@/components/ui/hint-tooltip";
import useTheme from "@/hooks/useTheme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isValidEmail = (s: string) => EMAIL_RE.test(s.trim());

interface Meeting {
  Date: string;
  Time: string;
  Name: string;
  Email: string;
  Reason?: string;
  "What For"?: string;
  dateObj: Date;
  MeetingLink?: string;
  GoogleEventId?: string;
  UserLocalTime?: string;
  UserTimezone?: number;
  timestamp?: number;
}

const timezones = [
  { label: "UTC-12:00", value: "-12" },
  { label: "UTC-11:00", value: "-11" },
  { label: "UTC-10:00", value: "-10" },
  { label: "UTC-09:00", value: "-9" },
  { label: "UTC-08:00 (PST)", value: "-8" },
  { label: "UTC-07:00 (MST)", value: "-7" },
  { label: "UTC-06:00 (CST)", value: "-6" },
  { label: "UTC-05:00 (EST)", value: "-5" },
  { label: "UTC-04:00", value: "-4" },
  { label: "UTC-03:00", value: "-3" },
  { label: "UTC-02:00", value: "-2" },
  { label: "UTC-01:00", value: "-1" },
  { label: "UTC+00:00 (GMT)", value: "0" },
  { label: "UTC+01:00 (CET)", value: "1" },
  { label: "UTC+02:00 (EET)", value: "2" },
  { label: "UTC+03:00 (MSK)", value: "3" },
  { label: "UTC+04:00", value: "4" },
  { label: "UTC+05:00", value: "5" },
  { label: "UTC+05:30 (IST)", value: "5.5" },
  { label: "UTC+06:00", value: "6" },
  { label: "UTC+07:00", value: "7" },
  { label: "UTC+08:00 (CST)", value: "8" },
  { label: "UTC+09:00 (JST)", value: "9" },
  { label: "UTC+10:00 (AEST)", value: "10" },
  { label: "UTC+11:00", value: "11" },
  { label: "UTC+12:00 (NZST)", value: "12" },
];

type Props = { open: boolean; onClose: () => void; initialTab?: "meeting" | "message"; hideTabs?: boolean };

export function BookingModal({ open, onClose, initialTab = "meeting", hideTabs = false }: Props) {
  const isDark = useTheme();
  const [activeTab, setActiveTab] = useState<"message" | "meeting">(initialTab);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isCustomTime, setIsCustomTime] = useState(false);
  const [direction, setDirection] = useState(0);
  const [tabDirection, setTabDirection] = useState(0);
  const [meetingData, setMeetingData] = useState({ name: "", email: "", reason: "" });
  const [formData, setFormData] = useState({ name: "", email: "", number: "", hasWhatsapp: false, message: "", attachments: [] as File[] });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingMeetings, setExistingMeetings] = useState<Meeting[]>([]);
  const [bookingSuccess, setBookingSuccess] = useState<{ date: string; time: string; link: string } | null>(null);
  const { alert, showAlert, hideAlert } = useSafeAlert(4000);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  const [agendaScrolled, setAgendaScrolled] = useState(false);
  const [messageScrolled, setMessageScrolled] = useState(false);

  const tabVariants = {
    enter: (d: number) => ({ x: d > 0 ? "40%" : "-40%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? "-40%" : "40%", opacity: 0 }),
  };

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const limitDate = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 45); return d; }, []);
  const isPrevMonthDisabled = useMemo(() => { const prevM = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1); const currentMStart = new Date(today.getFullYear(), today.getMonth(), 1); return prevM < currentMStart; }, [calendarDate, today]);
  const isNextMonthDisabled = useMemo(() => { const nextM = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1); return nextM > limitDate; }, [calendarDate, limitDate]);
  const isFutureMonth = useMemo(() => calendarDate.getFullYear() > today.getFullYear() || (calendarDate.getFullYear() === today.getFullYear() && calendarDate.getMonth() > today.getMonth()), [calendarDate, today]);

  useEffect(() => { if (isFutureMonth && open) showAlert({ type: "info", message: "Bookings open about 1.5 months ahead. For dates further out, use the “Send a Message” tab with your preferred times.", duration: 10000 }); }, [isFutureMonth, showAlert, open]);

  const [hostTimezoneString, setHostTimezoneString] = useState("UTC+02:00 (EET)");
  const [userTimezone, setUserTimezone] = useState<number>(() => -(new Date().getTimezoneOffset() / 60));

  useEffect(() => { const h = () => setIsMobile(window.innerWidth < 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);

  const [prevDate, setPrevDate] = useState(selectedDate);
  if (prevDate !== selectedDate) { setPrevDate(selectedDate); setBookingSuccess(null); setAgendaScrolled(false); setSelectedTime(null); setIsCustomTime(false); }
  const [prevTimezone, setPrevTimezone] = useState(userTimezone);
  if (prevTimezone !== userTimezone) { setPrevTimezone(userTimezone); setSelectedTime(null); setIsCustomTime(false); }
  const [prevTab, setPrevTab] = useState(activeTab);
  if (prevTab !== activeTab) { setPrevTab(activeTab); setAgendaScrolled(false); setMessageScrolled(false); }

  const getDaysInMonth = (date: Date) => { const y = date.getFullYear(), m = date.getMonth(); return { days: new Date(y, m + 1, 0).getDate(), firstDay: new Date(y, m, 1).getDay() }; };
  const [availConfig, setAvailConfig] = useState<AvailabilityConfig>(DEFAULT_AVAILABILITY);
  const [availLoaded, setAvailLoaded] = useState(false);
  const [slotsLoaded, setSlotsLoaded] = useState(false);
  const timeSlots = useMemo(() => buildHostSlots(availConfig), [availConfig]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const loadAvail = async () => {
      try {
        const r = await fetch("/api/availability").then((x) => x.json());
        if (cancelled) return;
        if (r.timezone) setHostTimezoneString(r.timezone);
        if (r.workingDays && r.hours) setAvailConfig(parseAvailabilityConfig({ workingDays: r.workingDays, hours: r.hours }));
        else setAvailConfig(DEFAULT_AVAILABILITY);
      } catch { if (!cancelled) setAvailConfig(DEFAULT_AVAILABILITY); }
      if (!cancelled) setAvailLoaded(true);
    };
    const loadSlots = async () => {
      try {
        const r = await fetch("/api/booked-slots").then((x) => x.json());
        if (cancelled) return;
        const slots = (r.slots || []) as Array<{ date?: string; time?: string; Date?: string; Time?: string }>;
        const list = slots.filter((s) => s && (s.date || s.Date) && (s.time || s.Time)).map((s): Meeting => ({ Date: (s.date as string) || (s.Date as string) || "", Time: (s.time as string) || (s.Time as string) || "", Name: "", Email: "", dateObj: new Date((s.date as string) || (s.Date as string) || Date.now()) }));
        setExistingMeetings(list);
      } catch { if (!cancelled) setExistingMeetings([]); }
      if (!cancelled) setSlotsLoaded(true);
    };
    loadAvail(); loadSlots();
    const id = setInterval(() => { loadAvail(); loadSlots(); }, 10000);
    return () => { cancelled = true; clearInterval(id); };
  }, [open, bookingSuccess]);

  const formatDateDDMMYYYY = useCallback((date: Date) => { const d = date.getDate().toString().padStart(2, "0"); const m = (date.getMonth() + 1).toString().padStart(2, "0"); const y = date.getFullYear(); return `${d}/${m}/${y}`; }, []);
  const getMeetingsForDate = useCallback((date: Date) => { const s = formatDateDDMMYYYY(date); return existingMeetings.filter((m) => m.Date === s); }, [existingMeetings, formatDateDDMMYYYY]);
  const getOffsetFromUTCString = (tzStr: string) => { const match = tzStr.match(/UTC([+-]\d{2}):(\d{2})/); if (!match) return 0; const h = parseInt(match[1]); const mins = parseInt(match[2]); return h + (mins / 60) * (h < 0 ? -1 : 1); };
  const hostOffset = getOffsetFromUTCString(hostTimezoneString);
  const offsetDiff = userTimezone - hostOffset;
  const convertTimeToUser = useCallback((hostTimeStr: string) => { const [time, period] = hostTimeStr.split(" "); const [h, mins] = time.split(":").map(Number); let hour = Number.isNaN(h) ? 0 : h; const minute = Number.isNaN(mins) ? 0 : mins; if (period === "PM" && hour !== 12) hour += 12; if (period === "AM" && hour === 12) hour = 0; let total = hour * 60 + minute + offsetDiff * 60; total = (total + 1440) % 1440; const newH = Math.floor(total / 60); const newM = total % 60; const newPeriod = newH >= 12 ? "PM" : "AM"; const displayH = newH % 12 || 12; return `${displayH.toString().padStart(2, "0")}:${newM.toString().padStart(2, "0")} ${newPeriod}`; }, [offsetDiff]);
  const convertTimeToHost = (userTimeStr: string) => { const [time, period] = userTimeStr.split(" "); const [h, mins] = time.split(":").map(Number); let hour = Number.isNaN(h) ? 0 : h; const minute = Number.isNaN(mins) ? 0 : mins; if (period === "PM" && hour !== 12) hour += 12; if (period === "AM" && hour === 12) hour = 0; let total = hour * 60 + minute - offsetDiff * 60; total = (total + 1440) % 1440; const newH = Math.floor(total / 60); const newM = total % 60; const newPeriod = newH >= 12 ? "PM" : "AM"; const displayH = newH % 12 || 12; return `${displayH.toString().padStart(2, "0")}:${newM.toString().padStart(2, "0")} ${newPeriod}`; };
  const convertedSlots = useMemo(() => timeSlots.map(convertTimeToUser), [timeSlots, convertTimeToUser]);
  const isTimePassed = useCallback((date: Date, hostTimeStr: string) => { const t = new Date(); t.setHours(0, 0, 0, 0); const cd = new Date(date); cd.setHours(0, 0, 0, 0); if (cd > t) return false; if (cd < t) return true; const [time, period] = hostTimeStr.split(" "); let [h] = time.split(":").map(Number); if (period === "PM" && h !== 12) h += 12; if (period === "AM" && h === 12) h = 0; const now = new Date(); const utc = now.getTime() + now.getTimezoneOffset() * 60000; const hostNow = new Date(utc + 3600000 * hostOffset); const slot = h * 60 + (typeof time.split(":").map(Number)[1] === "number" ? time.split(":").map(Number)[1] : 0); const cur = hostNow.getHours() * 60 + hostNow.getMinutes(); return cur + 30 > slot; }, [hostOffset]);

  const hasAutoMoved = useRef(false);
  useEffect(() => {
    if (!selectedDate || activeTab !== "meeting" || hasAutoMoved.current || !availLoaded || !slotsLoaded || !open) return;
    const checkAvailable = (date: Date) => { if (!isWorkingDay(availConfig, date)) return false; return timeSlots.some((hostTime) => { const busy = getMeetingsForDate(date).some((m) => m.Time === hostTime); const passed = isTimePassed(date, hostTime); return !busy && !passed; }); };
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    if (selectedDate < today0 || !checkAvailable(selectedDate)) {
      let searchDate = new Date(selectedDate); if (searchDate < today0) searchDate = new Date(today0);
      let found = false; for (let i = 0; i < 30; i++) { if (checkAvailable(searchDate)) { found = true; break; } searchDate.setDate(searchDate.getDate() + 1); }
      if (found && searchDate.toDateString() !== selectedDate.toDateString()) { setSelectedDate(searchDate); setCalendarDate(searchDate); }
    }
    hasAutoMoved.current = true;
  }, [existingMeetings, hostTimezoneString, selectedDate, timeSlots, getMeetingsForDate, isTimePassed, activeTab, availConfig, availLoaded, slotsLoaded, open]);
  useEffect(() => { hasAutoMoved.current = false; }, [open]);

  const handleMeetingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedTime) return;
    const selectedHostTime = convertTimeToHost(selectedTime);
    const slotNowBusy = getMeetingsForDate(selectedDate).some((m) => m.Time === selectedHostTime);
    const notOffered = !isCustomTime && !convertedSlots.includes(selectedTime);
    if (notOffered || isTimePassed(selectedDate, selectedHostTime) || slotNowBusy) { setSelectedTime(null); setIsCustomTime(false); showAlert({ type: "warning", message: "That time slot is no longer available. Please pick another." }); return; }
    if (!meetingData.email || !isValidEmail(meetingData.email)) { showAlert({ type: "error", message: "Please enter a valid email address." }); return; }
    setIsSubmitting(true);
    try {
      const timeParts = selectedTime.split(" "); const [hoursStr, minutesStr] = timeParts[0].split(":"); let hours = parseInt(hoursStr); const minutes = parseInt(minutesStr); const isPM = timeParts[1] === "PM"; if (isPM && hours !== 12) hours += 12; if (!isPM && hours === 12) hours = 0;
      const y = selectedDate.getFullYear(), m = selectedDate.getMonth(), d = selectedDate.getDate();
      const startDateUTC = new Date(Date.UTC(y, m, d, hours, minutes) - userTimezone * 3600000);
      const endDateUTC = new Date(startDateUTC.getTime() + 3600000);
      const r = await fetch("/api/booking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: meetingData.name, email: meetingData.email.trim(), reason: meetingData.reason, startTime: startDateUTC.toISOString(), endTime: endDateUTC.toISOString(), userTimezone, selectedTime }) });
      const j = await r.json() as { error?: string; link?: string; id?: string; date?: string; time?: string };
      if (!r.ok) throw new Error(j.error || "Booking failed");
      const meetLink = j.link || "";
      setBookingSuccess({ date: formatDateDDMMYYYY(selectedDate), time: selectedTime || "", link: meetLink || "" });
      setMeetingData({ name: "", email: "", reason: "" });
      // refresh slots
      fetch("/api/booked-slots").then((rr) => rr.json()).then((jj) => { const slots = (jj.slots || []) as Array<{ date: string; time: string }>; setExistingMeetings(slots.filter((s) => s && s.date && s.time).map((s) => ({ Date: s.date, Time: s.time, Name: "", Email: "", dateObj: new Date(s.date) }))); }).catch(() => {});
    } catch (error: unknown) { const err = error as { message?: string }; const msg = err.message?.includes("Invalid attendee email") ? "Invalid Email Address provided." : err.message || "Could not book meeting"; showAlert({ type: "error", message: msg }); } finally { setIsSubmitting(false); }
  };

  const validateCustomTime = (t: string): string | null => { if (!selectedDate) return null; const hostT = convertTimeToHost(t); if (isTimePassed(selectedDate, hostT)) return "That time has already passed, pick a later one."; if (getMeetingsForDate(selectedDate).some((m) => m.Time === hostT)) return "That time overlaps an existing booking, pick another."; return null; };
  const isCustomTimeUnavailable = useCallback((t: string): boolean => { if (!selectedDate) return false; const hostT = convertTimeToHost(t); return isTimePassed(selectedDate, hostT) || getMeetingsForDate(selectedDate).some((m) => m.Time === hostT); }, [selectedDate, isTimePassed, offsetDiff, existingMeetings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { const { name, value } = e.target; setFormData((prev) => ({ ...prev, [name]: value })); };
  const MAX_FILES = 5; const MAX_FILE_SIZE = 10 * 1024 * 1024; const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.presentationml.presentation"];
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    if (formData.attachments.length + newFiles.length > MAX_FILES) { showAlert({ type: "warning", message: `Maximum ${MAX_FILES} files allowed.` }); return; }
    const valid: File[] = [];
    for (const f of newFiles) { if (f.size > MAX_FILE_SIZE) { showAlert({ type: "warning", message: `"${f.name}" exceeds 10MB limit.` }); continue; } if (!ALLOWED_TYPES.includes(f.type)) { showAlert({ type: "warning", message: `"${f.name}" - file type not allowed. Use images, PDFs, or documents.` }); continue; } valid.push(f); }
    if (valid.length) setFormData((prev) => ({ ...prev, attachments: [...prev.attachments, ...valid] }));
  };
  const removeFile = (index: number) => setFormData((prev) => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== index) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) { showAlert({ type: "warning", message: "Please fill in all required fields (Name, Email, Message)." }); return; }
    if (!isValidEmail(formData.email)) { showAlert({ type: "warning", message: "Please enter a valid email address." }); return; }
    setIsSubmitting(true);
    try {
      // try supabase storage upload if bucket exists
      const uploaded: { name: string; url: string }[] = [];
      if (formData.attachments.length > 0) {
        for (const file of formData.attachments) {
          try {
            const path = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}/${file.name}`;
            const { error } = await supabase.storage.from("attachments").upload(path, file, { upsert: false });
            if (!error) {
              const { data } = supabase.storage.from("attachments").getPublicUrl(path);
              uploaded.push({ name: file.name, url: data.publicUrl });
            } else {
              uploaded.push({ name: file.name, url: "" });
            }
          } catch { uploaded.push({ name: file.name, url: "" }); }
        }
      }
      const r = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: formData.name, email: formData.email.trim(), message: formData.message, number: formData.number, hasWhatsapp: formData.hasWhatsapp, files: uploaded }) });
      const j = await r.json().catch(() => ({})) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Send failed");
      showAlert({ type: "success", message: "Message sent! I'll get back to you soon." });
      setFormData({ name: "", email: "", number: "", hasWhatsapp: false, message: "", attachments: [] });
      setTimeout(onClose, 1200);
    } catch (err) { showAlert({ type: "error", message: err instanceof Error ? err.message : "Failed to send message." }); } finally { setIsSubmitting(false); }
  };

  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !(document.querySelector("[role='dialog'][aria-label='Pick a custom time']"))) onClose(); }; document.addEventListener("keydown", h); document.body.style.overflow = "hidden"; return () => { document.removeEventListener("keydown", h); document.body.style.overflow = "unset"; }; }, [open, onClose]);

  const modalMotion = useMemo(() => ({ initial: { opacity: 0, scale: 0.3, y: -400 } as const, animate: { opacity: 1, scale: 1, y: 0 } as const, exit: { opacity: 0, scale: 0.3, y: -400 } as const, transformOrigin: "top center", transition: { type: "spring" as const, damping: 30, stiffness: 350, mass: 1 } }), []);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {alert?.show && <Alert type={alert.type} message={alert.message} onClose={() => hideAlert()} duration={alert.duration ?? 4000} />}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", zIndex: 1400 }} onClick={onClose} />
      <div className="fixed inset-0 z-[1401] flex items-center justify-center p-4 pointer-events-none" style={{ overscrollBehavior: "contain" }}>
        <motion.div role="dialog" aria-modal="true" aria-labelledby="contact-modal-title" layout initial={modalMotion.initial} animate={modalMotion.animate} exit={modalMotion.exit} transition={modalMotion.transition} className={isMobile ? "glass-panel-deep" : ""} style={{ width: isMobile ? "90vw" : "min(1240px, 94vw)", height: isMobile ? "90dvh" : "min(760px, 92vh)", maxWidth: isMobile ? "90vw" : "94vw", maxHeight: isMobile ? "90dvh" : "92vh", transformOrigin: modalMotion.transformOrigin, overflow: isMobile ? "hidden" : "visible", borderRadius: isMobile ? "16px" : "0", display: "flex", flexDirection: "column", pointerEvents: "auto", backgroundColor: isMobile ? undefined : "transparent", border: isMobile ? undefined : "none", boxShadow: isMobile ? undefined : "none", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
          {isMobile && <div className="absolute inset-0 bg-gradient-to-b from-black/[0.04] dark:from-white/[0.04] to-transparent pointer-events-none -z-10" />}
          <div className="flex flex-col flex-1 overflow-hidden" style={{ overscrollBehavior: "contain", padding: isMobile ? "0" : "24px 24px 0 24px" }}>
            {isMobile && (
              <div className="p-6 pb-0 flex flex-col gap-4">
                <div className="flex-row-between mb-4">
                  <div className="flex items-center gap-3">
                    <motion.div layoutId="contact-icon" className="flex items-center justify-center" transition={{ type: "spring", damping: 30, stiffness: 350, mass: 1 }}><Mail size={24} strokeWidth={2} /></motion.div>
                    <h2 id="contact-modal-title" className="heading-md m-0 font-bold" style={{ fontSize: "1.5rem" }}>Contact Me</h2>
                  </div>
                  <button onClick={onClose} aria-label="Close contact form" className="btn-icon rounded-full"><X size={20} /></button>
                </div>
              </div>
            )}
            <div className={isMobile ? "custom-scrollbar" : ""} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflowY: isMobile ? "auto" : "hidden", overflowX: "hidden" } as React.CSSProperties}>
              <AnimatePresence mode="wait" custom={tabDirection} initial={false}>
                {activeTab === "meeting" ? (
                  <motion.div key="meeting" custom={tabDirection} variants={tabVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }} style={{ flex: isMobile ? "0 0 auto" : 1, minHeight: 0, display: isMobile ? "flex" : "grid", flexDirection: isMobile ? "column" : "row", gridTemplateColumns: isMobile ? "none" : "1.2fr 1fr", gap: isMobile ? "40px" : "32px", overflowY: isMobile ? "visible" : "hidden", padding: isMobile ? "0 16px 24px" : "0 24px 12px", height: isMobile ? "auto" : "100%" } as unknown as React.CSSProperties}>
                    <div className={!isMobile ? "glass-panel-deep hide-scrollbar" : ""} style={{ height: isMobile ? "auto" : "100%", display: "flex", flexDirection: "column", gap: "24px", overflowY: isMobile ? "visible" : "auto", padding: isMobile ? "0" : "24px", borderRadius: isMobile ? "0" : "24px", boxShadow: isMobile ? "none" : "0 18px 44px -22px rgba(0,0,0,0.16), 0 44px 96px -40px rgba(0,0,0,0.2)" }}>
                      {!isMobile && (<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", width: "100%" }}><div style={{ display: "flex", alignItems: "center", gap: "12px" }}><motion.div layoutId="contact-icon" className="flex items-center justify-center text-primary" transition={{ type: "spring", damping: 30, stiffness: 350, mass: 1 }}><Mail size={22} /></motion.div><h2 style={{ fontSize: "clamp(1.15rem, 0.85rem + 1.1vw, 1.45rem)", fontWeight: 700, margin: 0 }}>Contact Me</h2></div></div>)}
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "safe center", gap: "24px", width: "100%", minHeight: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, width: "100%" }}>
                          <h3 style={{ fontSize: "clamp(1rem, 0.85rem + 0.6vw, 1.15rem)", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}><AnimatePresence mode="wait"><motion.span key={calendarDate.toISOString()} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.2 }}>{calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</motion.span></AnimatePresence></h3>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button aria-label="Previous month" disabled={isPrevMonthDisabled} onClick={() => { if (!isPrevMonthDisabled) { setDirection(-1); setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1)); } }} style={{ padding: "8px", borderRadius: "10px", border: "none", background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)", color: "var(--text-primary)", cursor: isPrevMonthDisabled ? "not-allowed" : "pointer", opacity: isPrevMonthDisabled ? 0.4 : 1 }}><ChevronLeft size={16} /></button>
                            <button aria-label="Next month" disabled={isNextMonthDisabled} onClick={() => { if (!isNextMonthDisabled) { setDirection(1); setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1)); } }} style={{ padding: "8px", borderRadius: "10px", border: "none", background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)", color: "var(--text-primary)", cursor: isNextMonthDisabled ? "not-allowed" : "pointer", opacity: isNextMonthDisabled ? 0.4 : 1 }}><ChevronRight size={16} /></button>
                          </div>
                        </div>
                        <div style={{ overflow: "hidden", flexShrink: 0, width: "100%" }}>
                          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                            <motion.div key={calendarDate.toISOString()} custom={direction} variants={{ enter: (d: number) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (d: number) => ({ x: d > 0 ? "-100%" : "100%", opacity: 0 }) }} initial="enter" animate="center" exit="exit" transition={{ type: "spring", stiffness: 300, damping: 30 }} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px", textAlign: "center" }}>
                              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (<div key={`${d}-${i}`} style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-muted)", paddingBottom: "8px" }}>{d}</div>))}
                              {Array.from({ length: getDaysInMonth(calendarDate).firstDay }).map((_, i) => (<div key={`empty-${i}`} />))}
                              {Array.from({ length: getDaysInMonth(calendarDate).days }).map((_, i) => {
                                const day = i + 1; const date = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day); const isSelected = selectedDate?.toDateString() === date.toDateString(); const meetingsForDay = getMeetingsForDate(date); const hasMeetings = meetingsForDay.length > 0; const isPast = date < today; const isTooFar = date > limitDate; const hasFreeSlots = timeSlots.some((hostTime) => { const busy = getMeetingsForDate(date).some((m) => m.Time === hostTime); const passed = isTimePassed(date, hostTime); return !busy && !passed; }); const isBookable = !isPast && !isTooFar && hasFreeSlots && isWorkingDay(availConfig, date);
                                return (<div key={day} role="button" tabIndex={isBookable ? 0 : -1} aria-disabled={!isBookable} aria-pressed={isSelected} aria-label={date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} onClick={() => { if (isBookable) setSelectedDate(date); }} onKeyDown={(e) => { if (isBookable && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setSelectedDate(date); } }} style={{ width: "100%", height: "clamp(38px, 6vh, 52px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: "14px", cursor: isBookable ? "pointer" : "default", position: "relative", opacity: isBookable ? 1 : 0.4 }}>
                                  {isSelected && (<motion.div layoutId="selected-day-bg" style={{ position: "absolute", inset: 0, borderRadius: "14px", backgroundColor: "var(--accent-primary)", zIndex: 0 }} />)}
                                  <span style={{ position: "relative", zIndex: 1, color: isSelected ? "white" : isPast || isTooFar ? "var(--text-muted)" : "var(--text-primary)", fontWeight: isSelected ? 700 : 600, fontSize: "clamp(0.92rem, 0.82rem + 0.4vw, 1.05rem)" }}>{day}</span>
                                  {hasMeetings && !isSelected && (<div style={{ display: "flex", gap: "2px", justifyContent: "center", marginTop: "2px" }}>{meetingsForDay.slice(0, 3).map((m: Meeting, idx) => (<div key={idx} title={`${convertTimeToUser(m.Time)} - Booked`} style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#10b981", position: "relative", zIndex: 1 }} />))}</div>)}
                                </div>);
                              })}
                            </motion.div>
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                    <div className={!isMobile ? "glass-panel-deep" : ""} style={{ flex: 1, height: isMobile ? "auto" : "100%", display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: isMobile ? "0" : "24px", boxShadow: isMobile ? "none" : "0 18px 44px -22px rgba(0,0,0,0.16), 0 44px 96px -40px rgba(0,0,0,0.2)", willChange: "transform", position: "relative" }}>
                      <div style={{ flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: isMobile ? "4px 0 16px" : "20px 24px", backgroundColor: agendaScrolled ? (isDark ? "rgba(20,20,25,0.55)" : "rgba(255,255,255,0.55)") : "transparent", backdropFilter: agendaScrolled ? "blur(14px)" : "none", WebkitBackdropFilter: agendaScrolled ? "blur(14px)" : "none", borderBottom: `1px solid ${agendaScrolled ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)") : "transparent"}`, borderTopLeftRadius: isMobile ? "0" : "24px", borderTopRightRadius: isMobile ? "0" : "24px", transition: "background-color 0.25s ease, border-color 0.25s ease", zIndex: 5 }}>
                        <h4 style={{ fontSize: "clamp(1.05rem, 0.9rem + 0.6vw, 1.25rem)", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{selectedDate ? selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "Select a Date"}</h4>
                        {!isMobile && (<button type="button" onClick={onClose} aria-label="Close contact form" className="btn-icon rounded-full" style={{ backgroundColor: "transparent", color: "var(--text-muted)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "50%", transition: "all 0.2s" }}><X size={18} /></button>)}
                      </div>
                      <div onScroll={(e) => setAgendaScrolled(e.currentTarget.scrollTop > 4)} className={!isMobile ? "hide-scrollbar" : ""} style={{ flex: 1, minHeight: 0, overflowY: isMobile ? "visible" : "auto", padding: isMobile ? "0" : "4px 24px 24px", display: "flex", flexDirection: "column" }}>
                        <AnimatePresence mode="wait">
                          <motion.div key={bookingSuccess ? "success" : selectedDate?.toISOString() || "no-date"} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                            {bookingSuccess ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "24px", alignItems: "center", textAlign: "center", height: "100%", justifyContent: "center", paddingTop: "40px" }}>
                                <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}><Check size={32} /></div>
                                <div><h3 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>Booking Confirmed!</h3><p style={{ color: "var(--text-muted)" }}>You are scheduled for {bookingSuccess.date} at {bookingSuccess.time}.</p></div>
                                {bookingSuccess.link && bookingSuccess.link.startsWith("http") ? (<div style={{ padding: "16px", background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", borderRadius: "12px", width: "100%" }}><div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "8px" }}>Google Meet Link</div><a href={bookingSuccess.link} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-primary)", fontWeight: 600, wordBreak: "break-all", textDecoration: "none" }}>{bookingSuccess.link}</a></div>) : null}
                                <button onClick={() => { setBookingSuccess(null); onClose(); }} style={{ marginTop: "auto", padding: "12px 32px", borderRadius: "12px", border: "none", backgroundColor: "var(--text-primary)", color: "var(--bg-primary)", fontWeight: 600, cursor: "pointer" }}>Done</button>
                              </div>
                            ) : (
                              <>
                                {selectedDate && getMeetingsForDate(selectedDate).length > 0 && (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px", padding: "16px", borderRadius: "16px", background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}` }}>
                                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Existing Bookings Today</div>
                                    {getMeetingsForDate(selectedDate).map((m, i) => (<div key={i} className="flex items-center gap-3 py-1" style={{ borderBottom: i === getMeetingsForDate(selectedDate).length - 1 ? "none" : isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.05)" }}><div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px rgba(16, 185, 129, 0.5)" }} /><div className="flex-1"><div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{convertTimeToUser(m.Time)} - <span style={{ opacity: 0.7 }}>Booked</span></div></div></div>))}
                                  </div>
                                )}
                                {selectedDate && (() => { const isPast = selectedDate < new Date(new Date().setHours(0, 0, 0, 0)); const hasFreeSlots = timeSlots.some((hostTime) => { const busy = getMeetingsForDate(selectedDate).some((m) => m.Time === hostTime); const passed = isTimePassed(selectedDate, hostTime); return !busy && !passed; }); return !isPast && hasFreeSlots && isWorkingDay(availConfig, selectedDate); })() && (
                                  <>
                                    <div style={{ position: "relative", marginBottom: "24px" }}>
                                      <div><label className="label-help flex items-center gap-2 mb-2" style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)" }}><Globe size={14} className="opacity-70" /> User Timezone<HintTooltip text="We've detected your timezone automatically, but you can adjust it here. Available slots will update to match your local area's time." isDark={isDark} /></label></div>
                                      <RevilSelect value={String(userTimezone)} options={timezones.map((t) => ({ value: String(t.value), label: t.label }))} onChange={(v) => setUserTimezone(Number(v))} isDark={isDark} searchable aria-label="Your timezone" />
                                    </div>
                                    <div>
                                      <h3 className="heading-sm mb-3 flex items-center gap-2"><Clock size={16} /> Available Slots</h3>
                                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "16px" }}>
                                        {convertedSlots.map((time, idx) => {
                                          const hostTime = timeSlots[idx]; const isBusy = getMeetingsForDate(selectedDate!).some((m) => m.Time === hostTime); const passed = isTimePassed(selectedDate!, hostTime); const isDisabled = isBusy || passed; const isActive = selectedTime === time && !isCustomTime;
                                          return (<button key={time} onClick={() => { setSelectedTime(time); setIsCustomTime(false); }} disabled={isDisabled} style={{ padding: "10px 8px", borderRadius: "12px", border: `1px solid ${isActive ? "var(--accent-primary)" : isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`, background: isActive ? "color-mix(in srgb, var(--accent-primary) 12%, transparent)" : isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", color: isActive ? "var(--accent-primary)" : "var(--text-primary)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", transition: "all 0.2s", opacity: isDisabled ? 0.3 : 1, textDecoration: isDisabled ? "line-through" : "none" }}>{time}</button>);
                                        })}
                                        <CustomTimePicker isDark={isDark} active={isCustomTime} value={selectedTime} validate={validateCustomTime} isUnavailable={isCustomTimeUnavailable} onError={(msg) => showAlert({ type: "warning", message: msg })} onApply={(t) => { setSelectedTime(t); setIsCustomTime(true); }} />
                                      </div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                        <div><label className="label-help">Name *<HintTooltip text="Warning: your name will show in the calendar, if you want to hide it, please use a nickname." isDark={isDark} /></label><input aria-label="Name" className="dashboard-input" style={{ borderRadius: "12px", width: "100%" }} placeholder="Your Name" value={meetingData.name} onChange={(e) => setMeetingData({ ...meetingData, name: e.target.value })} /></div>
                                        <div><label className="label-help">Email *<HintTooltip text="Please use a correct email address. I will send the Google Calendar invitation and meeting link directly to this inbox." isDark={isDark} /></label><input type="email" aria-label="Email" className="dashboard-input" style={{ borderRadius: "12px", width: "100%" }} placeholder="Your Email" value={meetingData.email} onChange={(e) => setMeetingData({ ...meetingData, email: e.target.value })} /></div>
                                      </div>
                                      <div><label className="input-label font-semibold">Reason *</label><textarea aria-label="Reason for meeting" className="dashboard-textarea" style={{ minHeight: "60px", borderRadius: "12px" }} placeholder="What's this meeting for?" rows={1} value={meetingData.reason} onChange={(e) => setMeetingData({ ...meetingData, reason: e.target.value })} /></div>
                                    </div>
                                    <button onClick={handleMeetingSubmit} disabled={isSubmitting || !selectedDate || !selectedTime || !meetingData.email} className="btn-primary btn w-full" style={{ padding: "14px", borderRadius: "14px", opacity: isSubmitting || !selectedDate || !selectedTime || !meetingData.email ? 0.5 : 1 }}>{isSubmitting ? (<><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} style={{ display: "flex" }}><Clock size={16} /></motion.div> Booking...</>) : "Confirm Booking"}</button>
                                  </>
                                )}
                              </>
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="message" custom={tabDirection} variants={tabVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }} style={{ flex: isMobile ? "0 0 auto" : 1, minHeight: 0, display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: isMobile ? "flex-start" : "center", overflowY: isMobile ? "visible" : "hidden", padding: isMobile ? "0 16px 24px" : "0 24px 12px", height: isMobile ? "auto" : "100%" }}>
                    <form onSubmit={handleSubmit} className={!isMobile ? "glass-panel-deep" : ""} style={{ width: "100%", maxWidth: isMobile ? "none" : "640px", height: isMobile ? "auto" : "100%", display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: isMobile ? "0" : "24px", boxShadow: isMobile ? "none" : "0 18px 44px -22px rgba(0,0,0,0.16), 0 44px 96px -40px rgba(0,0,0,0.2)", willChange: "transform", position: "relative" }}>
                      <div style={{ flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: isMobile ? "4px 0 16px" : "20px 24px", backgroundColor: messageScrolled ? (isDark ? "rgba(20,20,25,0.55)" : "rgba(255,255,255,0.55)") : "transparent", backdropFilter: messageScrolled ? "blur(14px)" : "none", WebkitBackdropFilter: messageScrolled ? "blur(14px)" : "none", borderBottom: `1px solid ${messageScrolled ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)") : "transparent"}`, borderTopLeftRadius: isMobile ? "0" : "24px", borderTopRightRadius: isMobile ? "0" : "24px", transition: "background-color 0.25s ease, border-color 0.25s ease", zIndex: 5 }}><h3 style={{ fontSize: "clamp(1.1rem, 0.9rem + 0.7vw, 1.3rem)", fontWeight: 700, margin: 0 }}>Send a Message</h3>{!isMobile && (<button type="button" onClick={onClose} aria-label="Close contact form" className="btn-icon rounded-full" style={{ backgroundColor: "transparent", color: "var(--text-muted)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "50%", transition: "all 0.2s" }}><X size={18} /></button>)}</div>
                      <div onScroll={(e) => setMessageScrolled(e.currentTarget.scrollTop > 4)} className={!isMobile ? "hide-scrollbar" : ""} style={{ flex: 1, minHeight: 0, overflowY: isMobile ? "visible" : "auto", padding: isMobile ? "0" : "4px 24px 24px", display: "flex", flexDirection: "column", gap: "20px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                          <div><label className="input-label font-semibold">Name *</label><div className="input-container"><User size={18} className="input-icon" /><input name="name" aria-label="Name" value={formData.name} onChange={handleInputChange} required className="input-with-icon" placeholder="Full Name" /></div></div>
                          <div><label className="input-label font-semibold">Email *</label><div className="input-container"><Mail size={18} className="input-icon" /><input type="email" name="email" aria-label="Email" value={formData.email} onChange={handleInputChange} required className="input-with-icon" placeholder="name@example.com" /></div></div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                          <div><label className="input-label font-semibold">Phone Number *</label><div className="input-container"><Phone size={18} className="input-icon" /><input type="tel" name="number" aria-label="Phone number" value={formData.number} onChange={handleInputChange} required className="input-with-icon" placeholder="+1 (555) 123-4567" /></div></div>
                          <div className="toggle-container" style={{ height: "48px", margin: 0 }}><div className="flex items-center gap-2 font-semibold text-sm"><MessageSquare size={16} /> WhatsApp Available</div><div onClick={() => setFormData((prev) => ({ ...prev, hasWhatsapp: !prev.hasWhatsapp }))} className={`toggle-switch ${formData.hasWhatsapp ? "active" : ""}`} style={{ cursor: "pointer" }}><div className="toggle-knob">{formData.hasWhatsapp && <Check size={12} className="text-info" />}</div></div></div>
                        </div>
                        <div><label className="input-label font-semibold">Message *</label><textarea name="message" aria-label="Message" value={formData.message} onChange={handleInputChange} required rows={3} className="dashboard-textarea" placeholder="How can I help you?" /></div>
                        <div><div className="flex-row-between mb-3"><label className="input-label font-semibold m-0">Attachments</label><label className="flex items-center gap-1 text-sm cursor-pointer font-medium" style={{ color: "var(--accent-primary)" }}><Paperclip size={16} /> Add Files<input type="file" multiple onChange={handleFileChange} className="hidden" /></label></div>{formData.attachments.length > 0 && (<div className="flex flex-wrap gap-2">{formData.attachments.map((file, i) => (<div key={i} className="attachment-item flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}><span className="max-w-[150px] overflow-hidden truncate">{file.name}</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => removeFile(i)} className="inline-flex opacity-70 hover:opacity-100"><X size={14} /></button></div>))}</div>)}</div>
                        <button type="submit" disabled={isSubmitting} className="btn-primary btn w-full" style={{ opacity: isSubmitting ? 0.7 : 1 }}>{isSubmitting ? (<><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="flex"><Clock size={18} /></motion.div> Sending...</>) : (<><Send size={18} /> Send Message</>)}</button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          {!hideTabs && (
            <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", padding: isMobile ? "8px 0 12px" : "6px 0 16px", pointerEvents: "auto" }}>
              <motion.div initial={{ opacity: 0, y: 10, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.96 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="flex items-center gap-1 p-1.5 rounded-2xl md:gap-1.5 md:p-2 md:rounded-3xl backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)]" style={{ backgroundColor: "var(--subnav-bg, rgba(255,255,255,0.25))", border: "1px solid var(--section-border)" }}>
                <button type="button" onClick={() => { if (activeTab !== "meeting") { setTabDirection(-1); setActiveTab("meeting"); } }} className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold md:gap-2.5 md:px-5 md:py-2.5 md:rounded-2xl md:text-sm cursor-pointer" style={{ color: activeTab === "meeting" ? "var(--accent-primary)" : "var(--text-muted)", background: "transparent", border: "none", transition: "color 0.2s ease" }}>{activeTab === "meeting" && (<motion.div layoutId="contact-subnav-pill" className="absolute inset-0 rounded-xl md:rounded-2xl" style={{ background: "color-mix(in srgb, var(--accent-primary) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent)" }} transition={{ type: "spring", damping: 28, stiffness: 380 }} />)}<Calendar className="relative z-10 w-[15px] h-[15px] md:w-[18px] md:h-[18px]" strokeWidth={2.2} /><span className="relative z-10">Book a Call</span></button>
                <button type="button" onClick={() => { if (activeTab !== "message") { setTabDirection(1); setActiveTab("message"); } }} className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold md:gap-2.5 md:px-5 md:py-2.5 md:rounded-2xl md:text-sm cursor-pointer" style={{ color: activeTab === "message" ? "var(--accent-primary)" : "var(--text-muted)", background: "transparent", border: "none", transition: "color 0.2s ease" }}>{activeTab === "message" && (<motion.div layoutId="contact-subnav-pill" className="absolute inset-0 rounded-xl md:rounded-2xl" style={{ background: "color-mix(in srgb, var(--accent-primary) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent)" }} transition={{ type: "spring", damping: 28, stiffness: 380 }} />)}<MessageSquare className="relative z-10 w-[15px] h-[15px] md:w-[18px] md:h-[18px]" strokeWidth={2.2} /><span className="relative z-10">Send a Message</span></button>
              </motion.div>
            </div>
          )}
        </motion.div>
      </div>
    </>,
    document.body
  );
}
export default BookingModal;
