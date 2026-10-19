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
  it("covers Jan 1 to Dec 31 of the current year, all 12 months", () => {
    const { year, from, to } = contributionWindow(new Date("2026-10-19T09:00:00.000Z"));
    expect(year).toBe(2026);
    expect(from).toBe("2026-01-01T00:00:00.000Z");
    expect(to).toBe("2026-12-31T23:59:59.000Z");
  });

  it("stays within the API's one-year maximum", () => {
    const { from, to } = contributionWindow(new Date("2026-10-19T09:00:00.000Z"));
    const spanDays = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    // 364 whole days + 23:59:59 — never 366, which GitHub would reject.
    expect(spanDays).toBeGreaterThan(364);
    expect(spanDays).toBeLessThanOrEqual(365);
  });

  it("rolls over to the next calendar year in January", () => {
    const { year, from } = contributionWindow(new Date("2027-01-02T00:00:00.000Z"));
    expect(year).toBe(2027);
    expect(from).toBe("2027-01-01T00:00:00.000Z");
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
  const range = { year: 2026, from: "2026-01-01T00:00:00.000Z", to: "2026-12-31T23:59:59.000Z" };

  it("reports GitHub's own total instead of re-adding the cells", () => {
    // Deliberately inconsistent: the cells sum to 3 but GitHub says 281
    // (its total also covers contributions the day list does not itemise).
    const payload = buildContributionPayload(
      { totalContributions: 281, weeks: [[day("2026-10-18", 3, "FIRST_QUARTILE")]] },
      range,
    );
    expect(payload.totalContributions).toBe(281);
    expect(payload.weeks.flat().filter(Boolean)).toHaveLength(1);
    expect(payload.login).toBe("mohandamged70m");
    expect(payload.range.year).toBe(2026);
  });

  it("keeps days GitHub has not reached yet as real, empty cells", () => {
    // GitHub returns future days with a count of 0. They must survive as
    // level-0 cells so the grid really does span all 12 months, rather than
    // being dropped and leaving a hole at the end of the year.
    const payload = buildContributionPayload(
      {
        totalContributions: 282,
        weeks: [[day("2026-12-30", 0, "NONE"), day("2026-12-31", 0, "NONE")]],
      },
      range,
    );
    const cells = payload.weeks.flat().filter((cell) => cell !== null);
    expect(cells.map((c) => c.date)).toEqual(["2026-12-30", "2026-12-31"]);
    expect(cells.every((c) => c.count === 0 && c.level === 0)).toBe(true);
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
