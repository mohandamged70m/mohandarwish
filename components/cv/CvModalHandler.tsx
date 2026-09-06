"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CvModal } from "./CvModal";

export function CvModalHandler(): ReactNode {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = (): void => setOpen(true);
    window.addEventListener("open-cv", onOpen);
    return () => window.removeEventListener("open-cv", onOpen);
  }, []);

  const onClose = useCallback(() => setOpen(false), []);

  return <CvModal open={open} onClose={onClose} />;
}
