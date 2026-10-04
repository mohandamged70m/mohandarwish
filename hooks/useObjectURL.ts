"use client";

import { useEffect, useState } from "react";

// Returns an object URL for File/Blob inputs (revoked on change/unmount),
// or the string itself when already a URL.

export function useObjectURL(file: string | File | Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file || typeof file === "string") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl(typeof file === "string" ? file : null);
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  return url;
}
