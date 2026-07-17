import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Flame, Trash2 } from "lucide-react";
import {
  activeHabits,
  activeRoutines,
  allHabitCompletions,
  archiveHabit,
  archiveRoutine,
  createHabit,
  createRoutine,
  deleteHabits,
  deleteRoutines,
  toggleHabitToday,
  updateHabit,
  updateRoutine,
} from "@will-be-done/slices/space";
import {
  useAsyncDispatch,
  useAsyncSelector,
} from "@will-be-done/hyperdb/react";
import { cn } from "@/lib/utils.ts";
import { buildHabitStats } from "./habitStats";
import {
  buildRoutineColumns,
  type HabitMetricWithRoutine,
  type RoutineColumn,
} from "./habitLayout";

type SelectedTarget =
  | { type: "habit"; id: string }
  | { type: "routine"; id: string }
  | null;

const AddInline = ({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (title: string) => void;
}) => {
  const [title, setTitle] = useState("");
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        onAdd(title);
        setTitle("");
      }}
    >
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent py-1 text-sm text-content placeholder:text-content-tinted/35 focus:outline-none"
      />
      <button
        type="submit"
        disabled={!title.trim()}
        className="text-xs font-medium uppercase tracking-[0.12em] text-accent disabled:text-content-tinted/35"
      >
        add
      </button>
    </form>
  );
};

const HabitLine = ({
  habit,
  selected,
  onSelect,
}: {
  habit: HabitMetricWithRoutine;
  selected: boolean;
  onSelect: () => void;
}) => {
  const dispatch = useAsyncDispatch();
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg px-2 py-2 text-sm ring-1 transition-colors",
        selected
          ? "bg-panel-tinted ring-accent/60"
          : "ring-transparent hover:bg-panel-tinted/60 hover:ring-ring/50",
      )}
      onClick={onSelect}
    >
      <button
        type="button"
        aria-label={habit.isDoneToday ? "Uncheck habit" : "Check habit"}
        onClick={(event) => {
          event.stopPropagation();
          void dispatch(toggleHabitToday({ habitId: habit.id }));
        }}
        className={cn(
          "h-4 w-4 shrink-0 rounded border transition-colors",
          habit.isDoneToday
            ? "border-accent bg-accent"
            : "border-content-tinted/35 hover:border-accent",
        )}
      />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate text-content",
            habit.isDoneToday && "text-content-tinted line-through",
          )}
        >
          {habit.title}
        </div>
        <div className="mt-0.5 text-[11px] text-content-tinted/60">
          {habit.targetTime ? `${habit.targetTime} · ` : ""}
          {habit.lastCompletedAt
            ? formatDistanceToNow(habit.lastCompletedAt, { addSuffix: true })
            : "never"}
        </div>
      </div>
      <div className="flex items-center gap-1 text-[11px] tabular-nums text-content-tinted">
        <Flame
          className={cn(
            "h-3.5 w-3.5",
            habit.currentStreak > 0 && "fill-accent text-accent",
          )}
        />
        {habit.currentStreak}
      </div>
    </div>
  );
};

const RoutineColumnView = ({
  column,
  selected,
  onSelect,
}: {
  column: RoutineColumn;
  selected: SelectedTarget;
  onSelect: (target: SelectedTarget) => void;
}) => {
  const dispatch = useAsyncDispatch();
  return (
    <section className="flex min-w-[280px] flex-1 flex-col">
      <button
        type="button"
        className="mb-5 text-left"
        onClick={() =>
          column.routine &&
          onSelect({ type: "routine", id: column.routine.id })
        }
      >
        <div className="text-xs text-subheader">
          {column.habits.length} habits
        </div>
        <h2 className="text-3xl font-bold uppercase tracking-tight text-content">
          {column.title}
        </h2>
      </button>
      <div className="flex flex-col gap-2">
        {column.habits.map((habit) => (
          <HabitLine
            key={habit.id}
            habit={habit}
            selected={selected?.type === "habit" && selected.id === habit.id}
            onSelect={() => onSelect({ type: "habit", id: habit.id })}
          />
        ))}
        <div className="mt-2 rounded-lg border border-dashed border-ring/70 px-3 py-2">
          <AddInline
            placeholder="Add habit..."
            onAdd={(title) =>
              void dispatch(
                createHabit({
                  habit: { title, routineId: column.routine?.id ?? null },
                }),
              )
            }
          />
        </div>
      </div>
    </section>
  );
};

