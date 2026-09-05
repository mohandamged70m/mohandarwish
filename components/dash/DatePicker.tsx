"use client";

import { X } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  isDark: boolean;
  placeholder?: string;
  allowClear?: boolean;
}

export default function DatePicker({ value, onChange, isDark, placeholder, allowClear }: Props) {
  return (
    <span className="input-container" style={{ display: "flex" }}>
      <input
        type="date"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="dashboard-input"
        style={{ colorScheme: isDark ? "dark" : "light", paddingRight: allowClear && value ? 34 : undefined }}
      />
      {allowClear && value ? (
        <button
          type="button"
          aria-label="Clear date"
          onClick={() => onChange("")}
          className="btn-icon"
          style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)" }}
        >
          <X size={14} />
        </button>
      ) : null}
    </span>
  );
}
