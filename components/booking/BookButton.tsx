"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { BookingModal } from "./BookingModal";

export function BookButton({ variant = "primary", label = "Book a call" }: { variant?: "primary" | "secondary"; label?: string }): ReactNode {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <BookingModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
