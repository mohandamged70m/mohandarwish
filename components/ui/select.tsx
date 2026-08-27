"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Option = { label: string; value: string | number };

export function Select({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
}: {
  value: string | number;
  onChange: (v: string | number) => void;
  options: readonly Option[];
  placeholder?: string;
  ariaLabel?: string;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const label = options.find((o) => o.value === value)?.label ?? placeholder ?? "Select";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-bg-surface px-3 py-2.5 text-sm font-medium text-text-primary hover:border-border-strong focus-ring"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-border bg-bg-surface p-1 shadow-lg">
          {options.map((o) => (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition ${o.value === value ? "bg-accent text-text-on-accent" : "text-text-primary hover:bg-bg-surface-hover"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
