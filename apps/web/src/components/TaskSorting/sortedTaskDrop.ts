import { reorderDailyEntry } from "@will-be-done/slices/space";
import { isTaskSortMode } from "./taskSorting";

export function sortedTaskDrop({
  sourceId,
  sourceDailyListId,
  target,
  edge,
}: {
  sourceId: string;
  sourceDailyListId?: unknown;
  target: Record<string | symbol, unknown>;
  edge: "top" | "bottom";
}) {
  if (!isTaskSortMode(target.taskSortMode)) return { handled: false };
  if (target.taskSortMode === "manual")
    return { handled: target.blockManualTaskSort === true };
  // Calendar columns keep their explicit cross-day scheduling behavior.
  if (
    target.taskSortCalendar === true &&
    sourceDailyListId !== target.taskSortDailyListId
  )
    return { handled: false };
  if (
    target.taskSortMode !== "date" ||
    typeof target.taskSortDailyListId !== "string" ||
    sourceDailyListId !== target.taskSortDailyListId ||
    typeof target.modelId !== "string"
  )
    return { handled: true };
  return {
    handled: true,
    action: reorderDailyEntry({
      taskId: sourceId,
      targetTaskId: target.modelId,
      edge,
    }),
  };
}
