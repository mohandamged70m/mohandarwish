"use client";

import { BookingModal } from "@/components/booking/BookingModal";

interface Props {
  onClose: () => void;
  initialTab?: string;
  hideTabs?: boolean;
}

// Admin-side booking modal (the old M-Contact). The visitor-facing BookingModal
// writes straight to the bookings/messages tables; the dashboard sync mirrors
// them into the Canary doc the inbox UI reads.
export default function MContact({ onClose, initialTab, hideTabs }: Props) {
  return (
    <BookingModal
      open
      onClose={onClose}
      initialTab={initialTab === "message" ? "message" : "meeting"}
      hideTabs={!!hideTabs}
    />
  );
}
