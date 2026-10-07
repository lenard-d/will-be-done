import type { ItemForDisplay } from "@will-be-done/slices/space";

export type TaskSortMode = "date" | "alphabetical" | "manual";

export const taskSortModes = ["date", "alphabetical", "manual"] as const;
export const taskSortLabels: Record<TaskSortMode, string> = {
  date: "Planned day",
  alphabetical: "Alphabetical",
  manual: "Manual",
};

export function isTaskSortMode(value: unknown): value is TaskSortMode {
  return value === "date" || value === "alphabetical" || value === "manual";
}

export function sortTaskItems<T extends ItemForDisplay>({
  items,
  mode,
}: {
  items: readonly T[];
  mode: TaskSortMode;
}): T[] {
  if (mode === "manual") return [...items];
  return [...items].sort((left, right) => {
    if (mode === "alphabetical") {
      return left.item.title.localeCompare(right.item.title, undefined, {
        sensitivity: "base",
        numeric: true,
      });
    }
    const leftDate = left.dailyList?.date;
    const rightDate = right.dailyList?.date;
    if (!leftDate) return rightDate ? 1 : 0;
    if (!rightDate) return -1;
    const dateOrder = leftDate.localeCompare(rightDate);
    if (dateOrder !== 0) return dateOrder;
    const leftOrder = left.dailyEntry?.orderToken;
    const rightOrder = right.dailyEntry?.orderToken;
    if (!leftOrder || !rightOrder) return 0;
    return leftOrder < rightOrder ? -1 : leftOrder > rightOrder ? 1 : 0;
  });
}
