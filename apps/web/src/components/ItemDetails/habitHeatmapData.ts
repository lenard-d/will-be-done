import {
  addDays,
  format,
  isSameDay,
  startOfDay,
  subWeeks,
} from "date-fns";
import type { HabitCompletion } from "@will-be-done/slices/space";

export type HabitHeatmapDay = {
  date: string;
  completedAt: number;
  checked: boolean;
  disabled: boolean;
  isToday: boolean;
};

export type HabitHeatmapWeek = {
  key: string;
  monthLabel: string | null;
  days: HabitHeatmapDay[];
};

const dayKey = (date: Date) => format(startOfDay(date), "yyyy-MM-dd");

const mondayStart = (date: Date) => {
  const start = startOfDay(date);
  return addDays(start, -((start.getDay() + 6) % 7));
};

export function buildHabitHeatmap(
  completions: HabitCompletion[],
  habitCreatedAt: number,
  now = new Date(),
  weekCount = 16,
): HabitHeatmapWeek[] {
  const today = startOfDay(now);
  const created = startOfDay(new Date(habitCreatedAt));
  const lastWeekStart = mondayStart(today);
  const firstWeekStart = subWeeks(lastWeekStart, Math.max(1, weekCount) - 1);
  const completedDays = new Set(
    completions.map((completion) => dayKey(new Date(completion.completedAt))),
  );

  return Array.from({ length: Math.max(1, weekCount) }, (_, weekIndex) => {
    const weekStart = addDays(firstWeekStart, weekIndex * 7);
    const days = Array.from({ length: 7 }, (_, dayIndex) => {
      const date = addDays(weekStart, dayIndex);
      date.setHours(12, 0, 0, 0);
      const dateStart = startOfDay(date);
      return {
        date: dayKey(date),
        completedAt: date.getTime(),
        checked: completedDays.has(dayKey(date)),
        disabled: dateStart < created || dateStart > today,
        isToday: isSameDay(date, today),
      };
    });
    const firstOfMonth = days.find((day) => day.date.endsWith("-01"));
    return {
      key: dayKey(weekStart),
      monthLabel:
        firstOfMonth || weekCount === 1
          ? format(
              new Date(`${firstOfMonth?.date ?? days[0]!.date}T12:00:00`),
              "MMM",
            )
          : null,
      days,
    };
  });
}
