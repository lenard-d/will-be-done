import type { ReactNode } from "react";
import { TaskSortingContext } from "./TaskSortContext";
import type { ItemForDisplay } from "@will-be-done/slices/space";
import { sortTaskItems, type TaskSortMode } from "./taskSorting";

/** Keep displayed neighbors and day-order writes together for every task view. */
export function SortedTaskList({
  items,
  mode,
  calendar = false,
  blockManual = false,
  children,
}: {
  items: readonly ItemForDisplay[];
  mode: TaskSortMode;
  calendar?: boolean;
  blockManual?: boolean;
  children: (item: ItemForDisplay) => ReactNode;
}) {
  const sorted = sortTaskItems({ items, mode });
  return sorted.map((item, index) => {
    const dailyListId = item.dailyEntry?.dailyListId;
    const previous = sorted[index - 1];
    const next = sorted[index + 1];
    return (
      <TaskSortingContext
        key={`${item.listItem.type}:${item.listItem.id}`}
        value={{
          mode,
          dailyListId,
          calendar,
          blockManual,
          previousTaskId:
            dailyListId && previous?.dailyEntry?.dailyListId === dailyListId
              ? previous.item.id
              : undefined,
          nextTaskId:
            dailyListId && next?.dailyEntry?.dailyListId === dailyListId
              ? next.item.id
              : undefined,
        }}
      >
        {children(item)}
      </TaskSortingContext>
    );
  });
}
