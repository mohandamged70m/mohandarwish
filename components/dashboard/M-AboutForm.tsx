"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export type AboutSection = "experience" | "education" | "skills" | "stack";
export type AboutItem = Record<string, unknown> & { id: string; sort_order: number; is_visible: boolean };

const EMPTY: Record<AboutSection, Record<string, string>> = {
  experience: { company: "", role: "", period: "", start_date: "", end_date: "", slug: "", brand: "", location: "", description: "", link: "" },
  education: { school: "", degree: "", period: "", start_date: "", end_date: "", slug: "", link: "" },
  skills: { label: "" },
  stack: { label: "", slug: "", bg: "#1f1f1f", fg: "#ffffff", icon_url: "" },
};

interface Props {
  isOpen: boolean;
  section: AboutSection;
  initialData?: AboutItem | null;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}

export function emptyForm(section: AboutSection): Record<string, string> {
  return { ...EMPTY[section] };
}

export function formFromItem(section: AboutSection, it: AboutItem): Record<string, string> {
  const base = { ...EMPTY[section] };
  for (const k of Object.keys(base)) {
    const v = it[k];
    base[k] = v === null || v === undefined ? "" : String(v);
  }
  return base;
}

export default function MAboutForm({ isOpen, section, initialData, saving, onClose, onSave }: Props) {
  const [form, setForm] = useState<Record<string, string>>(() => ({ ...EMPTY[section] }));
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        setForm(initialData ? formFromItem(section, initialData) : { ...EMPTY[section] });
      });
    }
  }, [isOpen, section, initialData]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => firstInputRef.current?.focus(), 120);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const field = (k: string, label: string, opts?: { type?: string; placeholder?: string; textarea?: boolean; autofocus?: boolean; hint?: string }) => (
    <div key={k}>
      <label className="dashboard-label">{label}</label>
      {opts?.textarea ? (
        <textarea value={form[k] ?? ""} onChange={(e) => set(k, e.target.value)} rows={3} placeholder={opts.placeholder} className="dashboard-input" />
      ) : (
        <input
          ref={opts?.autofocus ? firstInputRef : undefined}
          type={opts?.type ?? "text"}
          value={form[k] ?? ""}
          onChange={(e) => set(k, e.target.value)}
          placeholder={opts?.placeholder}
          className="dashboard-input"
        />
      )}
      {opts?.hint && <p className="text-xs text-muted mt-1.5 leading-relaxed">{opts.hint}</p>}
    </div>
  );

  const titles: Record<AboutSection, string> = {
    experience: "Experience",
    education: "Education",
    skills: "Skill",
    stack: "Stack item",
  };

  const submit = () => {
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(form)) payload[k] = v.trim() === "" ? null : v.trim();
    onSave(payload);
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1100] flex items-center justify-center animate-fade-in p-4" onClick={onClose}>
      <div
        className="glass-panel w-full max-w-[560px] max-h-[90vh] overflow-y-auto custom-scrollbar animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: "var(--section-border)" }}>
          <h2 className="heading-md text-base sm:text-lg">{initialData ? `Edit ${titles[section]}` : `Add ${titles[section]}`}</h2>
          <button onClick={onClose} aria-label="Close" className="p-2 text-muted hover:text-primary cursor-pointer"><X size={20} /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          {section === "experience" && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {field("company", "Company *", { autofocus: true, hint: "Bold title on the card, e.g. Freelance." })}
                {field("role", "Role *", { hint: "Job title shown under the company." })}
                {field("period", "Period *", { placeholder: "Jan 2023 – Present", hint: "Display text next to the role." })}
                {field("location", "Location", { hint: "Optional city or Remote." })}
                {field("start_date", "Start date", { type: "date", hint: "Optional, for sorting. Not shown on site." })}
                {field("end_date", "End date (empty = present)", { type: "date", hint: "Leave empty for a current role." })}
                {field("slug", "Icon slug", { placeholder: "github", hint: "Simpleicons name for the logo. Empty shows the first letter." })}
                {field("brand", "Brand color", { placeholder: "#AD2831", hint: "Background behind the letter when no icon is set." })}
              </div>
              {field("link", "Link", { hint: "Optional website for this role." })}
              {field("description", "Description", { textarea: true, hint: "Optional longer text about what you did." })}
            </>
          )}
          {section === "education" && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {field("school", "School *", { autofocus: true, hint: "Bold title, e.g. Alexandria University." })}
                {field("degree", "Degree *", { hint: "Program or focus shown under the school." })}
                {field("period", "Period *", { placeholder: "2019 – 2023", hint: "Display text next to the degree." })}
                {field("slug", "Icon slug", { hint: "Simpleicons name. Empty shows the first letter." })}
                {field("start_date", "Start date", { type: "date", hint: "Optional, for sorting. Not shown on site." })}
                {field("end_date", "End date", { type: "date", hint: "Leave empty if still studying." })}
              </div>
              {field("link", "Link", { hint: "Optional school or certificate page." })}
            </>
          )}
          {section === "skills" && field("label", "Label *", { placeholder: "React / Next.js", autofocus: true, hint: "One pill on the site. Keep it short." })}
          {section === "stack" && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {field("label", "Label *", { autofocus: true, hint: "Name on the physics chip, e.g. React." })}
                {field("slug", "Slug *", { placeholder: "react", hint: "Simpleicons name used for the chip icon." })}
                {field("bg", "Background", { placeholder: "#1f1f1f", hint: "Chip background color (hex)." })}
                {field("fg", "Foreground", { placeholder: "#ffffff", hint: "Chip text color (hex)." })}
              </div>
              {field("icon_url", "Custom icon URL (optional, defaults to simpleicons)", { hint: "Paste an image URL to override the slug icon." })}
            </>
          )}
          <div className="flex gap-2 pt-2">
            <button onClick={submit} disabled={saving} className="btn-primary px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">
              {saving ? "Saving…" : initialData ? "Save" : "Add"}
            </button>
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-muted cursor-pointer" style={{ border: "1px solid var(--section-border)" }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
