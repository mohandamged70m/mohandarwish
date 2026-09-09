"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import Dashboard from "@/components/dashboard/Dashboard";

// Admin shell: ADMIN_TOKEN gate (same as before), then the full dashboard.
// On entry it mirrors bookings/messages/availability into the docs Canary
// reads, and keeps them fresh while the dashboard is open.

function useDashboardToken() {
  // Lazy init from storage so the mount effect below only verifies —
  // no setState-in-effect (react-hooks/set-state-in-effect).
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem("dashboard_token") ?? "";
    } catch {
      return "";
    }
  });
  const [authed, setAuthed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const verify = useCallback(async (t: string) => {
    const r = await fetch("/api/booking", { headers: { "x-admin-token": t } });
    if (r.ok) {
      setAuthed(true);
      localStorage.setItem("dashboard_token", t);
      // Mirror into a cookie so server routes/middleware (lib/admin.ts) can
      // read the same session. localStorage stays canonical for dash-db.
      document.cookie = `dashboard_token=${encodeURIComponent(t)}; Path=/; Max-Age=86400; SameSite=Lax`;
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    // Token field is prefilled by lazy useState init above; here we only
    // verify the persisted session (async callback, no sync setState).
    let saved = "";
    try {
      saved = localStorage.getItem("dashboard_token") ?? "";
    } catch {
      saved = "";
    }
    if (saved) {
      verify(saved).catch(() => {});
    }
  }, [verify]);

  const tryAuth = async () => {
    const ok = await verify(token).catch(() => false);
    if (!ok) {
      setToast("Wrong token");
      setTimeout(() => setToast(null), 3000);
    }
  };

  const logout = () => {
    localStorage.removeItem("dashboard_token");
    document.cookie = "dashboard_token=; Path=/; Max-Age=0; SameSite=Lax";
    setAuthed(false);
    setToken("");
  };

  return { token, setToken, authed, toast, tryAuth, logout };
}

export default function DashboardPage() {
  const { token, setToken, authed, toast, tryAuth, logout } = useDashboardToken();

  // Mirror site tables -> dashboard docs (Canary/Availability) on entry + interval.
  useEffect(() => {
    if (!authed) return;
    const t = localStorage.getItem("dashboard_token") ?? "";
    const sync = () => {
      fetch("/api/dashboard/sync", { method: "POST", headers: { "x-admin-token": t } }).catch(() => {});
    };
    sync();
    const id = setInterval(sync, 30000);
    return () => clearInterval(id);
  }, [authed]);

  if (!authed) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 py-20">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/20"><Shield className="h-6 w-6" /></div>
        <h1 className="font-heading text-xl font-semibold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-muted">Enter ADMIN_TOKEN from .env.local</p>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && tryAuth()}
          placeholder="ADMIN_TOKEN"
          type="password"
          className="w-full rounded-xl border border-border bg-bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <Button onClick={tryAuth} className="w-full">Enter</Button>
        {toast && <p className="text-sm text-red-500">{toast}</p>}
      </div>
    );
  }

  return <Dashboard onNavigate={(section) => { if (section === "home") logout(); }} />;
}
