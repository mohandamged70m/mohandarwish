"use client";

import { useEffect, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

// Authenticated dashboard shell: mirrors bookings/messages/availability into
// the docs the Canary UI reads (cookie session authenticates the call),
// and provides a sign-out button above the dashboard.
export function DashboardShell({ email, children }: { email: string; children: ReactNode }) {
  useEffect(() => {
    // Session cookie is sent automatically (same-origin fetch).
    const sync = () => {
      fetch("/api/dashboard/sync", { method: "POST" }).catch(() => {});
    };
    sync();
    const id = setInterval(sync, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <div className="mx-auto flex w-full max-w-7xl items-center justify-end gap-3 px-4 pt-4 sm:px-6 lg:px-8">
        <span className="font-heading text-[11px] uppercase tracking-[0.14em] text-text-muted">{email}</span>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/dashboard" })}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-surface px-3 py-1.5 font-heading text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
      {children}
    </div>
  );
}
