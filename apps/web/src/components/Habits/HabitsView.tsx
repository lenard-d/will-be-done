import { useCallback, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  activeHabits,
  activeRoutines,
  allHabitCompletions,
  archiveRoutine,
  createHabit,
  createRoutine,
  deleteRoutines,
  habitType,
  moveRoutine,
  routineType,
  UNASSIGNED_ROUTINE_ID,
  updateRoutine,
} from "@will-be-done/slices/space";
import {
  useAsyncDispatch,
  useAsyncSelector,
} from "@will-be-done/hyperdb/react";
import {
  TasksColumn,
  TasksColumnAction,
  TasksColumnGrid,
} from "@/components/TasksGrid/TasksGrid";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AddLeftIcon,
  AddRightIcon,
  MoveLeftIcon,
  MoveRightIcon,
  PencilIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { promptDialog } from "@/components/ui/prompt-dialog-service";
import type { DndModelData } from "@/lib/dnd/models";
import { buildFocusKey, useFocusStore } from "@/store/focusSlice";
import { HabitCard } from "./HabitCard";
import { buildRoutineColumns, type RoutineColumn } from "./habitLayout";
import { getRoutineMoveTarget } from "./habitInteractions";
import { buildHabitStats } from "./habitStats";

const canDropHabit = (data: DndModelData) => data.modelType === habitType;

