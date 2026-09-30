"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";

// Code-split like the hero's booking button: the modal renders nothing
// while closed, so it stays out of the initial bundle (no SSR).
const BookingModal = dynamic(() => import("./BookingModal"), { ssr: false });

function prefetchBookingModal() {
  void import("./BookingModal");
}

export function BookButton({ variant = "primary", label = "Book a call" }: { variant?: "primary" | "secondary"; label?: string }): ReactNode {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} onMouseEnter={prefetchBookingModal} onFocus={prefetchBookingModal} data-track="contact-open">
        {label}
      </Button>
      <BookingModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
