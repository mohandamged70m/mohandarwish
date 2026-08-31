"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AlertType } from "@/components/ui/alert";

type AlertShape = { show: boolean; type: AlertType; message: string; duration?: number } | null;
const EXIT_MS = 300;

export default function useSafeAlert(defaultDuration = 4000) {
  const [alert, setAlert] = useState<AlertShape>(null);
  const lastRef = useRef<{ message: string; type: AlertType; t: number } | null>(null);
  const visibleRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const showAlert = useCallback(
    (next: { type: AlertType; message: string; duration?: number }) => {
      const duration = typeof next.duration === "number" ? next.duration : defaultDuration;
      if (visibleRef.current) return;
      const last = lastRef.current;
      if (last && last.message === next.message && last.type === next.type && Date.now() - last.t < duration) return;
      lastRef.current = { message: next.message, type: next.type, t: Date.now() };
      visibleRef.current = true;
      setAlert({ show: true, type: next.type, message: next.message, duration });
      clearTimer();
      if (duration > 0) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          visibleRef.current = false;
          setAlert((prev) => (prev && prev.show ? { ...prev, show: false } : prev));
          lastRef.current = null;
        }, duration + EXIT_MS);
      }
    },
    [defaultDuration]
  );

  const hideAlert = useCallback(() => {
    clearTimer();
    visibleRef.current = false;
    lastRef.current = null;
    setAlert((prev) => (prev && prev.show ? { ...prev, show: false } : prev));
  }, []);

  useEffect(() => () => clearTimer(), []);
  return { alert, showAlert, hideAlert } as const;
}
