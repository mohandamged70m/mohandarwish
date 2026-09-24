"use client";

import { useEffect, useState, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { ReducedMotionProvider, isMotionForced } from "@/lib/motion";
import { SmoothScroll } from "@/components/layouts/smooth-scroll";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: ReactNode }): ReactNode {
  // ?motion=full forces motion components on for previewing on a
  // reduce-motion machine (motion's useReducedMotion then returns false).
  const [forced, setForced] = useState(false);
  useEffect(() => {
    try {
      setForced(isMotionForced());
    } catch {
      // non-fatal: fall back to respecting the OS setting
    }
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <MotionConfig reducedMotion={forced ? "never" : "user"}>
        <ReducedMotionProvider>
          <SmoothScroll>{children}</SmoothScroll>
        </ReducedMotionProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
