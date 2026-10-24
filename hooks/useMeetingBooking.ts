"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type React from "react";
import {
	BOOKING_WINDOW_DAYS, DAY_MS, DEFAULT_HOST_TZ, type DayContext, type PresetSlot,
	bookingRefusal, customTimeRefusal, dayIndex, dayIndexAt, isDayOpen, meetingInstant,
	presetSlotsForDay, utcOffsetHours, visitorTimeToInstant, wallClock,
} from "@/lib/booking-rules";
import { AvailabilityConfig, DEFAULT_AVAILABILITY, parseAvailabilityConfig, rememberHostStatus, seedHostStatus } from "@/lib/booking-availability";
import { timezoneOptions, localOffset } from "@/lib/booking-timezones";
import { isValidEmail } from "@/lib/validate";

export const isBookingEmail = (s: string) => isValidEmail(s);

export interface Meeting {
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

interface BookMeetingResponse {
	ok?: boolean;
	id?: string;
	link?: string;
	date?: string;
	time?: string;
	error?: string;
}

type ShowAlert = (next: { type: "info" | "success" | "warning" | "error"; message: string; duration?: number }) => void;

type BookingVia = "book" | "contact";

/** The calendar's day cells are local Dates; only their y/m/d matter (the visitor's day). */
const dayOf = (date: Date) => dayIndex(date.getFullYear(), date.getMonth(), date.getDate());
const dateOfDay = (day: number) => {
	const u = new Date(day * DAY_MS);
	return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
};

export const getDaysInMonth = (date: Date) => {
	const year = date.getFullYear();
	const month = date.getMonth();
	const days = new Date(year, month + 1, 0).getDate();
	const firstDay = new Date(year, month, 1).getDay();
	return { days, firstDay };
};

export default function useMeetingBooking({
	showAlert,
	enabled = true,
	via = "contact",
}: { showAlert: ShowAlert; enabled?: boolean; via?: BookingVia }) {
	const [calendarDate, setCalendarDate] = useState(new Date());
	const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
	const [selectedTime, setSelectedTime] = useState<string | null>(null);
	const [isCustomTime, setIsCustomTime] = useState(false);
	const [meetingData, setMeetingData] = useState({ name: "", email: "", reason: "" });
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [existingMeetings, setExistingMeetings] = useState<Meeting[]>([]);
	const [bookingSuccess, setBookingSuccess] = useState<{ date: string; time: string; link: string } | null>(null);

	// Timezone States
	const [hostSeed] = useState(seedHostStatus);
	const [hostTimezoneString, setHostTimezoneString] = useState(hostSeed["Current Time"] || DEFAULT_HOST_TZ);
	const [hostAvailability, setHostAvailability] = useState<unknown>(hostSeed["Current Availability"]);
	const [userTimezone, setUserTimezone] = useState<number>(localOffset);
	const tzOptions = useMemo(() => timezoneOptions(), []);

	// The visitor's today, in the timezone they picked - the same "today" the submit
	// path measures the 45-day window from.
	const [openedAt] = useState(() => Date.now());
	const today = useMemo(() => dateOfDay(dayIndexAt(openedAt, userTimezone)), [openedAt, userTimezone]);

	const limitDate = useMemo(() => {
		const d = new Date(today);
		d.setDate(d.getDate() + BOOKING_WINDOW_DAYS);
		return d;
	}, [today]);

	const isPrevMonthDisabled = useMemo(() => {
		const prevM = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
		const currentMStart = new Date(today.getFullYear(), today.getMonth(), 1);
		return prevM < currentMStart;
	}, [calendarDate, today]);

	const isNextMonthDisabled = useMemo(() => {
		const nextM = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
		return nextM > limitDate;
	}, [calendarDate, limitDate]);

	const isFutureMonth = useMemo(() => {
		return (
			calendarDate.getFullYear() > today.getFullYear() ||
			(calendarDate.getFullYear() === today.getFullYear() && calendarDate.getMonth() > today.getMonth())
		);
	}, [calendarDate, today]);

	// New day: drop the previous booking success and clear the picked time.
	const [prevDate, setPrevDate] = useState(selectedDate);
	if (prevDate !== selectedDate) {
		setPrevDate(selectedDate);
		setBookingSuccess(null);
		setSelectedTime(null);
		setIsCustomTime(false);
	}

	// Timezone switch: the stored time string no longer matches any visible button.
	const [prevTimezone, setPrevTimezone] = useState(userTimezone);
	if (prevTimezone !== userTimezone) {
		setPrevTimezone(userTimezone);
		setSelectedTime(null);
		setIsCustomTime(false);
	}

	// Host working days + hours (edited from the dashboard → Convex availability).
	const [availConfig, setAvailConfig] = useState<AvailabilityConfig>(DEFAULT_AVAILABILITY);
	const [availLoaded, setAvailLoaded] = useState(false);
	const [slotsLoaded, setSlotsLoaded] = useState(false);

	// Sync Host Availability & Timezone from /api/availability (Convex).
	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			try {
				const r = await fetch("/api/availability");
				const data = (await r.json()) as { workingDays?: number[]; hours?: number[]; timezone?: string };
				if (cancelled) return;
				if (typeof data.timezone === "string" && data.timezone) {
					setHostTimezoneString(data.timezone);
				}
				setHostAvailability(data);
				rememberHostStatus(data as Record<string, unknown>);
				setAvailConfig(parseAvailabilityConfig(data));
			} catch {
				if (!cancelled) setAvailConfig(DEFAULT_AVAILABILITY);
			}
			if (!cancelled) setAvailLoaded(true);
		};
		load();
		const id = setInterval(load, 10000);
		return () => {
			cancelled = true;
			clearInterval(id);
		};
	}, []);

	// Read busy slots from /api/booked-slots (Convex).
	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			try {
				const r = await fetch("/api/booked-slots");
				const data = (await r.json()) as { slots?: Array<{ date?: string; time?: string }> };
				if (cancelled) return;
				const slots = (data.slots || []).filter((s) => s && s.date && s.time);
				const meetingsList = slots.map((s): Meeting => ({
					Date: s.date!,
					Time: s.time!,
					Name: "",
					Email: "",
					dateObj: new Date(s.date!),
				}));
				setExistingMeetings(meetingsList);
			} catch {
				if (!cancelled) setExistingMeetings([]);
			}
			if (!cancelled) setSlotsLoaded(true);
		};
		load();
		const id = setInterval(load, 10000);
		return () => {
			cancelled = true;
			clearInterval(id);
		};
	}, []);

	const formatDateDDMMYYYY = useCallback((date: Date) => {
		const day = date.getDate().toString().padStart(2, "0");
		const month = (date.getMonth() + 1).toString().padStart(2, "0");
		const year = date.getFullYear();
		return `${day}/${month}/${year}`;
	}, []);

	const hostOffset = utcOffsetHours(hostTimezoneString);

	// Everything the booking rules need, read fresh on each call.
	const dayContext = useCallback((): DayContext => ({
		nowMs: Date.now(), userTimezone, hostOffset, cfg: availConfig, meetings: existingMeetings,
	}), [userTimezone, hostOffset, availConfig, existingMeetings]);

	/** Bookings that start on this visitor day (the calendar's "booked" dots). */
	const getMeetingsForDate = useCallback((date: Date) => {
		const day = dayOf(date);
		return existingMeetings.filter((m) => {
			const at = meetingInstant(m, hostOffset);
			return at !== null && dayIndexAt(at, userTimezone) === day;
		});
	}, [existingMeetings, hostOffset, userTimezone]);

	/** A booked meeting's start time, as the visitor sees it. */
	const meetingTimeForVisitor = useCallback((m: Meeting) => {
		const at = meetingInstant(m, hostOffset);
		return at === null ? m.Time : wallClock(at, userTimezone).time;
	}, [hostOffset, userTimezone]);

	/** The owner's preset slots that fall on this visitor day, each marked taken/passed. */
	const daySlots = useCallback((date: Date): PresetSlot[] => presetSlotsForDay(dayOf(date), dayContext()), [dayContext]);

	// The selected day's preset times, as the visitor sees them.
	const convertedSlots = useMemo(() => (selectedDate ? daySlots(selectedDate).map((s) => s.label) : []), [selectedDate, daySlots]);

	/** A day the visitor can pick: inside the booking window, with a preset slot still free. */
	const isDayBookable = useCallback((date: Date) => isDayOpen(dayOf(date), dayContext()), [dayContext]);

	// Automatically find the next available day ONCE, when the booking view first shows.
	const hasAutoMoved = useRef(false);
	useEffect(() => {
		if (!selectedDate || !enabled || hasAutoMoved.current || !availLoaded || !slotsLoaded) return;

		const checkAvailable = isDayBookable;

		if (selectedDate < today || !checkAvailable(selectedDate)) {
			let searchDate = new Date(selectedDate);
			if (searchDate < today) searchDate = new Date(today);

			let found = false;
			for (let i = 0; i < 30; i++) {
				if (checkAvailable(searchDate)) {
					found = true;
					break;
				}
				searchDate.setDate(searchDate.getDate() + 1);
			}

			if (found && searchDate.toDateString() !== selectedDate.toDateString()) {
				// eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot move to the next open day, latches via hasAutoMoved
				setSelectedDate(searchDate);
				setCalendarDate(searchDate);
			}
		}
		hasAutoMoved.current = true;
	}, [selectedDate, isDayBookable, today, enabled, availLoaded, slotsLoaded]);

	useEffect(() => {
		return () => { hasAutoMoved.current = false; };
	}, []);

	const trailsRef = (): { sid: string; sub: string } | undefined => {
		try {
			const sid =
				(window as unknown as { __trails?: { sid?: () => string } }).__trails?.sid?.() || "";
			if (!sid) return undefined;
			const sub =
				typeof crypto?.randomUUID === "function"
					? crypto.randomUUID()
					: `sub-${Date.now()}-${Math.random().toString(36).slice(2)}`;
			return { sid, sub: sub.slice(0, 64) };
		} catch {
			return undefined;
		}
	};

	const handleMeetingSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!selectedDate || !selectedTime) return;

		// Guard: the selected slot must still be on offer.
		const startMs = visitorTimeToInstant(dayOf(selectedDate), selectedTime, userTimezone);
		const notOffered = !isCustomTime && !convertedSlots.includes(selectedTime);
		const refusal = startMs === null ? "Invalid meeting time." : bookingRefusal(startMs, dayContext());
		if (notOffered || refusal || startMs === null) {
			setSelectedTime(null);
			setIsCustomTime(false);
			showAlert({ type: "warning", message: refusal || "That time slot is no longer available. Please pick another." });
			return;
		}
		if (!meetingData.email || !isBookingEmail(meetingData.email)) {
			showAlert({ type: "error", message: "Please enter a valid email address." });
			return;
		}

		setIsSubmitting(true);

		try {
			// 1. The instant the visitor picked: their day + time, in the timezone they chose.
			const startDateUTC = new Date(startMs);
			const endDateUTC = new Date(startDateUTC.getTime() + 3600000); // 30-minute call → 1h slot for Convex API

			// 2. Book it via the Convex-backed /api/booking route.
			const ref = trailsRef();
			const r = await fetch("/api/booking", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: meetingData.name,
					email: meetingData.email.trim(),
					reason: meetingData.reason,
					startTime: startDateUTC.toISOString(),
					endTime: endDateUTC.toISOString(),
					userTimezone,
					selectedTime,
					...(ref ? { trails: ref } : {}),
				}),
			});
			const j = (await r.json()) as BookMeetingResponse;
			if (!r.ok) throw new Error(j.error || "Booking failed");
			const meetLink = j.link || "";

			window.dispatchEvent(
				new CustomEvent("revil:contact_sent", { detail: { kind: "meeting", via } }),
			);

			// Confirm to the GUEST in their own perspective.
			setBookingSuccess({ date: formatDateDDMMYYYY(selectedDate), time: selectedTime || "", link: meetLink || "" });
			setMeetingData({ name: "", email: "", reason: "" });

			// refresh slots
			fetch("/api/booked-slots")
				.then((rr) => rr.json())
				.then((jj) => {
					const slots = (jj as { slots?: Array<{ date: string; time: string }> }).slots || [];
					setExistingMeetings(
						slots.filter((s) => s && s.date && s.time).map((s) => ({
							Date: s.date,
							Time: s.time,
							Name: "",
							Email: "",
							dateObj: new Date(s.date),
						})),
					);
				})
				.catch(() => {});
		} catch (error: unknown) {
			console.error("Booking Error", error);
			const err = error as { message?: string };
			const msg = err.message?.includes("Invalid attendee email")
				? "Invalid Email Address provided."
				: err.message || "Could not book meeting";
			showAlert({ type: "error", message: msg });
		} finally {
			setIsSubmitting(false);
		}
	};

	// Validate a proposed custom (free) time with the same rules the submit path applies.
	const validateCustomTime = useCallback((t: string): string | null => {
		if (!selectedDate) return null;
		const at = visitorTimeToInstant(dayOf(selectedDate), t, userTimezone);
		return at === null ? "Invalid time." : customTimeRefusal(at, dayContext());
	}, [selectedDate, userTimezone, dayContext]);

	const isCustomTimeUnavailable = useCallback((t: string): boolean => validateCustomTime(t) !== null, [validateCustomTime]);

	return {
		today, limitDate,
		calendarDate, setCalendarDate, isPrevMonthDisabled, isNextMonthDisabled, isFutureMonth,
		selectedDate, setSelectedDate, selectedTime, setSelectedTime, isCustomTime, setIsCustomTime,
		meetingData, setMeetingData, isSubmitting, bookingSuccess, setBookingSuccess,
		userTimezone, setUserTimezone, tzOptions, hostTimezoneString, hostAvailability,
		availConfig, convertedSlots, daySlots,
		loaded: availLoaded && slotsLoaded,
		getMeetingsForDate, meetingTimeForVisitor, isDayBookable,
		handleMeetingSubmit, validateCustomTime, isCustomTimeUnavailable,
	};
}
