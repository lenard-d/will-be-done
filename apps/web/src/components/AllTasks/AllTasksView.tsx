import { format, parse } from "date-fns";
import { useAsyncSelector } from "@will-be-done/hyperdb/react";
import {
  allTasksForDisplay,
  type ItemForDisplay,
} from "@will-be-done/slices/space";
import { PreloadedTaskComp } from "@/components/Task/Task";
import { SortedTaskList } from "@/components/TaskSorting/SortedTaskList";
import {
  sortTaskItems,
  type TaskSortMode,
} from "@/components/TaskSorting/taskSorting";
import { useTaskSorting } from "@/components/TaskSorting/useTaskSorting";
import { Stash } from "@/components/Stash/Stash";
import { useStashDesktopOffset } from "@/components/Stash/useStashDesktopOffset";
import { Route } from "@/routes/spaces.$spaceId";
import { TaskFilterBar } from "./TaskFilterBar";
import { useTaskFilters } from "./useTaskFilters";
import { filterTaskItems } from "./taskFilters";
import { parseColumnKey, useFocusStore } from "@/store/focusSlice";

function TaskGroup({
  title,
  items,
  mode,
}: {
  title: string;
  items: ItemForDisplay[];
  mode: TaskSortMode;
}) {
  const groups = new Map<string, ItemForDisplay[]>();
  for (const item of sortTaskItems({ items, mode })) {
    const date = mode === "date" ? (item.dailyList?.date ?? "unscheduled") : "";
    const group = groups.get(date) ?? [];
    group.push(item);
    groups.set(date, group);
  }

  return (
    <section className="mb-6" aria-label={title}>
      <h2 className="mb-3 text-sm font-semibold text-content">{title}</h2>
      {[...groups].map(([date, tasks]) => (
        <div key={date} data-focus-column className="mb-5">
          {date && (
            <h3 className="mb-2 text-xs text-content-tinted">
              {date === "unscheduled"
                ? "Unscheduled"
                : format(
                    parse(date, "yyyy-MM-dd", new Date()),
                    "EEE, d MMM yyyy",
                  )}
            </h3>
          )}
          <div className="flex flex-col gap-3">
            <SortedTaskList items={tasks} mode={mode} blockManual>
              {(displayData) => (
                <PreloadedTaskComp
                  item={displayData.item}
                  section={displayData.section}
                  listItem={displayData.listItem}
                  project={displayData.project}
                  lastScheduleTime={displayData.lastScheduleTime}
                  hasCheclistItems={displayData.hasChecklist}
                  alwaysShowProject
                  displayLastScheduleTime
                />
              )}
            </SortedTaskList>
          </div>
        </div>
      ))}
    </section>
  );
}

export function AllTasksView() {
  const { spaceId } = Route.useParams();
  const { filters, updateFilters, resetFilters } = useTaskFilters(spaceId);
  const editItemKey = useFocusStore((state) => state.editItemKey);
  const editingTaskId = editItemKey?.startsWith("task^^")
    ? parseColumnKey(editItemKey).id
    : undefined;
  const {
    data: items = [],
    isFetching,
    error,
  } = useAsyncSelector({
    selector: allTasksForDisplay,
    args: {},
  });
  const { sortMode } = useTaskSorting("all-tasks");
  const stashOffset = useStashDesktopOffset();
  const filteredItems = filterTaskItems(items, filters, editingTaskId);
  const todoItems = filteredItems.filter(
    (entry) => entry.item.type === "task" && entry.item.state === "todo",
  );
  const doneItems = filteredItems.filter(
    (entry) => entry.item.type === "task" && entry.item.state === "done",
  );

  return (
    <div
      className="relative h-full min-w-0 overflow-hidden"
      data-task-sort-view="all-tasks"
    >
      <Stash />
      <div
        className="flex h-full min-w-0 flex-col"
        style={{ marginLeft: stashOffset ? `${stashOffset}px` : undefined }}
      >
        <TaskFilterBar
          items={items}
          filters={filters}
          onChange={updateFilters}
          onReset={resetFilters}
          resultCount={filteredItems.length}
        />
        <div
          id="main-scrollable-area"
          data-scroll-restoration-id="all-tasks-scroll"
          data-focus-region-direction="column"
          className="flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="mx-auto max-w-3xl px-4 pb-24">
            {error ? (
              <p className="text-sm text-notice" role="alert">
                Could not load tasks.
              </p>
            ) : items.length === 0 ? (
              <p className="text-sm text-content-tinted" role="status">
                {isFetching
                  ? "Loading tasks..."
                  : "Add a task in Inbox or a project."}
              </p>
            ) : filteredItems.length === 0 ? (
              <p className="text-sm text-content-tinted" role="status">
                No tasks match these filters.
              </p>
            ) : (
              <>
                {todoItems.length > 0 && (
                  <TaskGroup title="To do" items={todoItems} mode={sortMode} />
                )}
                {doneItems.length > 0 && (
                  <TaskGroup title="Done" items={doneItems} mode={sortMode} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
