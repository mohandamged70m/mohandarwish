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
    const cleanUrl = (): void => {
      if (window.location.hash) {
        history.replaceState(null, "", window.location.pathname);
      }
    };
    const check = () => {
      const h = window.location.hash;
      // legacy/hash deep-links (#booking, #contact) still open the modal,
      // but the hash is stripped right away so the URL stays clean
      if (h === "#booking" || h === "#contact") {
        setOpen(true);
        cleanUrl();
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
