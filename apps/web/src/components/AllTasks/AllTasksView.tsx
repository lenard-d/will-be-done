import { useState } from "react";
import {
  useAsyncDispatch,
  useAsyncSelector,
} from "@will-be-done/hyperdb/react";
import {
  allTasksForDisplay,
  createAllTasksColumn,
  emptyTaskFilters,
} from "@will-be-done/slices/space";
import { useTaskSorting } from "@/components/TaskSorting/useTaskSorting";
import { TasksColumnGrid } from "@/components/TasksGrid/TasksGrid";
import { Stash } from "@/components/Stash/Stash";
import { useStashDesktopOffset } from "@/components/Stash/useStashDesktopOffset";
import { STASH_BUTTON_WIDTH } from "@/components/DaysBoard/StashStore";
import { MobileTaskHeader } from "@/components/TaskHeader/MobileTaskHeader";
import { PlusIcon } from "@/components/ui/icons";
import { promptDialog } from "@/components/ui/prompt-dialog-service";
import { useIsMobile } from "@/hooks/use-mobile";
import { Route } from "@/routes/spaces.$spaceId";
import { AllTasksColumnView } from "./AllTasksColumnView";
import { useAllTasksColumns } from "./useAllTasksColumns";

export function AllTasksView() {
  const { spaceId } = Route.useParams();
  const dispatch = useAsyncDispatch();
  const {
    columns,
    ensureColumns,
    error: columnError,
  } = useAllTasksColumns(spaceId);
  const {
    data: items = [],
    isFetching,
    error,
  } = useAsyncSelector({ selector: allTasksForDisplay, args: {} });
  const { sortMode } = useTaskSorting("all-tasks");
  const stashOffset = useStashDesktopOffset();
  const isMobile = useIsMobile();
  const [saveError, setSaveError] = useState<string>();
  const addColumn = async (afterId?: string) => {
    const title = await promptDialog("Column name");
    if (!title?.trim()) return;
    try {
      await ensureColumns();
      await dispatch(
        createAllTasksColumn({
          title,
          filtersJson: JSON.stringify(emptyTaskFilters),
          afterId,
        }),
      );
      setSaveError(undefined);
    } catch {
      setSaveError("Could not add the column. Try again.");
    }
  };
  const taskCount = `${items.length} ${items.length === 1 ? "task" : "tasks"}`;
  const addButton = (
    <button
      type="button"
      aria-label="Add column"
      title="Add column"
      onClick={() => void addColumn()}
      className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded text-content hover:bg-panel-hover outline-none focus-visible:ring-2 focus-visible:ring-accent sm:size-9"
    >
      <PlusIcon />
    </button>
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
        {isMobile ? (
          <MobileTaskHeader
            title="All tasks"
            count={taskCount}
            menu={addButton}
          />
        ) : (
          <header
            data-command-palette-swipe-region
            className="flex shrink-0 items-center gap-3 px-4 py-5"
          >
            <h1 className="text-3xl font-bold text-content">All tasks</h1>
            <p role="status" className="text-xs text-content-tinted">
              {taskCount}
            </p>
            {addButton}
          </header>
        )}
        {(error || columnError || saveError) && (
          <p role="alert" className="px-4 text-sm text-notice">
            {saveError ?? "Could not load tasks."}
          </p>
        )}
        {isFetching && items.length === 0 && (
          <p role="status" className="px-4 text-sm text-content-tinted">
            Loading tasks...
          </p>
        )}
        <div
          id="main-scrollable-area"
          data-scroll-restoration-id="all-tasks-scroll"
          className="min-h-0 flex-1 overflow-hidden pb-4"
        >
          <TasksColumnGrid
            columnsCount={columns.length}
            paddingLeft={
              !isMobile && !stashOffset ? STASH_BUTTON_WIDTH : undefined
            }
          >
            {columns.map((column, index) => (
              <AllTasksColumnView
                key={column.id}
                column={column}
                items={items}
                mode={sortMode}
                index={index}
                columnCount={columns.length}
                ensureColumns={ensureColumns}
                onAddColumn={(afterId) => void addColumn(afterId)}
              />
            ))}
          </TasksColumnGrid>
        </div>
      </div>
    </div>
  );
}
