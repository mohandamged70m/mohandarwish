import { describe, expect, it } from "vitest";
import {
  buildContributionPayload,
  buildContributionWeeks,
  computeStreakStats,
  CONTRIBUTION_LEVELS,
  contributionWindow,
  weekdayOf,
  type ContributionDay,
} from "@/lib/github";

/** Shape of one `contributionDays` entry as the GraphQL API returns it. */
const day = (
  date: string,
  contributionCount: number,
  contributionLevel?: string,
): ContributionDay => ({ date, contributionCount, contributionLevel });

describe("weekdayOf", () => {
  // Regression: `new Date("2026-01-01").getDay()` is 3 (Wednesday) west of
  // UTC because the string parses as UTC midnight. The grid used that value,
  // so every row shifted by a day for those visitors.
  it("reads the calendar weekday, not the viewer's shifted local one", () => {
    expect(weekdayOf("2026-01-01")).toBe(4); // Thursday
    expect(weekdayOf("2025-10-19")).toBe(0); // Sunday
    expect(weekdayOf("2026-10-18")).toBe(0); // Sunday
    expect(weekdayOf("2026-10-03")).toBe(6); // Saturday
  });
});

describe("contributionWindow", () => {
  it("asks for exactly one year, which is the API's maximum", () => {
    const now = new Date("2026-10-18T16:04:00.000Z");
    const { from, to } = contributionWindow(now);
    expect(to).toBe("2026-10-18T16:04:00.000Z");
    expect(from).toBe("2025-10-18T16:04:00.000Z");
    const spanDays = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    expect(spanDays).toBeLessThanOrEqual(366);
  });
});

describe("buildContributionWeeks", () => {
  it("maps GitHub's quartile levels onto the site's 0-4 shades", () => {
    const weeks = buildContributionWeeks([
      [
        day("2026-10-18", 0, "NONE"),
        day("2026-10-19", 1, "FIRST_QUARTILE"),
        day("2026-10-20", 14, "SECOND_QUARTILE"),
        day("2026-10-21", 19, "THIRD_QUARTILE"),
        day("2026-10-22", 36, "FOURTH_QUARTILE"),
      ],
    ]);
    const cells = weeks.flat().filter((cell) => cell !== null);
    expect(cells.map((cell) => cell.level)).toEqual([0, 1, 2, 3, 4]);
    expect(CONTRIBUTION_LEVELS.NONE).toBe(0);
    expect(CONTRIBUTION_LEVELS.FOURTH_QUARTILE).toBe(4);
  });

  it("pads a short opening week at the top and a short closing week at the bottom", () => {
    const weeks = buildContributionWeeks([
      // Window began on a Wednesday: Monday/Tuesday slots must stay empty.
      [day("2026-10-21", 2, "FIRST_QUARTILE"), day("2026-10-22", 0, "NONE")],
      // In-progress final week: only Sunday has landed.
      [day("2026-10-25", 0, "NONE")],
    ]);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0].slice(0, 3)).toEqual([null, null, null]);
    expect(weeks[0][3]?.date).toBe("2026-10-21");
    expect(weeks[1][0]?.date).toBe("2026-10-25");
    expect(weeks[1].slice(1)).toEqual([null, null, null, null, null, null]);
  });

  it("keeps every date and count exactly as GitHub returned them", () => {
    const weeks = buildContributionWeeks([
      [day("2026-10-11", 36, "FOURTH_QUARTILE"), day("2026-10-12", 13, "SECOND_QUARTILE")],
    ]);
    const cells = weeks.flat().filter((cell) => cell !== null);
    expect(cells).toEqual([
      { date: "2026-10-11", count: 36, level: 4 },
      { date: "2026-10-12", count: 13, level: 2 },
    ]);
  });
});

describe("buildContributionPayload", () => {
  it("reports GitHub's own total instead of re-adding the cells", () => {
    // Deliberately inconsistent: the cells sum to 3 but GitHub says 281
    // (its total also covers contributions the day list does not itemise).
    const payload = buildContributionPayload(
      { totalContributions: 281, weeks: [[day("2026-10-18", 3, "FIRST_QUARTILE")]] },
      { from: "2025-10-18T00:00:00.000Z", to: "2026-10-18T00:00:00.000Z" },
    );
    expect(payload.totalContributions).toBe(281);
    expect(payload.weeks.flat().filter(Boolean)).toHaveLength(1);
    expect(payload.login).toBe("mohandamged70m");
  });
});

describe("computeStreakStats", () => {
  it("counts a live streak from yesterday when today is still empty", () => {
    const days = [
      day("2026-10-13", 0),
      day("2026-10-14", 4),
      day("2026-10-15", 1),
      day("2026-10-16", 7),
      day("2026-10-17", 2),
      day("2026-10-18", 0),
    ];
    expect(computeStreakStats(days, "2026-10-18")).toEqual({ currentStreak: 4, longestStreak: 4 });
  });
});
