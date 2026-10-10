"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import Dashboard from "@/components/dashboard/Dashboard";
import { STORY_KEY } from "@/components/dashboard/primitives/Algorithm";

// Authenticated owner shell. The server page already verified the Auth.js owner
// session before rendering this; the browser keeps no credentials — the
// HttpOnly session cookie travels automatically with same-origin requests.

export default function DashboardClient() {
  // "Watch this visit" in the link-open email lands here as /dashboard?s=<id>.
  // Park the id for D-Trails and drop it from the URL before anything else runs.
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

  // Mirror site tables -> dashboard docs (Canary/Availability) on entry + interval.
  useEffect(() => {
    const sync = () => {
      fetch("/api/dashboard/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
    };
    sync();
    const id = setInterval(sync, 30000);
    return () => clearInterval(id);
  }, []);

  const logout = () => {
    void signOut({ callbackUrl: "/" });
  };

  return (
    <Dashboard
      onNavigate={(section) => {
        if (section === "home") logout();
      }}
    />
  );
}
