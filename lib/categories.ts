// Booking categories. Stored in Settings/Canary as Categories.<id> = { Name, Color, Created }.

export interface MeetingCategory {
  id: string;
  name: string;
  color: string;
}

// Category colours are palette tokens, not literal hex values: one source of
// truth, automatic dark/light adaptation.
export const PERSONAL_CATEGORY: MeetingCategory = {
  id: "personal",
  name: "Personal",
  color: "var(--chart-1)",
};

export const CATEGORY_COLORS: string[] = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--success)",
  "var(--warning)",
  "var(--info)",
];

export const MAX_CATEGORY_NAME = 28;

export function categoryKey(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

export function parseCategories(raw: unknown): MeetingCategory[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const out: MeetingCategory[] = [];
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const rec = v as Record<string, unknown>;
    const name = typeof rec.Name === "string" ? rec.Name : typeof rec.name === "string" ? rec.name : "";
    if (!name.trim()) continue;
    const color =
      typeof rec.Color === "string" ? rec.Color : typeof rec.color === "string" ? rec.color : CATEGORY_COLORS[0];
    out.push({ id, name: name.trim(), color });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export function findCategory(list: MeetingCategory[], id: string | undefined): MeetingCategory {
  if (id) {
    const hit = list.find((c) => c.id === id);
    if (hit) return hit;
  }
  return PERSONAL_CATEGORY;
}