const DetailPane = ({
  selected,
  habits,
  columns,
  onClear,
}: {
  selected: SelectedTarget;
  habits: HabitMetricWithRoutine[];
  columns: RoutineColumn[];
  onClear: () => void;
}) => {
  const dispatch = useAsyncDispatch();
  const selectedHabit =
    selected?.type === "habit"
      ? habits.find((habit) => habit.id === selected.id)
      : undefined;
  const selectedRoutine =
    selected?.type === "routine"
      ? columns.find((column) => column.routine?.id === selected.id)?.routine
      : undefined;

  if (!selectedHabit && !selectedRoutine) {
    return (
      <aside className="hidden w-72 shrink-0 border-l border-ring/50 px-5 py-8 xl:block">
        <div className="text-xs uppercase tracking-widest text-content-tinted">
          Select a habit or routine to edit it.
        </div>
      </aside>
    );
  }

  if (selectedHabit) {
    return (
      <aside className="hidden w-72 shrink-0 border-l border-ring/50 px-5 py-8 xl:block">
        <label className="text-xs uppercase tracking-widest text-content-tinted">
          Habit title
          <input
            defaultValue={selectedHabit.title}
            key={selectedHabit.id}
            onBlur={(event) =>
              void dispatch(
                updateHabit({
                  id: selectedHabit.id,
                  habit: { title: event.target.value },
                }),
              )
            }
            className="mt-2 w-full rounded-md bg-panel-tinted px-3 py-2 text-content ring-1 ring-ring"
          />
        </label>
        <label className="mt-5 block text-xs uppercase tracking-widest text-content-tinted">
          Time
          <input
            type="time"
            value={selectedHabit.targetTime ?? ""}
            onChange={(event) =>
              void dispatch(
                updateHabit({
                  id: selectedHabit.id,
                  habit: { targetTime: event.target.value || null },
                }),
              )
            }
            className="mt-2 w-full rounded-md bg-panel-tinted px-3 py-2 text-content ring-1 ring-ring"
          />
        </label>
        <label className="mt-5 block text-xs uppercase tracking-widest text-content-tinted">
          Routine
          <select
            value={selectedHabit.routineId ?? ""}
            onChange={(event) =>
              void dispatch(
                updateHabit({
                  id: selectedHabit.id,
                  habit: { routineId: event.target.value || null },
                }),
              )
            }
            className="mt-2 w-full rounded-md bg-panel-tinted px-3 py-2 text-content ring-1 ring-ring"
          >
            <option value="">HABITS</option>
            {columns
              .filter((column) => column.routine)
              .map((column) => (
                <option key={column.id} value={column.id}>
                  {column.title}
                </option>
              ))}
          </select>
        </label>
        <button
          type="button"
          className="mt-8 w-full rounded-md bg-panel-tinted px-3 py-2 text-left text-xs uppercase tracking-widest text-content-tinted hover:text-content"
          onClick={() => {
            void dispatch(archiveHabit({ id: selectedHabit.id }));
            onClear();
          }}
        >
          Archive habit
        </button>
        <button
          type="button"
          className="mt-2 w-full rounded-md bg-panel-tinted px-3 py-2 text-left text-xs uppercase tracking-widest text-red-400"
          onClick={() => {
            if (!confirm("Permanently delete this habit and its history?")) return;
            void dispatch(deleteHabits({ ids: [selectedHabit.id] }));
            onClear();
          }}
        >
          <Trash2 className="mr-2 inline h-3 w-3" /> Delete permanently
        </button>
      </aside>
    );
  }

  return (
    <aside className="hidden w-72 shrink-0 border-l border-ring/50 px-5 py-8 xl:block">
      <label className="text-xs uppercase tracking-widest text-content-tinted">
        Routine title
        <input
          defaultValue={selectedRoutine!.title}
          key={selectedRoutine!.id}
          onBlur={(event) =>
            void dispatch(
              updateRoutine({
                id: selectedRoutine!.id,
                routine: { title: event.target.value },
              }),
            )
          }
          className="mt-2 w-full rounded-md bg-panel-tinted px-3 py-2 text-content ring-1 ring-ring"
        />
      </label>
      <button
        type="button"
        className="mt-8 w-full rounded-md bg-panel-tinted px-3 py-2 text-left text-xs uppercase tracking-widest text-content-tinted"
        onClick={() => {
          void dispatch(archiveRoutine({ id: selectedRoutine!.id }));
          onClear();
        }}
      >
        Archive routine
      </button>
      <button
        type="button"
        className="mt-2 w-full rounded-md bg-panel-tinted px-3 py-2 text-left text-xs uppercase tracking-widest text-red-400"
        onClick={() => {
          if (!confirm("Permanently delete this routine?")) return;
          void dispatch(deleteRoutines({ ids: [selectedRoutine!.id] }));
          onClear();
        }}
      >
        Delete permanently
      </button>
    </aside>
  );
};

export const HabitsView = () => {
  const dispatch = useAsyncDispatch();
  const [selected, setSelected] = useState<SelectedTarget>(null);
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

  return (
    <div className="flex h-full min-h-0 bg-surface">
      <main className="min-w-0 flex-1 overflow-auto px-6 py-10">
        <header className="mb-8 flex items-end justify-between gap-6">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-accent/75">
              routines
            </div>
            <h1 className="mt-2 text-4xl font-bold uppercase text-content">
              habits
            </h1>
          </div>
          <div className="w-72 rounded-lg border border-dashed border-ring px-3 py-2">
            <AddInline
              placeholder="Add routine..."
              onAdd={(title) =>
                void dispatch(createRoutine({ routine: { title } }))
              }
            />
          </div>
        </header>
        <div className="flex min-w-max gap-8 pb-8">
          {columns.map((column) => (
            <RoutineColumnView
              key={column.id}
              column={column}
              selected={selected}
              onSelect={setSelected}
            />
          ))}
        </div>
      </main>
      <DetailPane
        selected={selected}
        habits={metrics}
        columns={columns}
        onClear={() => setSelected(null)}
      />
    </div>
  );
};
