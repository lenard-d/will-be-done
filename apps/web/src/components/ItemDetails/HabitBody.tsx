import { useCallback, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Archive,
  CalendarDays,
  Clock3,
  Flame,
  FolderInput,
  History,
  Trash2,
} from "lucide-react";
import {
  activeRoutines,
  archiveHabit,
  deleteHabits,
  habitCompletionsByHabitId,
  moveHabit,
  toggleHabitToday,
  UNASSIGNED_ROUTINE_ID,
  updateHabit,
  type Habit,
} from "@will-be-done/slices/space";
import {
  useAsyncDispatch,
  useAsyncSelector,
} from "@will-be-done/hyperdb/react";
import { CheckboxComp } from "@/components/Checklist/Checklist";
import { getDOMSiblings } from "@/components/Focus/domNavigation";
import {
  getHabitRoutineSelection,
  normalizeTargetTimeInput,
} from "@/components/Habits/habitInteractions";
import { buildHabitStats } from "@/components/Habits/habitStats";
import { buildFocusKey, useFocusStore } from "@/store/focusSlice";
import { useTitleEditing } from "./hooks";
import { DetailRow, EditableTitle } from "./shared";
import { HabitHeatmap } from "./HabitHeatmap";

export function HabitBody({
  habit,
  isEditingTitle,
  setIsEditingTitle,
}: {
  habit: Habit;
  isEditingTitle: boolean;
  setIsEditingTitle: (value: boolean) => void;
}) {
  const dispatch = useAsyncDispatch();
  const { data: routines = [] } = useAsyncSelector({
    selector: activeRoutines,
    args: {},
  });
  const { data: completions = [] } = useAsyncSelector({
    selector: habitCompletionsByHabitId,
    args: { habitId: habit.id },
  });
  const metric = useMemo(
    () => buildHabitStats([], [habit], completions).habits[0],
    [completions, habit],
  );
  const [targetTimeError, setTargetTimeError] = useState<string | null>(null);
  const skipNextTargetTimeBlurRef = useRef(false);

  const {
    editingTitle,
    setTitleDraft,
    saveTitle,
    handleTitleKeyDown,
    textareaRef,
  } = useTitleEditing({
    title: habit.title,
    setIsEditingTitle,
    onSave: useCallback(
      (title: string) =>
        void dispatch(updateHabit({ id: habit.id, habit: { title } })),
      [dispatch, habit.id],
    ),
  });

  const saveTargetTime = useCallback((value: string) => {
    const targetTime = normalizeTargetTimeInput(value);
    if (targetTime === undefined) {
      setTargetTimeError("Use 24-hour HH:MM format.");
      return false;
    }
    setTargetTimeError(null);
    if (targetTime !== habit.targetTime) {
      void dispatch(
        updateHabit({ id: habit.id, habit: { targetTime } }),
      );
    }
    return true;
  }, [dispatch, habit.id, habit.targetTime]);

  const focusAfterRemoval = useCallback(() => {
    const focusKey = buildFocusKey(habit.id, habit.type);
    const [upKey, downKey] = getDOMSiblings(focusKey);
    const nextKey = downKey ?? upKey;
    if (nextKey) useFocusStore.getState().focusByKey(nextKey);
    else useFocusStore.getState().resetFocus();
  }, [habit.id, habit.type]);

  return (
    <div className="px-3 py-3 space-y-3">
      <EditableTitle
        icon={
          <CheckboxComp
            checked={metric?.isDoneToday ?? false}
            onChange={() =>
              void dispatch(toggleHabitToday({ habitId: habit.id }))
            }
            ariaLabel={
              metric?.isDoneToday ? "Mark habit as todo" : "Mark habit as done"
            }
          />
        }
        isEditing={isEditingTitle}
        editingTitle={editingTitle}
        titleClassName={
          metric?.isDoneToday
            ? "line-through text-content-tinted"
            : "text-content"
        }
        setTitleDraft={setTitleDraft}
        handleTitleKeyDown={handleTitleKeyDown}
        textareaRef={textareaRef}
        saveTitle={saveTitle}
        setIsEditingTitle={setIsEditingTitle}
        ariaLabel="Edit habit title in details"
      />

      <div className="space-y-2 text-xs">
        <DetailRow
          icon={<FolderInput className="h-3 w-3 shrink-0" />}
          label="Routine"
        >
          <select
            aria-label="Habit routine"
            value={getHabitRoutineSelection(
              habit.routineId,
              routines,
              UNASSIGNED_ROUTINE_ID,
            )}
            onChange={(event) =>
              void dispatch(
                moveHabit({
                  id: habit.id,
                  routineId:
                    event.target.value === UNASSIGNED_ROUTINE_ID
                      ? null
                      : event.target.value,
                  position: "append",
                }),
              )
            }
            className="bg-transparent text-content text-xs focus:outline-none cursor-pointer rounded px-1 -mx-1 hover:bg-task-panel-hover transition-colors"
          >
            <option
              value={UNASSIGNED_ROUTINE_ID}
              className="bg-panel text-content"
            >
              Unassigned
            </option>
            {routines.map((routine) => (
              <option
                key={routine.id}
                value={routine.id}
                className="bg-panel text-content"
              >
                {routine.title}
              </option>
            ))}
          </select>
        </DetailRow>

        <DetailRow
          icon={<Clock3 className="h-3 w-3 shrink-0" />}
          label="Target"
        >
          <div>
            <input
              key={`${habit.id}:${habit.targetTime ?? ""}`}
              aria-label="Habit target time"
              defaultValue={habit.targetTime ?? ""}
              placeholder="Any time"
              inputMode="numeric"
              onChange={() => {
                setTargetTimeError(null);
              }}
              onBlur={(event) => {
                if (skipNextTargetTimeBlurRef.current) {
                  skipNextTargetTimeBlurRef.current = false;
                  return;
                }
                saveTargetTime(event.currentTarget.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (saveTargetTime(event.currentTarget.value)) {
                    skipNextTargetTimeBlurRef.current = true;
                    event.currentTarget.blur();
                  }
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  event.currentTarget.value = habit.targetTime ?? "";
                  setTargetTimeError(null);
                  skipNextTargetTimeBlurRef.current = true;
                  event.currentTarget.blur();
                }
              }}
              aria-invalid={targetTimeError ? true : undefined}
              className="w-20 rounded bg-transparent px-1 -mx-1 text-content placeholder:italic placeholder:text-content-tinted focus:outline-none focus:ring-1 focus:ring-accent hover:bg-task-panel-hover"
            />
            {targetTimeError && (
              <div className="mt-1 text-[11px] text-notice" role="alert">
                {targetTimeError}
              </div>
            )}
          </div>
        </DetailRow>

        <DetailRow
          icon={<CalendarDays className="h-3 w-3 shrink-0" />}
          label="Created"
        >
          {format(new Date(habit.createdAt), "MMM d, yyyy, h:mm a")}
        </DetailRow>

        <DetailRow
          icon={<Flame className="h-3 w-3 shrink-0" />}
          label="Current streak"
        >
          {metric?.currentStreak ?? 0} days
        </DetailRow>

        <DetailRow
          icon={<History className="h-3 w-3 shrink-0" />}
          label="Last completion"
        >
          {metric?.lastCompletedAt
            ? format(
                new Date(metric.lastCompletedAt),
                "MMM d, yyyy, h:mm a",
              )
            : "Never"}
        </DetailRow>
      </div>

      <HabitHeatmap
        habitId={habit.id}
        habitCreatedAt={habit.createdAt}
        completions={completions}
      />

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            if (!window.confirm("Archive this habit?")) return;
            void dispatch(archiveHabit({ id: habit.id }));
            focusAfterRemoval();
          }}
          className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs font-medium text-content-tinted transition-colors hover:bg-task-panel-hover hover:text-content"
        >
          <Archive className="h-3 w-3" />
          Archive
        </button>
        <button
          type="button"
          onClick={() => {
            if (
              !window.confirm(
                "Permanently delete this habit and its history?",
              )
            ) {
              return;
            }
            void dispatch(deleteHabits({ ids: [habit.id] }));
            focusAfterRemoval();
          }}
          className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs font-medium text-notice transition-colors hover:bg-task-panel-hover"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
      </div>
    </div>
  );
}
