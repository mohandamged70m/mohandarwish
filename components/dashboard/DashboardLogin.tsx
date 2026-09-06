"use client";

import { signIn } from "next-auth/react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardLogin() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 py-20">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/20">
        <Shield className="h-6 w-6" />
      </div>
      <h1 className="font-heading text-xl font-semibold text-text-primary">Dashboard</h1>
      <p className="text-sm text-text-muted">Restricted to the owner account</p>
      <Button
        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        className="w-full"
      >
        Sign in with Google
      </Button>
    </div>
  );
}
