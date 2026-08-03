import { describe, expect, it } from "vitest";
import { buildHabitHeatmap } from "./habitHeatmapData";

describe("buildHabitHeatmap", () => {
  it("builds week columns with seven local-calendar rows", () => {
    const now = new Date(2027, 2, 10, 12);
    const completedAt = new Date(2027, 2, 8, 8).getTime();
    const weeks = buildHabitHeatmap(
      [
        {
          id: "done",
          habitId: "habit-1",
          type: "habit_completion",
          completedAt,
        },
      ],
      now,
      3,
    );

    expect(weeks).toHaveLength(3);
    expect(weeks.every((week) => week.days.length === 7)).toBe(true);
    expect(
      weeks
        .flatMap((week) => week.days)
        .find((day) => day.date === "2027-03-08"),
    ).toMatchObject({ checked: true, disabled: false });
    expect(weeks.at(-1)?.days.at(2)).toMatchObject({
      date: "2027-03-10",
      isToday: true,
      disabled: false,
    });
    expect(weeks.at(-1)?.days.at(6)).toMatchObject({ disabled: true });
  });

  it("allows backfilling dates before the habit was created", () => {
    const weeks = buildHabitHeatmap(
      [],
      new Date(2027, 2, 10, 12),
      1,
    );

    expect(weeks[0]?.days[0]).toMatchObject({
      date: "2027-03-08",
      disabled: false,
    });
    expect(weeks[0]?.days[2]).toMatchObject({
      date: "2027-03-10",
      disabled: false,
    });
    expect(weeks[0]?.days[6]).toMatchObject({ disabled: true });
  });
});
