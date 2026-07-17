import { describe, expect, it } from "vitest";
import {
  buildRoutineColumns,
  type HabitMetricWithRoutine,
  type Routine,
} from "./habitLayout";

const routine = (values: Partial<Routine>): Routine => ({
  id: values.id ?? crypto.randomUUID(),
  title: values.title ?? "Routine",
  orderToken: values.orderToken ?? "m",
  createdAt: values.createdAt ?? 1,
  archivedAt: values.archivedAt ?? null,
});

const habit = (
  values: Partial<HabitMetricWithRoutine>,
): HabitMetricWithRoutine => ({
  id: values.id ?? crypto.randomUUID(),
  title: values.title ?? "Habit",
  completedDays: values.completedDays ?? [],
  completions: values.completions ?? 0,
  currentStreak: values.currentStreak ?? 0,
  bestStreak: values.bestStreak ?? 0,
  lastCompletedAt: values.lastCompletedAt ?? null,
  isDoneToday: values.isDoneToday ?? false,
  routineId: values.routineId ?? null,
  orderToken: values.orderToken ?? "m",
  targetTime: values.targetTime ?? null,
});

describe("buildRoutineColumns", () => {
  it("sorts active routines and groups assigned and loose habits", () => {
    const columns = buildRoutineColumns(
      [
        routine({ id: "evening", title: "Evening", orderToken: "z" }),
        routine({ id: "morning", title: "Morning", orderToken: "a" }),
      ],
      [
        habit({ title: "Journal", routineId: "evening" }),
        habit({ title: "Water", routineId: null }),
        habit({ title: "Run", routineId: "morning", orderToken: "c" }),
        habit({ title: "Meditate", routineId: "morning", orderToken: "a" }),
      ],
    );

    expect(columns.map((column) => column.title)).toEqual([
      "MORNING",
      "EVENING",
      "HABITS",
    ]);
    expect(columns[0]!.habits.map((item) => item.title)).toEqual([
      "Meditate",
      "Run",
    ]);
    expect(columns[2]!.habits.map((item) => item.title)).toEqual(["Water"]);
  });
});
