"use client";

import { useEffect, useState } from "react";
import type { StackChip } from "@/components/sections/stack/Stack";

type StackRow = {
  label: string;
  slug: string;
  bg: string;
  fg: string;
  icon_url: string | null;
};

async function fetchItems<T>(section: string): Promise<T[]> {
  const res = await fetch(`/api/profile/${section}`, { cache: "no-store" });
  if (!res.ok) return [];
  const json = (await res.json().catch(() => ({}))) as { items?: T[] };
  return json.items ?? [];
}

export function useProfile() {
  const [stack, setStack] = useState<StackChip[] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stk = await fetchItems<StackRow>("stack");
      if (cancelled) return;
      if (stk.length > 0)
        setStack(stk.map((c) => ({ label: c.label, slug: c.slug, bg: c.bg, fg: c.fg, iconUrl: c.icon_url })));
      else setStack([]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { stack };
}
