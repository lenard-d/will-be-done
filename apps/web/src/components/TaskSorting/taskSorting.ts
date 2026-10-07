import type { ItemForDisplay } from "@will-be-done/slices/space";

export type TaskSortMode = "date" | "alphabetical" | "manual";

export type TaskInsertion = {
  taskId: string;
  anchorTaskId: string;
  position: "before" | "after";
  focusKey: string;
};

/** Keep a new task beside its selected neighbor until title editing ends. */
export function keepTaskInsertionPosition<T extends ItemForDisplay>(
  items: readonly T[],
  insertion: TaskInsertion | undefined,
): T[] {
  if (!insertion) return [...items];
  const task = items.find((item) => item.item.id === insertion.taskId);
  const anchor = items.find((item) => item.item.id === insertion.anchorTaskId);
  if (!task || !anchor) return [...items];
  const reordered = items.filter((item) => item !== task);
  const anchorIndex = reordered.indexOf(anchor);
  reordered.splice(
    anchorIndex + (insertion.position === "after" ? 1 : 0),
    0,
    task,
  );
  return reordered;
}

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
