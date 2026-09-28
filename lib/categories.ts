// Booking categories (replaces the old utils/categories).
// Stored in Settings/Canary as Categories.<id> = { Name, Color, Created }.

export interface MeetingCategory {
  id: string;
  name: string;
  color: string;
}

export const PERSONAL_CATEGORY: MeetingCategory = {
  id: "personal",
  name: "Personal",
  color: "#3b82f6",
};

export const CATEGORY_COLORS: string[] = [
  "#3b82f6",
  "#ad2831",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#22c55e",
  "#06b6d4",
  "#f43f5e",
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
