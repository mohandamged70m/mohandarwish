"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Code-split like the hero's booking button: the modal renders nothing
// while closed, so it stays out of the initial bundle (no SSR) on every
// route that embeds this handler. Prefetched on idle by the hero.
const BookingModal = dynamic(() => import("./BookingModal"), { ssr: false });

export function BookingHashHandler() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => {
      const h = window.location.hash;
      // legacy/hash deep-links (#booking, #contact) still open the modal.
      // The hash stays in the URL while open so the link remains shareable
      // and copyable; it is cleared on close (see onClose below).
      if (h === "#booking" || h === "#contact") {
        setOpen(true);
      }
    };
    // cross-page nav from elsewhere (nav stores this, URL stays "/")
    if (sessionStorage.getItem("pending-booking") === "1") {
      sessionStorage.removeItem("pending-booking");
      setOpen(true);
    }
    const openFromEvent = (): void => setOpen(true);
    check();
    window.addEventListener("hashchange", check);
    window.addEventListener("open-booking", openFromEvent);
    return () => {
      window.removeEventListener("hashchange", check);
      window.removeEventListener("open-booking", openFromEvent);
    };
  }, []);
  return <BookingModal open={open} onClose={() => { history.replaceState(null, "", window.location.pathname); setOpen(false); }} />;
}
