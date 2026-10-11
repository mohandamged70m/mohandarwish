"use client";

import { useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

// Google sign-in/out buttons for the owner dashboard gate. Pending states keep
// the redirect (Google, then back to /dashboard) from looking stuck.

export function SignInButton({ label = "Sign in with Google", callbackUrl = "/dashboard" }: { label?: string; callbackUrl?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      className="w-full"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void signIn("google", { callbackUrl }).catch(() =>
          setPending(false),
        );
      }}
    >
      {pending ? "Redirecting to Google…" : label}
    </Button>
  );
}

export function SignOutButton({ label = "Sign out" }: { label?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="secondary"
      className="w-full"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void signOut({ callbackUrl: "/" }).catch(() => setPending(false));
      }}
    >
      {pending ? "Signing out…" : label}
    </Button>
  );
}
