export * from "../analytics-types";

import type { SessionDoc } from "../analytics-types";

/** The section id the /book page records when a visitor opens it. */
export const BOOK_SECTION = "book";

/** Whether a visit ever showed the book page (today's rollup or the timeline). */
export function sawBookPage(session: SessionDoc | null | undefined): boolean {
  if (!session) return false;
  if ((session.Sections?.book ?? 0) > 0) return true;
  return (session.Events ?? []).some((event) => event.k === "section" && event.v === BOOK_SECTION);
}
