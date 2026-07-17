import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
  startOfYear,
  subDays,
} from "date-fns";
import type {
  Habit,
  HabitCompletion,
  Task,
} from "@will-be-done/slices/space";

export type DayMetric = {
  date: string;
  count: number;
  isToday: boolean;
  isPadding?: boolean;
};

export type HeatmapMonthLabel = { label: string; weekIndex: number };

export type ActivityHeatmap = {
  year: number;
  days: DayMetric[];
  monthLabels: HeatmapMonthLabel[];
};

export type HabitMetric = {
  id: string;
  title: string;
  completedDays: string[];
  completions: number;
  currentStreak: number;
  bestStreak: number;
  lastCompletedAt: number | null;
  isDoneToday: boolean;
  routineId: string | null;
  orderToken: string;
  targetTime: string | null;
};

export type HabitStats = {
  totalDone: number;
  totalHabitCompletions: number;
  doneLast30Days: number;
  averageDoneLast30Days: number;
  maxDoneInADayLast30Days: number;
  currentStreakDays: number;
  bestStreakDays: number;
  last30Days: DayMetric[];
  activityHeatmap: ActivityHeatmap;
  habits: HabitMetric[];
};

const dayKey = (date: Date) => format(startOfDay(date), "yyyy-MM-dd");

const increment = (counts: Map<string, number>, key: string) => {
  counts.set(key, (counts.get(key) ?? 0) + 1);
};

const mondayStart = (date: Date) => {
  const start = startOfDay(date);
  return subDays(start, (start.getDay() + 6) % 7);
};

const sundayEnd = (date: Date) => {
  const start = startOfDay(date);
  return addDays(start, (7 - start.getDay()) % 7);
};

const buildDays = (
  start: Date,
  length: number,
  counts: Map<string, number>,
  today: string,
) =>
  Array.from({ length }, (_, index) => {
    const date = dayKey(addDays(start, index));
    return { date, count: counts.get(date) ?? 0, isToday: date === today };
  });

const buildYearToDateHeatmap = (
  counts: Map<string, number>,
  now: Date,
  today: string,
): ActivityHeatmap => {
  const yearStart = startOfYear(now);
  const heatmapStart = mondayStart(yearStart);
  const heatmapEnd = sundayEnd(now);
  const length = differenceInCalendarDays(heatmapEnd, heatmapStart) + 1;
  const days = Array.from({ length }, (_, index) => {
    const date = dayKey(addDays(heatmapStart, index));
    const isPadding = date < dayKey(yearStart) || date > today;
    return {
      date,
      count: isPadding ? 0 : (counts.get(date) ?? 0),
      isToday: date === today,
      isPadding,
    };
  });
  const monthLabels: HeatmapMonthLabel[] = [];
  for (let month = 0; month <= now.getMonth(); month += 1) {
    const monthStart = new Date(now.getFullYear(), month, 1);
    const weekIndex = Math.floor(
      differenceInCalendarDays(mondayStart(monthStart), heatmapStart) / 7,
    );
    if (monthLabels.at(-1)?.weekIndex !== weekIndex) {
      monthLabels.push({ label: format(monthStart, "MMM"), weekIndex });
    }
  }
  return { year: now.getFullYear(), days, monthLabels };
};

const calculateCurrentStreak = (days: Set<string>, now: Date) => {
  let streak = 0;
  let cursor = startOfDay(now);
  if (!days.has(dayKey(cursor))) cursor = subDays(cursor, 1);
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }
  return streak;
};

const calculateBestStreak = (days: string[]) => {
  if (days.length === 0) return 0;
  const sorted = [...days].sort();
  let best = 1;
  let current = 1;
  for (let index = 1; index < sorted.length; index += 1) {
    if (
      differenceInCalendarDays(
        parseISO(sorted[index]!),
        parseISO(sorted[index - 1]!),
      ) === 1
    ) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }
  return best;
};

export function buildHabitStats(
  tasks: Task[],
  habits: Habit[] = [],
  completions: HabitCompletion[] = [],
  now = new Date(),
): HabitStats {
  const today = dayKey(now);
  const doneTasks = tasks.filter(
    (task) => task.state === "done" && task.lastToggledAt > 0,
  );
  const activityCounts = new Map<string, number>();
  for (const task of doneTasks) {
    increment(activityCounts, dayKey(new Date(task.lastToggledAt)));
  }
  for (const completion of completions) {
    increment(activityCounts, dayKey(new Date(completion.completedAt)));
  }

  const last30Days = buildDays(
    startOfDay(subDays(now, 29)),
    30,
    activityCounts,
    today,
  );
  const doneLast30Days = last30Days.reduce((sum, day) => sum + day.count, 0);
  const activityHeatmap = buildYearToDateHeatmap(
    activityCounts,
    now,
    today,
  );
  const activeDays = new Set(
    [...activityCounts.keys()].filter((date) => date <= today),
  );
  const completionsByHabit = new Map<string, HabitCompletion[]>();
  for (const completion of completions) {
    const bucket = completionsByHabit.get(completion.habitId) ?? [];
    bucket.push(completion);
    completionsByHabit.set(completion.habitId, bucket);
  }

  const habitMetrics = habits
    .filter((habit) => habit.archivedAt === null)
    .map((habit) => {
      const rows = completionsByHabit.get(habit.id) ?? [];
      const completedDays = [
        ...new Set(
          rows.map((completion) => dayKey(new Date(completion.completedAt))),
        ),
      ].sort();
      const completedDaySet = new Set(completedDays);
      return {
        id: habit.id,
        title: habit.title.trim() || "Untitled habit",
        completedDays,
        completions: rows.length,
        currentStreak: calculateCurrentStreak(completedDaySet, now),
        bestStreak: calculateBestStreak(completedDays),
        lastCompletedAt: rows.reduce<number | null>(
          (latest, completion) =>
            latest === null
              ? completion.completedAt
              : Math.max(latest, completion.completedAt),
          null,
        ),
        isDoneToday: completedDaySet.has(today),
        routineId: habit.routineId,
        orderToken: habit.orderToken,
        targetTime: habit.targetTime,
      };
    })
    .sort((left, right) => {
      if (Number(right.isDoneToday) !== Number(left.isDoneToday)) {
        return Number(right.isDoneToday) - Number(left.isDoneToday);
      }
      if (right.currentStreak !== left.currentStreak) {
        return right.currentStreak - left.currentStreak;
      }
      if (right.completions !== left.completions) {
        return right.completions - left.completions;
      }
      return (right.lastCompletedAt ?? 0) - (left.lastCompletedAt ?? 0);
    });

  return {
    totalDone: doneTasks.length,
    totalHabitCompletions: completions.length,
    doneLast30Days,
    averageDoneLast30Days: Math.round((doneLast30Days / 30) * 10) / 10,
    maxDoneInADayLast30Days: Math.max(
      0,
      ...last30Days.map((day) => day.count),
    ),
    currentStreakDays: calculateCurrentStreak(activeDays, now),
    bestStreakDays: calculateBestStreak([...activeDays]),
    last30Days,
    activityHeatmap,
    habits: habitMetrics,
  };
}
