"use client";

interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  "aria-label"?: string;
  color?: string;
}

// Styled by the .toggle-switch / .toggle-knob rules in globals.css.
export default function Toggle({ checked, onChange, "aria-label": ariaLabel, color }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`toggle-switch${checked ? " active" : ""}`}
      style={checked && color ? { backgroundColor: color } : undefined}
    >
      <span className="toggle-knob" />
    </button>
  );
}
