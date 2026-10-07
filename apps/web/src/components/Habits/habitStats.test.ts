import { describe, expect, it } from "vitest";
import type { Habit, HabitCompletion, Task } from "@will-be-done/slices/space";
import { buildHabitStats } from "./habitStats";

const task = (values: Partial<Task>): Task => ({
  type: "task",
  id: values.id ?? crypto.randomUUID(),
  title: values.title ?? "Task",
  state: values.state ?? "done",
  projectSectionId: values.projectSectionId ?? "category",
  orderToken: values.orderToken ?? "a",
  lastToggledAt: values.lastToggledAt ?? 0,
  createdAt: values.createdAt ?? 0,
  templateId: values.templateId ?? null,
  templateDate: values.templateDate ?? null,
});

const habit = (values: Partial<Habit>): Habit => ({
  type: "habit",
  id: values.id ?? "habit-1",
  title: values.title ?? "Habit",
  routineId: values.routineId ?? null,
  orderToken: values.orderToken ?? "a",
  targetTime: values.targetTime ?? null,
  createdAt: values.createdAt ?? 0,
  archivedAt: values.archivedAt ?? null,
});

const completion = (values: Partial<HabitCompletion>): HabitCompletion => ({
  type: "habit_completion",
  id: values.id ?? crypto.randomUUID(),
  habitId: values.habitId ?? "habit-1",
  completedAt: values.completedAt ?? 0,
});

