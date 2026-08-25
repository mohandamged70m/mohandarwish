"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Calendar as CalendarIcon, ChevronDown, Clock3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CONTACT } from "@/Data/me";

type Status = "idle" | "loading" | "success" | "error";

/* 6 easy slots — curated, not 19. Lunch skip, easy to scan. All in ALLOWED_TIMES. */
const TIME_SLOTS = [
  { value: "09:00", label: "9:00 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "13:00", label: "1:00 PM" },
  { value: "14:30", label: "2:30 PM" },
  { value: "16:00", label: "4:00 PM" },
  { value: "17:30", label: "5:30 PM" },
] as const;

function toApiDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function displayDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
function getTomorrow() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() + 1);
  return t;
}

export function ContactForm(): ReactNode {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState("");

  const minDate = useMemo(() => getTomorrow(), []);
  const timezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  }, []);

  const validate = (): string | null => {
    if (!name.trim()) return "Please enter your name.";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return "Please enter a valid email.";
    if (!message.trim() || message.trim().length < 10)
      return "Message should be at least 10 characters.";
    if (open) {
      if (!date) return "Pick a date for the call.";
      if (!time) return "Pick a time.";
    }
    return null;
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = validate();
    if (v) {
      setErrorMsg(v);
      setStatus("error");
      return;
    }
    setStatus("loading");
    setErrorMsg(null);
    try {
      const payload: Record<string, string> = { name, email, message };
      if (open && date && time) {
        payload.preferredDate = toApiDate(date);
        payload.preferredTime = time;
        payload.timezone = timezone;
      }
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(d?.error ?? "Failed to send.");
      }
      setStatus("success");
      setName("");
      setEmail("");
      setMessage("");
      setDate(null);
      setTime("");
      setOpen(false);
      window.setTimeout(() => setStatus("idle"), 4000);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Something went wrong."
      );
      setStatus("error");
    }
  };

  const dateLabel = date ? displayDate(date) : "Pick a date";
  const timeLabel = TIME_SLOTS.find((s) => s.value === time)?.label;
  const hasSchedule = !!date && !!time;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex w-full flex-col gap-4"
      aria-label="Contact form"
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="contact-name"
          className="font-heading text-xs font-medium tracking-wide text-text-secondary"
        >
          Name
        </label>
        <input
          id="contact-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
          className="w-full rounded-xl border border-border bg-bg-primary px-4 py-3 font-body text-sm text-text-primary placeholder:text-text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 transition-colors"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="contact-email"
          className="font-heading text-xs font-medium tracking-wide text-text-secondary"
        >
          Email
        </label>
        <input
          id="contact-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
          type="email"
          className="w-full rounded-xl border border-border bg-bg-primary px-4 py-3 font-body text-sm text-text-primary placeholder:text-text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 transition-colors"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="contact-message"
          className="font-heading text-xs font-medium tracking-wide text-text-secondary"
        >
          Message
        </label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell me about your project, idea, or just say hi..."
          rows={4}
          className="w-full resize-none rounded-xl border border-border bg-bg-primary px-4 py-3 font-body text-sm leading-relaxed text-text-primary placeholder:text-text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 transition-colors"
          required
        />
      </div>

      {/* Calendar — book a ticket / schedule a call */}
      <div className="rounded-2xl border border-border bg-bg-primary">
        <button
          type="button"
          onClick={() => {
            const next = !open;
            setOpen(next);
            if (!next) {
              setDate(null);
              setTime("");
            }
          }}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
        >
          <span className="flex items-center gap-3">
            <span
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${open ? "border-accent bg-accent text-text-on-accent" : "border-border bg-bg-surface text-text-secondary"}`}
            >
              <CalendarIcon className="h-4 w-4" />
            </span>
            <span className="flex flex-col">
              <span className="font-heading text-sm font-medium tracking-tight text-text-primary">
                {open ? "Meeting time" : "Book a call?"}
              </span>
              <span className="font-body text-xs text-text-muted">
                {open
                  ? hasSchedule
                    ? `${dateLabel} · ${timeLabel} · ${timezone}`
                    : "Choose date & time — 30 min, optional"
                  : "Optional · 30 min · I’ll confirm in 24h"}
              </span>
            </span>
          </span>
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-bg-surface text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
          >
            <ChevronDown className="h-4 w-4" />
          </span>
        </button>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="border-t border-border p-4">
                {hasSchedule ? (
                  <div className="mb-3 flex items-center justify-between rounded-full border border-accent/20 bg-accent-soft px-3 py-2">
                    <span className="font-heading text-xs font-semibold text-accent-soft-text">
                      {dateLabel} · {timeLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDate(null);
                        setTime("");
                      }}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft-text/10 text-accent-soft-text hover:bg-accent-soft-text/15"
                      aria-label="Clear selection"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}

                <Calendar
                  selected={date}
                  onSelect={setDate}
                  minDate={minDate}
                />

                <div className="mt-4">
                  <p className="mb-2 flex items-center gap-1.5 font-heading text-xs font-medium text-text-secondary">
                    <Clock3 className="h-3.5 w-3.5 text-text-muted" /> Time{" "}
                    <span className="font-body font-normal text-text-muted">
                      — {timezone}
                    </span>
                  </p>
                  {!date ? (
                    <p className="rounded-xl border border-dashed border-border bg-bg-surface px-3 py-4 text-center font-body text-xs text-text-muted">
                      Pick a date first
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {TIME_SLOTS.map((s) => {
                        const active = time === s.value;
                        return (
                          <button
                            key={s.value}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setTime(s.value)}
                            className={[
                              "rounded-full border py-2.5 font-heading text-sm font-medium transition-colors focus-ring",
                              active
                                ? "border-accent bg-accent text-text-on-accent shadow-[0_0_10px_var(--accent-ring)]"
                                : "border-border bg-bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary",
                            ].join(" ")}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <p className="mt-3 text-center font-body text-[11px] text-text-muted">
                  No worries — you can skip this and just send a message.
                </p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {status === "error" && errorMsg ? (
        <p
          role="alert"
          className="rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 font-body text-xs leading-relaxed text-red-500"
        >
          {errorMsg}
        </p>
      ) : null}
      {status === "success" ? (
        <p
          role="status"
          className="rounded-xl border border-accent/20 bg-accent-soft px-3.5 py-2.5 font-body text-xs leading-relaxed text-accent-soft-text"
        >
          Sent — I&apos;ll reply within 24h
          {hasSchedule ? " and confirm the call" : ""}. Or email{" "}
          <a
            href={`mailto:${CONTACT.email}`}
            className="font-medium underline underline-offset-2"
          >
            {CONTACT.email}
          </a>
          .
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={status === "loading"}
        className="mt-1 w-full justify-center rounded-full py-3 text-sm shadow-[0_0_20px_var(--accent-ring)]"
      >
        {status === "loading"
          ? "Sending…"
          : status === "success"
            ? "Sent ✓"
            : hasSchedule
              ? "Send & request call"
              : "Send message"}
        {status === "idle" && !hasSchedule ? (
          <span aria-hidden className="ml-2 translate-y-px">
            →
          </span>
        ) : null}
      </Button>

      <p className="text-center font-body text-xs text-text-muted">
        Usually replies in{" "}
        <span className="font-medium text-text-secondary">24 hours</span> · No
        spam, ever.
      </p>
    </form>
  );
}
