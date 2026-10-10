"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import Dashboard from "@/components/dashboard/Dashboard";
import { STORY_KEY } from "@/components/dashboard/primitives/Algorithm";

// Owner shell: the server exchanges ADMIN_TOKEN for a signed HttpOnly session.
// On entry it mirrors bookings/messages/availability into the docs Canary
// reads, and keeps them fresh while the dashboard is open.

function useOwnerSession() {
  // The server session is authoritative; the browser never persists credentials.
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const verify = useCallback(async (t: string) => {
    const r = await fetch("/api/auth/owner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: t }),
    });
    const b = await r.json();
    if (!r.ok) {
      setToast(b.error || "Sign-in failed");
      return false;
    }
    localStorage.removeItem("dashboard_token");
    document.cookie = "dashboard_token=; Path=/; Max-Age=0";
    localStorage.setItem("owner_signed_in", "1");
    setToken("");
    setAuthed(true);
    return true;
  }, []);
  useEffect(() => {
    fetch("/api/auth/owner")
      .then((r) => r.json())
      .then((b) => {
        setAuthed(b.authenticated === true);
        if (b.authenticated) localStorage.setItem("owner_signed_in", "1");
        else localStorage.removeItem("owner_signed_in");
        localStorage.removeItem("dashboard_token");
        document.cookie = "dashboard_token=; Path=/; Max-Age=0";
      })
      .catch(() => setToast("Could not check your session"));
  }, []);
  const tryAuth = async () => {
    await verify(token).catch(() => setToast("Sign-in unavailable"));
  };

  // "Watch this visit" in the link-open email lands here as /dashboard?s=<id>. Park
  // the id for D-Trails, drop it from the URL, and let the normal token gate run —
  // the id is worthless without it. Parked before auth because the flag survives the
  // gate: signing in re-renders this component, and the claim must not be lost.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const story = params.get("s");
      if (!story || !/^[a-z0-9-]{6,40}$/i.test(story)) return;
      sessionStorage.setItem(STORY_KEY, story);
      params.delete("s");
      const rest = params.toString();
      window.history.replaceState(
        {},
        "",
        window.location.pathname + (rest ? `?${rest}` : ""),
      );
    } catch {
      /* private mode - the email link just lands on the dashboard normally */
    }
  }, []);

  const logout = async () => {
    try {
      const r = await fetch("/api/auth/owner", { method: "DELETE" });
      if (!r.ok) throw new Error();
      localStorage.removeItem("owner_signed_in");
      setAuthed(false);
      setToken("");
    } catch {
      setToast("Could not sign out. Please try again.");
    }
  };

  return { token, setToken, authed, toast, tryAuth, logout };
}

export default function DashboardPage() {
  const { token, setToken, authed, toast, tryAuth, logout } = useOwnerSession();

  // Mirror site tables -> dashboard docs (Canary/Availability) on entry + interval.
  useEffect(() => {
    if (!authed) return;
    const sync = () => {
      fetch("/api/dashboard/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
    };
    sync();
    const id = setInterval(sync, 30000);
    return () => clearInterval(id);
  }, [authed]);

  if (!authed) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 py-20">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/20">
          <Shield className="h-6 w-6" />
        </div>
        <h1 className="font-heading text-xl font-semibold text-text-primary">
          Dashboard
        </h1>
        <p className="text-sm text-text-muted">
          Sign in with your owner access key
        </p>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && tryAuth()}
          placeholder="Owner access key"
          type="password"
          className="w-full rounded-xl border border-border bg-bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <Button onClick={tryAuth} className="w-full">
          Enter
        </Button>
        {toast && <p className="text-sm text-red-500">{toast}</p>}
      </div>
    );
  }

  return (
    <>
      {toast && (
        <p
          role="alert"
          className="fixed top-2 right-2 z-50 rounded bg-red-950 px-4 py-2 text-white"
        >
          {toast}
        </p>
      )}
      <Dashboard
        onNavigate={(section) => {
          if (section === "home") void logout();
        }}
      />
    </>
  );
}
