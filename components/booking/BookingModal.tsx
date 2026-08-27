"use client";

import { AnimatePresence, motion } from "motion/react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Globe, Mail, MessageSquare, X, Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DEFAULT_AVAILABILITY, buildHostSlots, isWorkingDay, parseAvailabilityConfig, type AvailabilityConfig } from "@/lib/availability";
import { EMAIL_RE, timezones, getOffsetFromUTCString, convertHostToUser, convertUserToHost, isTimePassed, formatDateDDMMYYYY, to12h } from "@/lib/booking";

type Props = { open: boolean; onClose: () => void; initialTab?: "meeting" | "message" };

export function BookingModal({ open, onClose, initialTab = "meeting" }: Props): ReactNode {
  const [tab, setTab] = useState<"meeting" | "message">(initialTab);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [customH, setCustomH] = useState(9);
  const [customM, setCustomM] = useState(0);
  const [customP, setCustomP] = useState<"AM" | "PM">("AM");
  const [userOffset, setUserOffset] = useState(() => -(new Date().getTimezoneOffset() / 60));
  const [avail, setAvail] = useState<AvailabilityConfig>(DEFAULT_AVAILABILITY);
  const [hostTimezone, setHostTimezone] = useState("UTC+02:00 (EET)");
  const [booked, setBooked] = useState<{ date: string; time: string }[]>([]);
  const [meetingData, setMeetingData] = useState({ name: "", email: "", reason: "" });
  const [msgData, setMsgData] = useState({ name: "", email: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  const [success, setSuccess] = useState<{ date: string; time: string; link: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  const hasAutoMoved = useRef(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose]);

  // fetch availability + booked
  useEffect(() => {
    if (!open) return;
    fetch("/api/availability")
      .then((r) => r.json())
      .then((j) => {
        if (j.workingDays && j.hours) setAvail(parseAvailabilityConfig({ workingDays: j.workingDays, hours: j.hours }));
        if (j.timezone) setHostTimezone(j.timezone);
      })
      .catch(() => {});
    fetch("/api/booked-slots")
      .then((r) => r.json())
      .then((j) => setBooked(j.slots ?? []))
      .catch(() => {});
  }, [open, success]);

  const hostOffset = useMemo(() => getOffsetFromUTCString(hostTimezone), [hostTimezone]);
  const offsetDiff = userOffset - hostOffset;
  const hostSlots = useMemo(() => buildHostSlots(avail), [avail]);
  const userSlots = useMemo(() => hostSlots.map((s) => convertHostToUser(s, offsetDiff)), [hostSlots, offsetDiff]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const limitDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 45);
    return d;
  }, []);

  const meetingsForDate = useCallback(
    (d: Date) => {
      const s = formatDateDDMMYYYY(d);
      return booked.filter((b) => b.date === s);
    },
    [booked]
  );

  // auto move to next free day once
  useEffect(() => {
    if (!open || tab !== "meeting" || !selectedDate || hasAutoMoved.current) return;
    const check = (d: Date) => {
      if (!isWorkingDay(avail, d)) return false;
      return hostSlots.some((ht) => {
        const busy = meetingsForDate(d).some((m) => m.time === ht);
        return !busy && !isTimePassed(d, ht, hostOffset);
      });
    };
    const sd = new Date(selectedDate);
    if (sd < today || !check(sd)) {
      let cur = sd < today ? new Date(today) : new Date(sd);
      let found = false;
      for (let i = 0; i < 30; i++) {
        if (check(cur)) { found = true; break; }
        cur.setDate(cur.getDate() + 1);
      }
      if (found && cur.toDateString() !== selectedDate.toDateString()) {
        setSelectedDate(cur);
        setCalendarDate(new Date(cur.getFullYear(), cur.getMonth(), 1));
      }
    }
    hasAutoMoved.current = true;
  }, [open, tab, selectedDate, avail, hostSlots, meetingsForDate, hostOffset, today]);

  useEffect(() => { hasAutoMoved.current = false; }, [open]);

  const getDays = (date: Date) => {
    const y = date.getFullYear(), m = date.getMonth();
    return { days: new Date(y, m + 1, 0).getDate(), first: new Date(y, m, 1).getDay() };
  };

  const showToast = (type: "success" | "error" | "info", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const handleMeetingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedTime) return showToast("error", "Pick date and time");
    const hostTime = convertUserToHost(selectedTime, offsetDiff);
    const busy = meetingsForDate(selectedDate).some((m) => m.time === hostTime);
    if (!isCustom && !userSlots.includes(selectedTime)) return showToast("error", "Pick an offered slot or use custom time");
    if (isTimePassed(selectedDate, hostTime, hostOffset) || busy) {
      setSelectedTime(null);
      return showToast("error", "That slot is no longer available");
    }
    if (!meetingData.email || !EMAIL_RE.test(meetingData.email)) return showToast("error", "Valid email required");
    setSubmitting(true);
    try {
      const { h, m } = (() => {
        const [t, p] = selectedTime.split(" ");
        const [hs, ms] = t.split(":");
        let hh = parseInt(hs, 10);
        const mm = parseInt(ms, 10);
        if (p === "PM" && hh !== 12) hh += 12;
        if (p === "AM" && hh === 12) hh = 0;
        return { h: hh, m: mm };
      })();
      const y = selectedDate.getFullYear(), mo = selectedDate.getMonth(), d = selectedDate.getDate();
      const startUTC = new Date(Date.UTC(y, mo, d, h, m) - userOffset * 3600000);
      const endUTC = new Date(startUTC.getTime() + 3600000);
      const r = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: meetingData.name,
          email: meetingData.email.trim(),
          reason: meetingData.reason,
          startTime: startUTC.toISOString(),
          endTime: endUTC.toISOString(),
          userTimezone: userOffset,
          selectedTime,
        }),
      });
      const j = (await r.json()) as { error?: string; link?: string; date?: string; time?: string };
      if (!r.ok) throw new Error(j.error || "Booking failed");
      setSuccess({ date: j.date || formatDateDDMMYYYY(selectedDate), time: selectedTime, link: j.link || "" });
      setMeetingData({ name: "", email: "", reason: "" });
      // refresh booked
      fetch("/api/booked-slots").then((rr) => rr.json()).then((jj) => setBooked(jj.slots ?? [])).catch(() => {});
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Could not book");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgData.name || !msgData.email || !msgData.message) return showToast("error", "Fill name, email, message");
    if (!EMAIL_RE.test(msgData.email)) return showToast("error", "Valid email required");
    setSubmitting(true);
    try {
      const r = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msgData),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Send failed");
      showToast("success", "Message sent!");
      setMsgData({ name: "", email: "", message: "" });
      setTimeout(onClose, 1200);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !mounted) return null;

  const customLabel = to12h(customH % 12 || customH, customM).replace(" ", customP === "AM" ? " AM" : " PM"); // stub, actual use below
  const customTimeStr = `${String(customH % 12 || 12).padStart(2, "0")}:${String(customM).padStart(2, "0")} ${customP}`;
  const customHost = convertUserToHost(customTimeStr, offsetDiff);
  const customBusy = meetingsForDate(selectedDate ?? new Date()).some((m) => m.time === customHost);
  const customPassed = selectedDate ? isTimePassed(selectedDate, customHost, hostOffset) : false;
  const customAvailable = !!selectedDate && !customBusy && !customPassed && isWorkingDay(avail, selectedDate);

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[92vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-[20px] border border-border bg-bg-primary shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* toast */}
        {toast && (
          <div className={`absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-medium shadow ${toast.type === "success" ? "bg-accent text-text-on-accent" : toast.type === "error" ? "bg-red-500 text-white" : "bg-bg-surface border border-border text-text-primary"}`}>
            {toast.msg}
          </div>
        )}

        {/* header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/20">
              <Mail className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-heading text-base font-semibold leading-none text-text-primary">Book with Mohand</h2>
              <p className="text-xs text-text-muted">Alexandria (GMT+2) · replies within 24h</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-bg-surface text-text-muted hover:text-text-primary hover:border-border-strong">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* tabs */}
        <div className="flex gap-2 border-b border-border px-5 py-3 sm:px-6">
          {(["meeting", "message"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${tab === t ? "bg-accent text-text-on-accent" : "bg-bg-surface border border-border text-text-secondary hover:text-text-primary"}`}
            >
              {t === "meeting" ? "Book a call" : "Send message"}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            {tab === "meeting" ? (
              <motion.div key="meeting" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.15fr_0.95fr]">
                {/* left calendar */}
                <div className="rounded-2xl border border-border bg-bg-surface p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-heading text-sm font-semibold text-text-primary">{calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h3>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-bg-primary text-text-secondary hover:border-border-strong"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-bg-primary text-text-secondary hover:border-border-strong"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mb-1 grid grid-cols-7 text-center text-[10px] tracking-widest text-text-muted">
                    {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
                      <div key={d} className="py-1 font-heading">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {(() => {
                      const { days, first } = getDays(calendarDate);
                      const cells: ReactNode[] = [];
                      for (let i = 0; i < first; i++) cells.push(<div key={`e${i}`} />);
                      for (let d = 1; d <= days; d++) {
                        const date = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), d);
                        const isSelected = selectedDate?.toDateString() === date.toDateString();
                        const busy = meetingsForDate(date).length > 0;
                        const free = hostSlots.some((ht) => !meetingsForDate(date).some((m) => m.time === ht) && !isTimePassed(date, ht, hostOffset));
                        const disabled = date < today || date > limitDate || !free || !isWorkingDay(avail, date);
                        cells.push(
                          <button
                            key={d}
                            disabled={disabled}
                            onClick={() => !disabled && setSelectedDate(date)}
                            className={`relative flex h-9 items-center justify-center rounded-xl text-sm font-medium transition ${isSelected ? "bg-accent text-text-on-accent shadow" : disabled ? "text-text-muted/30 cursor-not-allowed" : "text-text-primary hover:bg-bg-primary"} ${date.toDateString() === today.toDateString() && !isSelected ? "ring-1 ring-accent" : ""}`}
                          >
                            {d}
                            {busy && !isSelected && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" />}
                          </button>
                        );
                      }
                      return cells;
                    })()}
                  </div>

                  {/* timezone */}
                  <div className="mt-4 space-y-2">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-text-secondary"><Globe className="h-3.5 w-3.5" /> Your timezone</label>
                    <Select
                      value={userOffset}
                      onChange={(v) => { setUserOffset(v as number); setSelectedTime(null); setIsCustom(false); }}
                      options={timezones.map((t) => ({ label: t.label, value: t.value }))}
                      ariaLabel="Timezone"
                    />
                    <p className="text-xs text-text-muted">Host: {hostTimezone} · slots shown in your time</p>
                  </div>
                </div>

                {/* right details */}
                <div className="flex flex-col gap-4">
                  {success ? (
                    <div className="rounded-2xl border border-accent/30 bg-accent/10 p-5 text-center">
                      <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent text-text-on-accent"><Check className="h-5 w-5" /></div>
                      <h3 className="font-heading font-semibold text-text-primary">Booked!</h3>
                      <p className="text-sm text-text-secondary">{success.date} at {success.time}</p>
                      {success.link && <a href={success.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-medium text-text-on-accent">Join Meet</a>}
                      <button onClick={() => setSuccess(null)} className="mt-3 block w-full text-sm text-text-muted hover:text-text-primary">Book another</button>
                    </div>
                  ) : (
                    <>
                      {selectedDate && (
                        <div className="rounded-2xl border border-border bg-bg-surface p-4">
                          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-text-primary"><Clock className="h-4 w-4 text-accent" /> {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · pick a time</div>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {userSlots.map((slot) => {
                              const host = hostSlots[userSlots.indexOf(slot)];
                              const busy = meetingsForDate(selectedDate!).some((m) => m.time === host);
                              const passed = isTimePassed(selectedDate!, host, hostOffset);
                              const disabled = busy || passed;
                              const active = selectedTime === slot && !isCustom;
                              return (
                                <button
                                  key={slot}
                                  disabled={disabled}
                                  onClick={() => { setSelectedTime(slot); setIsCustom(false); }}
                                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${active ? "bg-accent text-text-on-accent border-accent" : disabled ? "bg-bg-primary text-text-muted/40 border-border cursor-not-allowed" : "bg-bg-primary text-text-primary border-border hover:border-accent hover:text-accent"}`}
                                >
                                  {slot}
                                </button>
                              );
                            })}
                          </div>
                          <div className="mt-3 rounded-xl border border-border bg-bg-primary p-3">
                            <label className="mb-2 flex items-center gap-2 text-xs font-medium text-text-secondary"><Clock className="h-3 w-3" /> Custom time (if slots full)</label>
                            <div className="grid grid-cols-3 gap-2">
                              <Select value={customH} onChange={(v) => setCustomH(v as number)} options={Array.from({ length: 12 }, (_, i) => ({ label: String(i + 1).padStart(2, "0"), value: i + 1 }))} ariaLabel="Hour" />
                              <Select value={customM} onChange={(v) => setCustomM(v as number)} options={[0, 15, 30, 45].map((m) => ({ label: String(m).padStart(2, "0"), value: m }))} ariaLabel="Minute" />
                              <Select value={customP} onChange={(v) => setCustomP(v as "AM" | "PM")} options={[{ label: "AM", value: "AM" }, { label: "PM", value: "PM" }]} ariaLabel="Period" />
                            </div>
                            <button
                              type="button"
                              disabled={!customAvailable}
                              onClick={() => { if (customAvailable) { setSelectedTime(customTimeStr); setIsCustom(true); } }}
                              className={`mt-2 w-full rounded-xl px-3 py-2 text-sm font-medium transition ${customAvailable ? "bg-accent text-text-on-accent" : "bg-bg-primary text-text-muted/40 border border-border cursor-not-allowed"}`}
                            >
                              {customAvailable ? `Use ${customTimeStr}` : customBusy ? "Busy — pick another" : customPassed ? "Already passed" : "Pick date first"}
                            </button>
                            {selectedTime && isCustom && <p className="mt-2 text-xs text-accent">Selected custom: {selectedTime}</p>}
                          </div>
                        </div>
                      )}

                      <form onSubmit={handleMeetingSubmit} className="space-y-3 rounded-2xl border border-border bg-bg-surface p-4">
                        <input value={meetingData.name} onChange={(e) => setMeetingData((s) => ({ ...s, name: e.target.value }))} placeholder="Your name" required className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
                        <input type="email" value={meetingData.email} onChange={(e) => setMeetingData((s) => ({ ...s, email: e.target.value }))} placeholder="Email for Meet invite" required className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
                        <textarea value={meetingData.reason} onChange={(e) => setMeetingData((s) => ({ ...s, reason: e.target.value }))} placeholder="What for? (optional)" rows={3} className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
                        <Button type="submit" disabled={submitting || !selectedTime} className="w-full">
                          {submitting ? "Booking..." : selectedTime ? `Book ${selectedTime}` : "Pick a time first"}
                        </Button>
                      </form>
                    </>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.form key="message" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} onSubmit={handleMessageSubmit} className="space-y-4 p-5 sm:p-6">
                <div className="flex items-center gap-2 text-sm text-text-secondary"><MessageSquare className="h-4 w-4 text-accent" /> Send a message — replies within 24h</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={msgData.name} onChange={(e) => setMsgData((s) => ({ ...s, name: e.target.value }))} placeholder="Your name" required className="rounded-xl border border-border bg-bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
                  <input type="email" value={msgData.email} onChange={(e) => setMsgData((s) => ({ ...s, email: e.target.value }))} placeholder="Email" required className="rounded-xl border border-border bg-bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
                </div>
                <textarea value={msgData.message} onChange={(e) => setMsgData((s) => ({ ...s, message: e.target.value }))} placeholder="How can I help?" rows={5} required className="w-full rounded-xl border border-border bg-bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
                <Button type="submit" disabled={submitting}>{submitting ? "Sending..." : "Send message"}</Button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(modal, document.body);
}
