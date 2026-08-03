import type { HabitMetric } from "./habitStats";

export type Routine = {
  id: string;
  title: string;
  orderToken: string;
  createdAt: number;
  archivedAt: number | null;
};

export type HabitMetricWithRoutine = HabitMetric & {
  routineId: string | null;
  orderToken: string;
  targetTime: string | null;
};

export type RoutineColumn = {
  id: string;
  title: string;
  routine: Routine | null;
  habits: HabitMetricWithRoutine[];
};

const byOrder = <T extends { orderToken: string; createdAt?: number }>(
  left: T,
  right: T,
) => {
  const order = left.orderToken.localeCompare(right.orderToken);
  return order !== 0 ? order : (left.createdAt ?? 0) - (right.createdAt ?? 0);
};

export function buildRoutineColumns(
  routines: Routine[],
  habits: HabitMetricWithRoutine[],
): RoutineColumn[] {
  const activeRoutines = routines
    .filter((routine) => routine.archivedAt === null)
    .sort(byOrder);
  const routineIds = new Set(activeRoutines.map((routine) => routine.id));
  const columns: RoutineColumn[] = activeRoutines.map((routine) => ({
    id: routine.id,
    title: routine.title.trim().toUpperCase() || "ROUTINE",
    routine,
    habits: habits
      .filter((habit) => habit.routineId === routine.id)
      .sort(byOrder),
  }));

  const unassignedHabits = habits
    .filter(
      (habit) =>
        habit.routineId === null || !routineIds.has(habit.routineId),
    )
    .sort(byOrder);
  if (unassignedHabits.length > 0) {
    columns.push({
      id: "unassigned",
      title: "HABITS",
      routine: null,
      habits: unassignedHabits,
    });
  }
  return columns;
}
