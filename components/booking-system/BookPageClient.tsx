"use client";

import dynamic from "next/dynamic";

// `ssr: false` is only valid inside a Client Component. Keeping it here lets
// app/book/page.tsx stay a Server Component (its h1 + noscript remain in the
// initial HTML) while the booking app itself loads in the browser only.
export default dynamic(() => import("./BookPage"), { ssr: false });
