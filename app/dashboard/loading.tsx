import { Shield } from "lucide-react";

// Shown while the server verifies the owner session for /dashboard.
export default function DashboardLoading() {
  return (
    <div
      role="status"
      aria-label="Checking owner session"
      className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 py-20"
    >
      <div className="inline-flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/20">
        <Shield className="h-6 w-6" />
      </div>
      <p className="text-sm text-text-muted">Checking owner session…</p>
    </div>
  );
}