describe("buildHabitStats", () => {
  it("shows 91 consecutive activity days through today across a year boundary", () => {
    const stats = buildHabitStats([], [], [], new Date(2027, 0, 1, 12));
    const days = stats.activityHeatmap.days.filter((day) => !day.isPadding);

    expect({
      length: days.length,
      first: days[0]?.date,
      last: days.at(-1),
      uniqueDates: new Set(days.map((day) => day.date)).size,
    }).toEqual({
      length: 91,
      first: "2026-10-03",
      last: {
        date: "2027-01-01",
        count: 0,
        isToday: true,
        isPadding: false,
      },
      uniqueDates: 91,
    });
  });

  it("keeps week padding empty when activity exists outside the history window", () => {
    const stats = buildHabitStats(
      [
        task({ lastToggledAt: new Date(2026, 9, 2, 8).getTime() }),
        task({ lastToggledAt: new Date(2026, 9, 3, 8).getTime() }),
        task({ lastToggledAt: new Date(2027, 0, 1, 8).getTime() }),
      ],
      [],
      [
        completion({ completedAt: new Date(2027, 0, 1, 9).getTime() }),
        completion({ completedAt: new Date(2027, 0, 2, 9).getTime() }),
      ],
      new Date(2027, 0, 1, 12),
    );

    expect(
      stats.activityHeatmap.days
        .filter((day) => day.count > 0 || day.isPadding)
        .map(({ date, count, isPadding }) => ({ date, count, isPadding })),
    ).toEqual([
      { date: "2026-09-28", count: 0, isPadding: true },
      { date: "2026-09-29", count: 0, isPadding: true },
      { date: "2026-09-30", count: 0, isPadding: true },
      { date: "2026-10-01", count: 0, isPadding: true },
      { date: "2026-10-02", count: 0, isPadding: true },
      { date: "2026-10-03", count: 1, isPadding: false },
      { date: "2027-01-01", count: 2, isPadding: false },
      { date: "2027-01-02", count: 0, isPadding: true },
      { date: "2027-01-03", count: 0, isPadding: true },
    ]);
  });

  it("includes the first and current dates in the 30-day chart", () => {
    const stats = buildHabitStats(
      [
        task({ lastToggledAt: new Date(2026, 11, 2, 23, 59).getTime() }),
        task({ lastToggledAt: new Date(2026, 11, 3, 0, 1).getTime() }),
        task({ lastToggledAt: new Date(2027, 0, 1, 23, 59).getTime() }),
      ],
      [],
      [],
      new Date(2027, 0, 1, 12),
    );

    expect({
      length: stats.last30Days.length,
      first: stats.last30Days[0],
      last: stats.last30Days.at(-1),
      activity: stats.doneLast30Days,
    }).toEqual({
      length: 30,
      first: { date: "2026-12-03", count: 1, isToday: false },
      last: { date: "2027-01-01", count: 1, isToday: true },
      activity: 2,
    });
  });

  it("aligns full calendar weeks without dropping leap day", () => {
    const stats = buildHabitStats([], [], [], new Date(2028, 2, 1, 12));
    const days = stats.activityHeatmap.days;
    const actualDays = days.filter((day) => !day.isPadding);

    expect({
      length: actualDays.length,
      first: actualDays[0]?.date,
      leapDay: actualDays.find((day) => day.date === "2028-02-29"),
      last: actualDays.at(-1)?.date,
      gridFirst: days[0]?.date,
      gridLast: days.at(-1)?.date,
    }).toEqual({
      length: 91,
      first: "2027-12-02",
      leapDay: {
        date: "2028-02-29",
        count: 0,
        isToday: false,
        isPadding: false,
      },
      last: "2028-03-01",
      gridFirst: "2027-11-29",
      gridLast: "2028-03-05",
    });
  });

  it("keeps each local day through the daylight-saving change", () => {
    const stats = buildHabitStats(
      [
        task({ lastToggledAt: new Date(2027, 2, 28, 0, 30).getTime() }),
        task({ lastToggledAt: new Date(2027, 2, 28, 23, 30).getTime() }),
        task({ lastToggledAt: new Date(2027, 2, 29, 0, 30).getTime() }),
      ],
      [],
      [],
      new Date(2027, 3, 1, 12),
    );

    expect(
      stats.activityHeatmap.days
        .filter((day) => day.count > 0)
        .map(({ date, count }) => ({ date, count })),
    ).toEqual([
      { date: "2027-03-28", count: 2 },
      { date: "2027-03-29", count: 1 },
    ]);
  });

  it("moves both windows to the next day without new activity", () => {
    const tasks = [
      task({ lastToggledAt: new Date(2026, 11, 3, 8).getTime() }),
      task({ lastToggledAt: new Date(2027, 0, 1, 8).getTime() }),
    ];
    const stats = buildHabitStats(tasks, [], [], new Date(2027, 0, 2, 0, 1));

    expect({
      firstDailyDay: stats.last30Days[0]?.date,
      dailyActivity: stats.doneLast30Days,
      firstHistoryDay: stats.activityHeatmap.days.find((day) => !day.isPadding)
        ?.date,
      currentDay: stats.activityHeatmap.days.find((day) => day.isToday)?.date,
      totalDone: stats.totalDone,
      currentStreak: stats.currentStreakDays,
    }).toEqual({
      firstDailyDay: "2026-12-04",
      dailyActivity: 1,
      firstHistoryDay: "2026-10-04",
      currentDay: "2027-01-02",
      totalDone: 2,
      currentStreak: 1,
    });
  });

  it("places month labels in order across a year boundary", () => {
    const stats = buildHabitStats([], [], [], new Date(2027, 0, 1, 12));

    expect(stats.activityHeatmap.monthLabels).toEqual([
      { label: "Oct", weekIndex: 0 },
      { label: "Nov", weekIndex: 4 },
      { label: "Dec", weekIndex: 9 },
      { label: "Jan", weekIndex: 13 },
    ]);
  });

  it("keeps month labels distinct when the window starts near a month end", () => {
    const stats = buildHabitStats([], [], [], new Date(2027, 3, 29, 12));

    expect(stats.activityHeatmap.monthLabels).toEqual([
      { label: "Feb", weekIndex: 1 },
      { label: "Mar", weekIndex: 5 },
      { label: "Apr", weekIndex: 9 },
    ]);
  });

  it("includes completed tasks and explicit habit completions in global activity", () => {
    const now = new Date(2027, 5, 6, 12);
    const stats = buildHabitStats(
      [task({ lastToggledAt: new Date(2027, 5, 6, 8).getTime() })],
      [habit({})],
      [completion({ completedAt: new Date(2027, 5, 6, 9).getTime() })],
      now,
    );

    expect(stats.totalDone).toBe(1);
    expect(stats.totalHabitCompletions).toBe(1);
    expect(stats.doneLast30Days).toBe(2);
    expect(stats.activityHeatmap.year).toBe(2027);
    expect(stats.activityHeatmap.days.find((day) => day.isToday)?.count).toBe(
      2,
    );
  });

  it("builds habit streaks only from explicit completion records", () => {
    const now = new Date(2027, 5, 6, 12);
    const stats = buildHabitStats(
      [
        task({
          title: "Habit",
          lastToggledAt: new Date(2027, 5, 6, 8).getTime(),
        }),
      ],
      [habit({})],
      [
        completion({ completedAt: new Date(2027, 5, 5, 8).getTime() }),
        completion({ completedAt: new Date(2027, 5, 6, 8).getTime() }),
      ],
      now,
    );

    expect(stats.habits[0]).toMatchObject({
      completions: 2,
      currentStreak: 2,
      bestStreak: 2,
      isDoneToday: true,
    });
  });

  it("keeps current streaks alive through yesterday", () => {
    const now = new Date(2027, 0, 1, 12);
    const stats = buildHabitStats(
      [
        task({ lastToggledAt: new Date(2026, 11, 30, 8).getTime() }),
        task({ lastToggledAt: new Date(2026, 11, 31, 8).getTime() }),
      ],
      [habit({})],
      [
        completion({ completedAt: new Date(2026, 11, 30, 23, 30).getTime() }),
        completion({ completedAt: new Date(2026, 11, 31, 0, 30).getTime() }),
      ],
      now,
    );

    expect(stats.currentStreakDays).toBe(2);
    expect(stats.habits[0]?.currentStreak).toBe(2);
    expect(stats.habits[0]?.isDoneToday).toBe(false);
  });

  it("calculates the global best streak across year boundaries and all history", () => {
    const now = new Date(2027, 0, 1, 12);
    const activity = [
      new Date(2026, 5, 10, 8),
      new Date(2026, 5, 11, 8),
      new Date(2026, 5, 12, 8),
      new Date(2026, 11, 31, 8),
    ];
    const stats = buildHabitStats(
      activity.map((date, index) =>
        task({ id: `task-${index}`, lastToggledAt: date.getTime() }),
      ),
      [],
      [],
      now,
    );

    expect(stats.currentStreakDays).toBe(1);
    expect(stats.bestStreakDays).toBe(3);
  });
});
