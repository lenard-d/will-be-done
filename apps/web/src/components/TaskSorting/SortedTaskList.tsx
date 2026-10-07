import { useEffect, useState, type ReactNode } from "react";
import { TaskSortingContext } from "./TaskSortContext";
import type { ItemForDisplay } from "@will-be-done/slices/space";
import {
  keepTaskInsertionPosition,
  sortTaskItems,
  type TaskInsertion,
  type TaskSortMode,
} from "./taskSorting";
import { useFocusStore } from "@/store/focusSlice";

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
  const [insertion, setInsertion] = useState<TaskInsertion>();
  const editItemKey = useFocusStore((state) => state.editItemKey);
  const activeInsertion =
    insertion?.focusKey === editItemKey ? insertion : undefined;
  useEffect(
    () =>
      useFocusStore.subscribe((state) => {
        if (insertion && insertion.focusKey !== state.editItemKey)
          setInsertion(undefined);
      }),
    [insertion],
  );
  const sorted = keepTaskInsertionPosition(
    sortTaskItems({ items, mode }),
    activeInsertion,
  );
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
          keepInsertionPosition: setInsertion,
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
