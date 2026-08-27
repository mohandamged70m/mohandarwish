"use client";

import { useEffect, useState } from "react";
import { Trash2, Calendar as CalIcon, Mail, Clock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ALL_HOURS, DEFAULT_AVAILABILITY, WEEKDAY_LABELS, formatHourSlot, type AvailabilityConfig } from "@/lib/availability";

type Booking = {
  id: string;
  date: string;
  time: string;
  name: string;
  email: string;
  reason: string | null;
  meeting_link: string | null;
  google_event_id: string | null;
  created_at: string;
};
type Message = {
  id: string;
  name: string;
  email: string;
  message: string;
  number: string | null;
  has_whatsapp: boolean;
  created_at: string;
};

export default function DashboardPage() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"bookings" | "messages" | "hours">("bookings");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [avail, setAvail] = useState<AvailabilityConfig>(DEFAULT_AVAILABILITY);
  const [tz, setTz] = useState("UTC+02:00 (EET)");
  const [toast, setToast] = useState<string | null>(null);

  const fetchAll = async (t: string) => {
    const h = { "x-admin-token": t };
    const [b, m, a] = await Promise.all([
      fetch("/api/booking", { headers: h }).then((r) => r.json().catch(() => ({ bookings: [] }))),
      fetch("/api/messages", { headers: h }).then((r) => r.json().catch(() => ({ messages: [] }))),
      fetch("/api/availability").then((r) => r.json().catch(() => ({}))),
    ]);
    if (b.bookings) setBookings(b.bookings);
    if (m.messages) setMessages(m.messages);
    if (a.workingDays && a.hours) {
      setAvail({ workingDays: a.workingDays, hours: a.hours });
      if (a.timezone) setTz(a.timezone);
    }
  };

  const tryAuth = async () => {
    const r = await fetch("/api/booking", { headers: { "x-admin-token": token } });
    if (r.ok || r.status === 200) {
      setAuthed(true);
      fetchAll(token);
      localStorage.setItem("dashboard_token", token);
    } else {
      setToast("Wrong token");
      setTimeout(() => setToast(null), 3000);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("dashboard_token");
    if (saved) {
      setToken(saved);
      fetch("/api/booking", { headers: { "x-admin-token": saved } }).then((r) => {
        if (r.ok) {
          setAuthed(true);
          fetchAll(saved);
        }
      });
    }
    fetch("/api/availability").then((r) => r.json()).then((j) => {
      if (j.workingDays) setAvail({ workingDays: j.workingDays, hours: j.hours });
      if (j.timezone) setTz(j.timezone);
    }).catch(() => {});
  }, []);

  const delBooking = async (id: string) => {
    await fetch(`/api/booking/${id}`, { method: "DELETE", headers: { "x-admin-token": token } });
    setBookings((b) => b.filter((x) => x.id !== id));
  };
  const delMessage = async (id: string) => {
    await fetch(`/api/messages/${id}`, { method: "DELETE", headers: { "x-admin-token": token } });
    setMessages((m) => m.filter((x) => x.id !== id));
  };
  const saveAvail = async () => {
    const r = await fetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ workingDays: avail.workingDays, hours: avail.hours, timezone: tz }),
    });
    setToast(r.ok ? "Saved ✓" : "Save failed");
    setTimeout(() => setToast(null), 3000);
  };

  if (!authed) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 py-20">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/20"><Shield className="h-6 w-6" /></div>
        <h1 className="font-heading text-xl font-semibold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-muted">Enter ADMIN_TOKEN from .env.local</p>
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="ADMIN_TOKEN" className="w-full rounded-xl border border-border bg-bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
        <Button onClick={tryAuth} className="w-full">Enter</Button>
        {toast && <p className="text-sm text-red-500">{toast}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-text-primary">Dashboard</h1>
        <Button variant="secondary" onClick={() => { localStorage.removeItem("dashboard_token"); setAuthed(false); setToken(""); }}>Logout</Button>
      </div>
      {toast && <div className="mb-4 rounded-xl bg-accent px-4 py-2 text-sm text-text-on-accent">{toast}</div>}
      <div className="mb-6 flex gap-2">
        {(["bookings", "messages", "hours"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize ${tab === t ? "bg-accent text-text-on-accent" : "border border-border bg-bg-surface text-text-secondary"}`}>{t}</button>
        ))}
      </div>

      {tab === "bookings" && (
        <div className="grid gap-3">
          {bookings.length === 0 && <Card><p className="text-sm text-text-muted">No bookings yet.</p></Card>}
          {bookings.map((b) => (
            <Card key={b.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-text-primary"><CalIcon className="h-4 w-4 text-accent" /> {b.date} at {b.time} · {b.name} <span className="text-text-muted">· {b.email}</span></div>
                {b.reason && <p className="text-sm text-text-secondary">{b.reason}</p>}
                {b.meeting_link && <a href={b.meeting_link} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline">Join Meet</a>}
              </div>
              <Button variant="secondary" onClick={() => delBooking(b.id)} className="gap-2"><Trash2 className="h-4 w-4" /> Cancel</Button>
            </Card>
          ))}
        </div>
      )}

      {tab === "messages" && (
        <div className="grid gap-3">
          {messages.length === 0 && <Card><p className="text-sm text-text-muted">No messages.</p></Card>}
          {messages.map((m) => (
            <Card key={m.id} className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-text-primary"><Mail className="h-4 w-4 text-accent" /> {m.name} · {m.email} <span className="text-xs text-text-muted">{new Date(m.created_at).toLocaleString()}</span></div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{m.message}</p>
                {m.number && <p className="text-xs text-text-muted">Phone: {m.number} {m.has_whatsapp ? "(WhatsApp)" : ""}</p>}
              </div>
              <Button variant="secondary" onClick={() => delMessage(m.id)} className="gap-2"><Trash2 className="h-4 w-4" /> Delete</Button>
            </Card>
          ))}
        </div>
      )}

      {tab === "hours" && (
        <Card className="space-y-4">
          <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4 text-accent" /> Availability</CardTitle>
          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">Working days</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_LABELS.map((w, i) => {
                const on = avail.workingDays.includes(i);
                return (
                  <button key={w} onClick={() => setAvail((a) => ({ ...a, workingDays: on ? a.workingDays.filter((x) => x !== i) : [...a.workingDays, i].sort((x, y) => x - y) }))} className={`rounded-full px-3 py-1.5 text-sm font-medium ${on ? "bg-accent text-text-on-accent" : "border border-border bg-bg-primary text-text-secondary"}`}>{w}</button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">Hours (host local)</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {ALL_HOURS.map((h) => {
                const on = avail.hours.includes(h);
                return (
                  <button key={h} onClick={() => setAvail((a) => ({ ...a, hours: on ? a.hours.filter((x) => x !== h) : [...a.hours, h].sort((x, y) => x - y) }))} className={`rounded-xl px-2 py-2 text-xs font-medium ${on ? "bg-accent text-text-on-accent" : "border border-border bg-bg-primary text-text-muted"}`}>{formatHourSlot(h)}</button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Timezone string</label>
            <input value={tz} onChange={(e) => setTz(e.target.value)} placeholder="UTC+02:00 (EET)" className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none" />
            <p className="mt-1 text-xs text-text-muted">Format UTC±HH:MM (EET)</p>
          </div>
          <Button onClick={saveAvail}>Save availability</Button>
        </Card>
      )}
    </div>
  );
}
