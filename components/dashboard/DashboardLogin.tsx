"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/dashboard",
    }).catch(() => null);
    setBusy(false);
    if (!res || res.error || !res.ok) {
      setError("Wrong email or password");
      return;
    }
    window.location.href = res.url || "/dashboard";
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 py-20">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/20">
        <Shield className="h-6 w-6" />
      </div>
      <h1 className="font-heading text-xl font-semibold text-text-primary">Dashboard</h1>
      <p className="text-sm text-text-muted">Sign in with your admin account</p>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Email"
        type="email"
        autoComplete="email"
        className="w-full rounded-xl border border-border bg-bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Password"
        type="password"
        autoComplete="current-password"
        className="w-full rounded-xl border border-border bg-bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
      />
      <Button onClick={submit} disabled={busy} className="w-full">
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
