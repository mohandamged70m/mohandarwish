// Canonical re-export: booking categories live in utils/categories.ts.
// lib/ is the discoverable home for new code; utils/ stays for legacy imports.

export {
  PERSONAL_CATEGORY,
  CATEGORY_COLORS,
  MAX_CATEGORY_NAME,
  categoryKey,
  parseCategories,
  findCategory,
} from "@/utils/categories";
export type { MeetingCategory } from "@/utils/categories";
