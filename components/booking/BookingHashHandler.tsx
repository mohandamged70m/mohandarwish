"use client";

import { useEffect, useState } from "react";
import { BookingModal } from "./BookingModal";

export function BookingHashHandler() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => {
      const h = window.location.hash;
      // support legacy #contact deep-links — unify to booking modal
      setOpen(h === "#booking" || h === "#contact");
      if (h === "#contact") {
        // silently upgrade legacy hash
        history.replaceState(null, "", "#booking");
      }
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);
  return <BookingModal open={open} onClose={() => { history.pushState(null, "", window.location.pathname); setOpen(false); }} />;
}