const RoutineActionsMenu = ({
  column,
  canMoveLeft,
  canMoveRight,
  onAddHabit,
  onAddRoutine,
  onMove,
  onEdit,
  onArchive,
  onDelete,
}: {
  column: RoutineColumn;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onAddHabit: () => void;
  onAddRoutine: (edge: "top" | "bottom") => void;
  onMove: (direction: "left" | "right") => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        className="mb-2 cursor-pointer text-white lg:hidden"
        title={`${column.title} actions`}
        aria-label={`${column.title} actions`}
      >
        <MoreHorizontal className="size-4 rotate-180" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="min-w-52">
      <DropdownMenuItem onSelect={onAddHabit}>
        <Plus /> Add habit
      </DropdownMenuItem>
      {column.routine && (
        <>
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => onAddRoutine("top")}>
              <ArrowLeft /> Add routine left
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAddRoutine("bottom")}>
              <ArrowRight /> Add routine right
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canMoveLeft}
              onSelect={() => onMove("left")}
            >
              <ArrowLeft /> Move routine left
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canMoveRight}
              onSelect={() => onMove("right")}
            >
              <ArrowRight /> Move routine right
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> Edit routine
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onArchive}>
            <Archive /> Archive routine
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2 /> Delete routine
          </DropdownMenuItem>
        </>
      )}
      {!column.routine && (
        <DropdownMenuItem onSelect={() => onAddRoutine("top")}>
          <Plus /> Add routine
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
);

const RoutineColumnView = ({
  column,
  columns,
  routineIds,
}: {
  column: RoutineColumn;
  columns: RoutineColumn[];
  routineIds: string[];
}) => {
  const dispatch = useAsyncDispatch();
  const [isHidden, setIsHidden] = useState(false);
  const routineIndex = column.routine
    ? routineIds.indexOf(column.routine.id)
    : -1;

  const addHabit = useCallback(() => {
    void (async () => {
      const habit = await dispatch(
        createHabit({
          habit: {
            title: "New habit",
            routineId: column.routine?.id ?? null,
          },
        }),
      );
      setIsHidden(false);
      useFocusStore.getState().editByKey(buildFocusKey(habit.id, habitType));
    })();
  }, [column.routine?.id, dispatch]);

  const addRoutine = useCallback(
    (edge: "top" | "bottom") => {
      void (async () => {
        const title = await promptDialog("Routine name");
        if (!title?.trim()) return;
        const routine = await dispatch(createRoutine({ routine: { title } }));
        if (column.routine) {
          await dispatch(
            moveRoutine({
              id: routine.id,
              targetId: column.routine.id,
              edge,
            }),
          );
        }
      })();
    },
    [column.routine, dispatch],
  );

  const move = useCallback(
    (direction: "left" | "right") => {
      if (!column.routine) return;
      const target = getRoutineMoveTarget(
        routineIds,
        column.routine.id,
        direction,
      );
      if (target) {
        void dispatch(moveRoutine({ id: column.routine.id, ...target }));
      }
    },
    [column.routine, dispatch, routineIds],
  );

  const edit = useCallback(() => {
    if (!column.routine) return;
    void (async () => {
      const title = await promptDialog("Routine name", column.routine!.title);
      if (!title?.trim()) return;
      await dispatch(
        updateRoutine({
          id: column.routine!.id,
          routine: { title },
        }),
      );
    })();
  }, [column.routine, dispatch]);

  const archive = useCallback(() => {
    if (
      !column.routine ||
      !window.confirm(`Archive "${column.routine.title}"?`)
    ) {
      return;
    }
    void dispatch(archiveRoutine({ id: column.routine.id }));
  }, [column.routine, dispatch]);

  const remove = useCallback(() => {
    if (
      !column.routine ||
      !window.confirm(
        `Permanently delete "${column.routine.title}"? Its habits will move to HABITS.`,
      )
    ) {
      return;
    }
    void dispatch(deleteRoutines({ ids: [column.routine.id] }));
  }, [column.routine, dispatch]);

  const actionsMenu = (
    <RoutineActionsMenu
      column={column}
      canMoveLeft={routineIndex > 0}
      canMoveRight={routineIndex !== -1 && routineIndex < routineIds.length - 1}
      onAddHabit={addHabit}
      onAddRoutine={addRoutine}
      onMove={move}
      onEdit={edit}
      onArchive={archive}
      onDelete={remove}
    />
  );

  return (
    <TasksColumn
      isHidden={isHidden}
      onHideClick={() => setIsHidden((hidden) => !hidden)}
      columnModelId={column.routine?.id ?? UNASSIGNED_ROUTINE_ID}
      columnModelType={routineType}
      onAddClick={addHabit}
      addButtonLabel={`Add habit to ${column.title}`}
      canDrop={canDropHabit}
      header={
        <div className="uppercase text-content text-xl font-bold">
          {column.title}
        </div>
      }
      actions={
        <>
          {actionsMenu}
          {column.routine && (
            <>
              <TasksColumnAction
                label="Add routine to the left"
                onClick={() => addRoutine("top")}
              >
                <AddLeftIcon />
              </TasksColumnAction>
              <TasksColumnAction
                label="Add routine to the right"
                onClick={() => addRoutine("bottom")}
              >
                <AddRightIcon />
              </TasksColumnAction>
              <TasksColumnAction
                label="Move routine left"
                disabled={routineIndex <= 0}
                onClick={() => move("left")}
              >
                <MoveLeftIcon className="rotate-180" />
              </TasksColumnAction>
              <TasksColumnAction
                label="Move routine right"
                disabled={
                  routineIndex === -1 || routineIndex >= routineIds.length - 1
                }
                onClick={() => move("right")}
              >
                <MoveRightIcon className="rotate-180" />
              </TasksColumnAction>
              <TasksColumnAction label="Archive routine" onClick={archive}>
                <Archive className="size-4 rotate-180" />
              </TasksColumnAction>
              <TasksColumnAction label="Delete routine" onClick={remove}>
                <TrashIcon className="rotate-180" />
              </TasksColumnAction>
              <TasksColumnAction
                className="mb-6"
                label="Edit routine"
                onClick={edit}
              >
                <PencilIcon className="rotate-180" />
              </TasksColumnAction>
            </>
          )}
          {!column.routine && (
            <TasksColumnAction
              className="mb-6"
              label="Add routine"
              onClick={() => addRoutine("top")}
            >
              <AddLeftIcon />
            </TasksColumnAction>
          )}
        </>
      }
    >
      <div className="flex w-full flex-col gap-4 py-4">
        {column.habits.map((habit) => (
          <HabitCard key={habit.id} habit={habit} columns={columns} />
        ))}
      </div>
    </TasksColumn>
  );
};

export const HabitsView = () => {
  const dispatch = useAsyncDispatch();
  const { data: habits = [] } = useAsyncSelector({
    selector: activeHabits,
    args: {},
  });
  const { data: routines = [] } = useAsyncSelector({
    selector: activeRoutines,
    args: {},
  });
  const { data: completions = [] } = useAsyncSelector({
    selector: allHabitCompletions,
    args: {},
  });
  const metrics = useMemo(
    () => buildHabitStats([], habits, completions).habits,
    [habits, completions],
  );
  const columns = useMemo(
    () => buildRoutineColumns(routines, metrics),
    [routines, metrics],
  );
  const routineIds = useMemo(
    () =>
      columns.flatMap((column) => (column.routine ? [column.routine.id] : [])),
    [columns],
  );

  const addRoutine = useCallback(() => {
    void (async () => {
      const title = await promptDialog("Routine name");
      if (!title?.trim()) return;
      await dispatch(createRoutine({ routine: { title } }));
    })();
  }, [dispatch]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="w-full flex-shrink-0 pt-11 sm:pt-5 mb-6">
        <div className="max-w-lg mx-auto px-4">
          <h1 className="text-3xl font-bold uppercase text-content leading-tight">
            Habits
          </h1>
        </div>
      </header>

      <div className="flex-1 min-h-0">
        <TasksColumnGrid columnsCount={Math.max(columns.length, 1)}>
          {columns.length === 0 ? (
            <TasksColumn
              isHidden
              onHideClick={addRoutine}
              columnModelId="virtual:habit-routine:create"
              columnModelType={routineType}
              onAddClick={addRoutine}
              addButtonLabel="Add routine"
              canDrop={() => false}
              header={
                <div className="uppercase text-content text-xl font-bold">
                  ROUTINES
                </div>
              }
            >
              {null}
            </TasksColumn>
          ) : (
            columns.map((column) => (
              <RoutineColumnView
                key={column.id}
                column={column}
                columns={columns}
                routineIds={routineIds}
              />
            ))
          )}
        </TasksColumnGrid>
      </div>
    </div>
  );
};
