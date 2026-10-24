"use client";

import { useEffect } from "react";
import { analytics } from "@/lib/analytics/collect";

/**
 * Records a /book visit in Trails, the way <TrailsTracker> does for the portfolio.
 *
 * /book is its own route, so TrailsTracker (mounted in the root layout) already
 * starts the visit under the current section. This hook re-annotes the section as
 * "book" and listens for the revil:contact_sent event so a booking made here is
 * recorded as contactSubmit('book'), distinct from one made in the contact modal
 * ('meeting'). No Firebase is involved.
 */
export default function useBookTrail() {
	useEffect(() => {
		// The Collector's start() is called by TrailsTracker in the root layout.
		// Here we just record the contact submission when the booking flow fires it.
		const onSent = (e: Event) => {
			const d = (e as CustomEvent).detail as { kind?: string; via?: string } | undefined;
			if (d?.kind === "meeting") {
				analytics.contactSubmit(d.via === "book" ? "book" : "meeting");
			}
		};
		window.addEventListener("revil:contact_sent", onSent);
		return () => window.removeEventListener("revil:contact_sent", onSent);
	}, []);
}
