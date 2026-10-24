'use client'

import dynamic from 'next/dynamic'

// Client-only like the booking system: the calendar, the time zones and the paint
// all depend on the visitor's clock and the DOM, so a build-time render would only
// mismatch. BookPage lives in components/booking-system (mined from ./booking-system,
// adapted to Convex — no Firebase).
const BookPage = dynamic(() => import('@/components/booking-system/BookPage'), { ssr: false })

export default function Page() {
  return (
    <>
      {/* GEO fallback: crawlers and AI agents that don't run JavaScript only see this
          and the JSON-LD from layout.tsx. Keep it in step with that JSON-LD. */}
      <noscript>
        <article style={{ padding: 24, maxWidth: 760, margin: '0 auto', fontFamily: 'Inter, sans-serif', lineHeight: 1.7 }}>
          <h1>Book a call with Mohand Darwish</h1>
          <p>
            Book a free 30 minute Google Meet call with Mohand Darwish, a software engineer
            and AI product builder based in Alexandria, Egypt. Talk about a project you want
            built, a role, a collaboration or a podcast.
          </p>
          <ul>
            <li>Length: 30 minutes</li>
            <li>Where: Google Meet (the link is emailed with the invite)</li>
            <li>Cost: free</li>
            <li>Time zone: slots are shown in your own time zone</li>
          </ul>
          <h2>How to book</h2>
          <ol>
            <li>Pick an open date on the calendar.</li>
            <li>Choose a time slot, or set a custom time.</li>
            <li>Enter your name, your email and what the call is about.</li>
            <li>Press Book. The calendar invite and Meet link arrive by email.</li>
          </ol>
          <p>
            The booking calendar needs JavaScript. Without it, email{' '}
            <a href="mailto:hello@mohanddarwish.com">hello@mohanddarwish.com</a> to set up a
            call, or see the portfolio at <a href="https://mohanddarwish.vercel.app">mohanddarwish.vercel.app</a>.
          </p>
        </article>
      </noscript>
      <BookPage />
    </>
  )
}
