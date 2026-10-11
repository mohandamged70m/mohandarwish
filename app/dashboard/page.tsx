import { Shield } from "lucide-react";
import { auth } from "@/auth";
import { isOwnerSession } from "@/lib/owner";
import DashboardClient from "./dashboard-client";
import { SignInButton, SignOutButton } from "./auth-buttons";

// Private owner page, enforced on the server: only the configured owner Gmail
// account (verified by Google) ever receives the dashboard UI. Everyone else
// gets the sign-in gate or the access-denied state — no private data included.
export const dynamic = "force-dynamic";

function GateShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 py-20">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/20">
        <Shield className="h-6 w-6" />
      </div>
      <h1 className="font-heading text-xl font-semibold text-text-primary">
        {title}
      </h1>
      <p className="text-center text-sm text-text-muted">{description}</p>
      <div className="flex w-full flex-col gap-2">{children}</div>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; s?: string }>;
}) {
  const session = await auth();
  if (isOwnerSession(session)) return <DashboardClient />;

  const params = await searchParams;
  // A "watch this visit" email link carries ?s=<visitId>. Thread it through
  // the sign-in hop so the story still opens after login (DashboardClient
  // parks it for D-Trails on arrival).
  const story =
    typeof params?.s === "string" && /^[a-z0-9-]{6,40}$/i.test(params.s)
      ? params.s
      : "";
  const callbackUrl = story ? `/dashboard?s=${encodeURIComponent(story)}` : "/dashboard";

  const denied = params?.error === "AccessDenied";
  if (denied) {
    return (
      <GateShell
        title="Access denied"
        description="That Google account is not the portfolio owner. Sign out and try again with the owner account."
      >
        <SignOutButton label="Sign out" />
        <SignInButton label="Try a different account" callbackUrl={callbackUrl} />
      </GateShell>
    );
  }

  return (
    <GateShell
      title="Dashboard"
      description="Owner-only. Sign in with Google to manage your portfolio."
    >
      <SignInButton callbackUrl={callbackUrl} />
    </GateShell>
  );
}
