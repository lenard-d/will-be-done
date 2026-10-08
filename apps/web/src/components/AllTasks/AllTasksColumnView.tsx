import { useRef, useState } from "react";
import { format, parse } from "date-fns";
import { useAsyncDispatch, useSelectAsync } from "@will-be-done/hyperdb/react";
import {
  createTaskInAllTasksColumn,
  deleteAllTasksColumn,
  emptyTaskFilters,
  moveAllTasksColumn,
  taskFiltersSchema,
  updateAllTasksColumn,
  allTasksColumnById,
  type AllTasksColumn,
  type ItemForDisplay,
  type TaskFilters,
} from "@will-be-done/slices/space";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  TasksColumn,
  TasksColumnAction,
} from "@/components/TasksGrid/TasksGrid";
import { TaskOptionsMenu } from "@/components/TaskHeader/TaskOptionsMenu";
import { SortedTaskList } from "@/components/TaskSorting/SortedTaskList";
import {
  sortTaskItems,
  type TaskSortMode,
} from "@/components/TaskSorting/taskSorting";
import { PreloadedTaskComp } from "@/components/Task/Task";
import {
  AddRightIcon,
  MoveLeftIcon,
  MoveRightIcon,
  PencilIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { promptDialog } from "@/components/ui/prompt-dialog-service";
import {
  buildFocusKey,
  parseColumnKey,
  prepareTextInputFocus,
  useFocusStore,
} from "@/store/focusSlice";
import { countTaskFilters, filterTaskItems } from "./taskFilters";
import { TaskFilterFields } from "./TaskFilterFields";

function parseFilters(filtersJson: string) {
  try {
    return taskFiltersSchema.safeParse(JSON.parse(filtersJson));
  } catch {
    return taskFiltersSchema.safeParse(null);
  }
}

function TaskGroup({
  title,
  items,
  mode,
  focusScope,
  taskCount,
}: {
  title: string;
  items: ItemForDisplay[];
  mode: TaskSortMode;
  focusScope: string;
  taskCount?: string;
}) {
  const groups = new Map<string, ItemForDisplay[]>();
  for (const item of sortTaskItems({ items, mode })) {
    const date = mode === "date" ? (item.dailyList?.date ?? "unscheduled") : "";
    const group = groups.get(date) ?? [];
    group.push(item);
    groups.set(date, group);
  }
  return (
    <section aria-label={title} className="mb-3">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-content">{title}</h2>
        {taskCount && (
          <p
            role="status"
            className="whitespace-nowrap text-xs text-content-tinted"
          >
            {taskCount}
          </p>
        )}
      </div>
      {[...groups].map(([date, tasks]) => (
        <div key={date} className="mb-5">
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
            <SortedTaskList
              items={tasks}
              mode={mode}
              blockManual
              focusScope={focusScope}
            >
              {(data) => (
                <PreloadedTaskComp
                  item={data.item}
                  section={data.section}
                  listItem={data.listItem}
                  project={data.project}
                  lastScheduleTime={data.lastScheduleTime}
                  hasCheclistItems={data.hasChecklist}
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

export function AllTasksColumnView({
  column,
  items,
  mode,
  index,
  columnCount,
  ensureColumns,
  onAddColumn,
}: {
  column: AllTasksColumn;
  items: ItemForDisplay[];
  mode: TaskSortMode;
  index: number;
  columnCount: number;
  ensureColumns: () => Promise<AllTasksColumn>;
  onAddColumn: (afterId?: string) => void;
}) {
  const dispatch = useAsyncDispatch();
  const select = useSelectAsync();
  const isMobile = useIsMobile();
  const [isHidden, setIsHidden] = useState(false);
  const [error, setError] = useState<string>();
  const failedWrite = useRef<(() => Promise<unknown>) | undefined>(undefined);
  const writes = useRef(Promise.resolve());
  const parsed = parseFilters(column.filtersJson);
  const filters = parsed.success ? parsed.data : emptyTaskFilters;
  const focusScope = `all-tasks:${column.id}`;
  const editKey = useFocusStore((state) => state.editItemKey);
  const editing = editKey ? parseColumnKey(editKey) : undefined;
  const editingTaskId =
    editing?.type === "task" && editing.component === focusScope
      ? editing.id
      : undefined;
  const filtered = filterTaskItems(items, filters, editingTaskId);
  const todo = filtered.filter(
    (data) => data.item.type === "task" && data.item.state === "todo",
  );
  const done = filtered.filter(
    (data) => data.item.type === "task" && data.item.state === "done",
  );
  const taskCount = `${filtered.length} of ${items.length} tasks`;

  const runChange = (change: () => Promise<unknown>) => {
    writes.current = writes.current.then(async () => {
      setError(undefined);
      try {
        await ensureColumns();
        await change();
        failedWrite.current = undefined;
      } catch {
        failedWrite.current = change;
        setError("Could not save this column. Try again.");
      }
    });
    return writes.current;
  };
  const updateFilters = (update: Partial<TaskFilters>) =>
    runChange(async () => {
      const current = await select({
        selector: allTasksColumnById,
        args: { id: column.id },
      });
      const currentFilters = current
        ? parseFilters(current.filtersJson)
        : parsed;
      await dispatch(
        updateAllTasksColumn({
          id: column.id,
          filtersJson: JSON.stringify({
            ...(currentFilters.success
              ? currentFilters.data
              : emptyTaskFilters),
            ...update,
          }),
        }),
      );
    });
  const rename = async () => {
    const title = await promptDialog("Column name", column.title);
    if (!title?.trim()) return;
    await runChange(() =>
      dispatch(updateAllTasksColumn({ id: column.id, title })),
    );
  };
  const addTask = () => {
    prepareTextInputFocus();
    setIsHidden(false);
    void runChange(async () => {
      const task = await dispatch(
        createTaskInAllTasksColumn({ columnId: column.id }),
      );
      useFocusStore
        .getState()
        .editByKey(buildFocusKey(task.id, task.type, focusScope));
    });
  };
  return (
    <section
      aria-label={`${column.title} column`}
      data-all-tasks-column={column.id}
      className="h-full min-h-0"
    >
      <TasksColumn
        isHidden={isHidden}
        onHideClick={() => setIsHidden((hidden) => !hidden)}
        header={
          <div className="whitespace-nowrap uppercase text-content text-xl font-bold">
            {column.title}
          </div>
        }
        columnModelId={column.id}
        columnModelType={column.type}
        panelWidth={isMobile ? "calc(100vw - 2rem)" : 400}
        canDrop={() => false}
        onAddClick={addTask}
        addButtonLabel="Add task"
        actions={
          <>
            <TaskOptionsMenu
              viewKey="all-tasks"
              activeFilterCount={countTaskFilters(filters)}
              triggerClassName="mb-2 size-4 sm:size-4 self-center rotate-180 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:focus:opacity-100 sm:data-[state=open]:opacity-100 border-0 sm:border-0 [&>svg]:size-4"
            >
              <TaskFilterFields
                filters={filters}
                onChange={updateFilters}
                onReset={() => void updateFilters(emptyTaskFilters)}
                needsReset={!parsed.success}
              />
            </TaskOptionsMenu>
            <TasksColumnAction
              label="Add column to the right"
              onClick={() => onAddColumn(column.id)}
            >
              <AddRightIcon />
            </TasksColumnAction>
            <TasksColumnAction
              label="Move column left"
              disabled={index === 0}
              onClick={() =>
                void runChange(() =>
                  dispatch(
                    moveAllTasksColumn({ id: column.id, direction: "left" }),
                  ),
                )
              }
            >
              <MoveLeftIcon className="rotate-180" />
            </TasksColumnAction>
            <TasksColumnAction
              label="Move column right"
              disabled={index === columnCount - 1}
              onClick={() =>
                void runChange(() =>
                  dispatch(
                    moveAllTasksColumn({ id: column.id, direction: "right" }),
                  ),
                )
              }
            >
              <MoveRightIcon className="rotate-180" />
            </TasksColumnAction>
            <TasksColumnAction
              label="Delete column"
              disabled={columnCount === 1}
              onClick={() =>
                void runChange(() =>
                  dispatch(deleteAllTasksColumn({ id: column.id })),
                )
              }
            >
              <TrashIcon className="rotate-180" />
            </TasksColumnAction>
            <TasksColumnAction
              label="Edit column name"
              className="mb-6"
              onClick={() => void rename()}
            >
              <PencilIcon className="rotate-180" />
            </TasksColumnAction>
          </>
        }
      >
        <div className="flex flex-col gap-4 w-full py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-4">
          {(error || !parsed.success) && (
            <p role="alert" className="text-sm text-notice">
              {error ??
                "Could not load column filters. Reset the filters to recover."}
              {error && (
                <button
                  type="button"
                  className="ml-2 underline"
                  onClick={() => {
                    const retry = failedWrite.current;
                    if (retry) void runChange(retry);
                  }}
                >
                  Retry save
                </button>
              )}
            </p>
          )}
          {filtered.length === 0 && (
            <>
              <p role="status" className="text-xs text-content-tinted">
                {taskCount}
              </p>
              <p role="status" className="text-sm text-content-tinted">
                {items.length
                  ? "No tasks match these filters."
                  : "Add a task in Inbox or a project."}
              </p>
            </>
          )}
          {todo.length > 0 && (
            <TaskGroup
              title="To do"
              items={todo}
              mode={mode}
              focusScope={focusScope}
              taskCount={taskCount}
            />
          )}
          {done.length > 0 && (
            <TaskGroup
              title="Done"
              items={done}
              mode={mode}
              focusScope={focusScope}
              taskCount={todo.length === 0 ? taskCount : undefined}
            />
          )}
        </div>
      </TasksColumn>
    </section>
  );
}
