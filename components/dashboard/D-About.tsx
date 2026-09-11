"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Edit2, Eye, EyeOff, Loader2, Plus, Trash2 } from "lucide-react";
import Alert from "@/components/dash/Alert";
import useSafeAlert from "@/hooks/useSafeAlert";
import MAboutForm, { type AboutItem, type AboutSection } from "./M-AboutForm";
import MConfirmModal from "./M-ConfirmModal";

type Section = AboutSection;
type Item = AboutItem;

const SECTIONS: { id: Section; label: string }[] = [
  { id: "experience", label: "Experience" },
  { id: "education", label: "Education" },
  { id: "skills", label: "Skills" },
  { id: "stack", label: "Stack" },
];

function adminToken(): string {
  try {
    return localStorage.getItem("dashboard_token") ?? "";
  } catch {
    return "";
  }
}

async function api<T>(section: Section, init?: RequestInit, suffix = ""): Promise<T> {
  const res = await fetch(`/api/profile/${section}${suffix}`, {
    ...init,
    headers: { "Content-Type": "application/json", "x-admin-token": adminToken(), ...(init?.headers || {}) },
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

function titleOf(section: Section, it: Item): string {
  if (section === "experience") return String(it.company ?? "Untitled");
  if (section === "education") return String(it.school ?? "Untitled");
  return String(it.label ?? "Untitled");
}

function subtitleOf(section: Section, it: Item): string {
  if (section === "experience") return `${String(it.role ?? "")} • ${String(it.period ?? "")}`;
  if (section === "education") return `${String(it.degree ?? "")} • ${String(it.period ?? "")}`;
  if (section === "stack") return String(it.slug ?? "");
  return "";
}

export default function DAbout() {
  const [section, setSection] = useState<Section>("experience");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);
  const { alert, showAlert, hideAlert } = useSafeAlert();

  const load = useCallback(async (s: Section) => {
    setLoading(true);
    try {
      const json = await api<{ items: Item[] }>(s, undefined, "?all=1");
      setItems((json.items ?? []).sort((a, b) => a.sort_order - b.sort_order));
    } catch (e) {
      showAlert({ type: "error", message: e instanceof Error ? e.message : "Failed to load" });
      setItems([]);
    }
    setLoading(false);
  }, [showAlert]);

  useEffect(() => {
    void load(section);
  }, [section, load]);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (it: Item) => {
    setEditing(it);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const save = async (payload: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (editing) {
        await api(section, { method: "PATCH", body: JSON.stringify(payload) }, `/${editing.id}`);
        showAlert({ type: "success", message: "Updated" });
      } else {
        if (section === "experience" && (!payload.company || !payload.role || !payload.period)) throw new Error("Company, role and period are required");
        if (section === "education" && (!payload.school || !payload.degree || !payload.period)) throw new Error("School, degree and period are required");
        if (section === "skills" && !payload.label) throw new Error("Label is required");
        if (section === "stack" && (!payload.label || !payload.slug)) throw new Error("Label and slug are required");
        await api(section, { method: "POST", body: JSON.stringify({ ...payload, sort_order: items.length }) });
        showAlert({ type: "success", message: "Added" });
      }
      closeModal();
      await load(section);
    } catch (e) {
      showAlert({ type: "error", message: e instanceof Error ? e.message : "Save failed" });
    }
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await api(section, { method: "DELETE" }, `/${pendingDelete.id}`);
      showAlert({ type: "success", message: "Deleted" });
      setPendingDelete(null);
      await load(section);
    } catch (e) {
      showAlert({ type: "error", message: e instanceof Error ? e.message : "Delete failed" });
    }
  };

  const toggleVisible = async (it: Item) => {
    try {
      await api(section, { method: "PATCH", body: JSON.stringify({ is_visible: !it.is_visible }) }, `/${it.id}`);
      setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, is_visible: !p.is_visible } : p)));
    } catch (e) {
      showAlert({ type: "error", message: e instanceof Error ? e.message : "Update failed" });
    }
  };

  const move = async (it: Item, dir: -1 | 1) => {
    const idx = items.findIndex((p) => p.id === it.id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= items.length) return;
    const next = [...items];
    const a = next[idx]!;
    const b = next[j]!;
    next[idx] = b;
    next[j] = a;
    setItems(next);
    try {
      await api<{ ok: boolean }>(section, {
        method: "POST",
        body: JSON.stringify({ items: next.map((p, i) => ({ id: p.id, sort_order: i })) }),
      });
    } catch (e) {
      showAlert({ type: "error", message: e instanceof Error ? e.message : "Reorder failed" });
      await load(section);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {alert?.show && <Alert message={alert.message} type={alert.type} onClose={hideAlert} />}

      <div className="glass-panel p-4 flex flex-wrap items-center gap-2">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors ${section === s.id ? "btn-primary" : "text-muted"}`}
            style={section === s.id ? undefined : { border: "1px solid var(--section-border)" }}
          >
            {s.label}
          </button>
        ))}
        <button onClick={openAdd} className="btn-primary ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer">
          <Plus size={15} /> Add
        </button>
      </div>

      <div className="glass-panel p-6 flex flex-col gap-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted text-sm">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 px-4 rounded-xl text-center text-muted text-sm" style={{ border: "2px dashed var(--section-border)" }}>
            No entries yet — click Add.
          </div>
        ) : (
          items.map((it, i) => (
            <div
              key={it.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ border: "1px solid var(--section-border)", opacity: it.is_visible ? 1 : 0.55 }}
            >
              <span className="text-xs font-black text-muted w-6 text-center">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-primary truncate">{titleOf(section, it)}</div>
                {subtitleOf(section, it) && <div className="text-xs text-muted truncate">{subtitleOf(section, it)}</div>}
              </div>
              <button onClick={() => void move(it, -1)} disabled={i === 0} aria-label="Move up" className="p-2 text-muted hover:text-primary disabled:opacity-30 cursor-pointer"><ArrowUp size={15} /></button>
              <button onClick={() => void move(it, 1)} disabled={i === items.length - 1} aria-label="Move down" className="p-2 text-muted hover:text-primary disabled:opacity-30 cursor-pointer"><ArrowDown size={15} /></button>
              <button onClick={() => void toggleVisible(it)} aria-label={it.is_visible ? "Hide" : "Show"} className="p-2 text-muted hover:text-primary cursor-pointer">
                {it.is_visible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <button onClick={() => openEdit(it)} aria-label="Edit" className="p-2 text-muted hover:text-primary cursor-pointer"><Edit2 size={15} /></button>
              <button onClick={() => setPendingDelete(it)} aria-label="Delete" className="p-2 text-muted hover:text-primary cursor-pointer"><Trash2 size={15} /></button>
            </div>
          ))
        )}
      </div>

      <MAboutForm
        isOpen={modalOpen}
        section={section}
        initialData={editing}
        saving={saving}
        onClose={closeModal}
        onSave={(payload) => void save(payload)}
      />

      <MConfirmModal
        isOpen={pendingDelete !== null}
        title="Delete entry?"
        message={pendingDelete ? `Delete "${titleOf(section, pendingDelete)}"? This cannot be undone.` : ""}
        confirmText="Delete"
        type="danger"
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
