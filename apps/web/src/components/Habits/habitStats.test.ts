import { describe, expect, it } from "vitest";
import type {
  Habit,
  HabitCompletion,
  Task,
} from "@will-be-done/slices/space";
import { buildHabitStats } from "./habitStats";

const task = (values: Partial<Task>): Task => ({
  type: "task",
  id: values.id ?? crypto.randomUUID(),
  title: values.title ?? "Task",
  state: values.state ?? "done",
  projectCategoryId: values.projectCategoryId ?? "category",
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
    expect(
      stats.activityHeatmap.days.find((day) => day.isToday)?.count,
    ).toBe(2);
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
