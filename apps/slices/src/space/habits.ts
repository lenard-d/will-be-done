import {
  deleteRows,
  insert,
  selectFrom,
  upsert,
  v,
} from "@will-be-done/hyperdb";
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import { uuidv7 } from "uuidv7";
import { action, selector } from "../builders";
import { registerModelSlice } from "./maps";
import {
  type Habit,
  type HabitRecord,
  type Routine,
  habitCompletionsTable,
  habitsTable,
  habitType,
  routinesTable,
  routineType,
  habitCompletionType,
  possibleModelType,
} from "./tables";

export const normalizeHabit = (habit: HabitRecord): Habit => ({
  ...habit,
  routineId: habit.routineId ?? null,
  targetTime: habit.targetTime ?? null,
});

export const habitById = selector({
  name: "habitById",
  args: { id: v.string() },
  handler: function* habitById({ id }) {
    const habit = yield* selectFrom(habitsTable, "byId")
      .where((query) => query.eq("id", id))
      .first();
    return habit ? normalizeHabit(habit) : undefined;
  },
});

export const routineById = selector({
  name: "routineById",
  args: { id: v.string() },
  handler: function* routineById({ id }) {
    return yield* selectFrom(routinesTable, "byId")
      .where((query) => query.eq("id", id))
      .first();
  },
});

export const habitCompletionById = selector({
  name: "habitCompletionById",
  args: { id: v.string() },
  handler: function* habitCompletionById({ id }) {
    return yield* selectFrom(habitCompletionsTable, "byId")
      .where((query) => query.eq("id", id))
      .first();
  },
});

export const allHabits = selector({
  name: "allHabits",
  args: {},
  handler: function* allHabits() {
    return (yield* selectFrom(habitsTable, "byOrder").order("asc")).map(
      normalizeHabit,
    );
  },
});

export const activeHabits = selector({
  name: "activeHabits",
  args: {},
  handler: function* activeHabits() {
    return (yield* allHabits({})).filter((habit) => habit.archivedAt === null);
  },
});

export const allRoutines = selector({
  name: "allRoutines",
  args: {},
  handler: function* allRoutines() {
    return yield* selectFrom(routinesTable, "byOrder").order("asc");
  },
});

export const activeRoutines = selector({
  name: "activeRoutines",
  args: {},
  handler: function* activeRoutines() {
    return (yield* allRoutines({})).filter(
      (routine) => routine.archivedAt === null,
    );
  },
});

export const allHabitCompletions = selector({
  name: "allHabitCompletions",
  args: {},
  handler: function* allHabitCompletions() {
    return yield* selectFrom(habitCompletionsTable, "byCompletedAt").order(
      "asc",
    );
  },
});

export const habitCompletionsByHabitId = selector({
  name: "habitCompletionsByHabitId",
  args: { habitId: v.string() },
  handler: function* habitCompletionsByHabitId({ habitId }) {
    return yield* selectFrom(habitCompletionsTable, "byHabitCompletedAt")
      .where((query) => query.eq("habitId", habitId))
      .order("asc");
  },
});

const nextHabitOrderToken = selector({
  name: "nextHabitOrderToken",
  args: {},
  handler: function* nextHabitOrderToken() {
    const habits = yield* allHabits({});
    const previousToken = habits[habits.length - 1]?.orderToken ?? null;
    // Production versions before fractional ordering used String(Date.now()).
    // Every numeric token sorts before a freshly generated fractional key, so
    // starting the fractional sequence preserves the existing order and avoids
    // rewriting synchronized legacy rows.
    if (previousToken !== null && /^\d+$/.test(previousToken)) {
      return generateJitteredKeyBetween(null, null);
    }
    return generateJitteredKeyBetween(
      previousToken,
      null,
    );
  },
});

const nextRoutineOrderToken = selector({
  name: "nextRoutineOrderToken",
  args: {},
  handler: function* nextRoutineOrderToken() {
    const routines = yield* allRoutines({});
    const previousToken = routines[routines.length - 1]?.orderToken ?? null;
    if (previousToken !== null && /^\d+$/.test(previousToken)) {
      return generateJitteredKeyBetween(null, null);
    }
    return generateJitteredKeyBetween(
      previousToken,
      null,
    );
  },
});

export const createHabit = action({
  name: "createHabit",
  args: {
    habit: v.object({
      id: v.optional(v.string()),
      title: v.string(),
      routineId: v.optional(v.union(v.string(), v.null())),
      orderToken: v.optional(v.string()),
      targetTime: v.optional(v.union(v.string(), v.null())),
    }),
    now: v.optional(v.number()),
  },
  handler: function* createHabit({ habit, now }) {
    const timestamp = now ?? Date.now();
    const newHabit: Habit = {
      type: habitType,
      id: habit.id ?? uuidv7(),
      title: habit.title.trim() || "New habit",
      routineId: habit.routineId ?? null,
      orderToken: habit.orderToken ?? (yield* nextHabitOrderToken({})),
      targetTime: habit.targetTime ?? null,
      createdAt: timestamp,
      archivedAt: null,
    };
    yield* insert(habitsTable, [newHabit]);
    return newHabit;
  },
});

export const createRoutine = action({
  name: "createRoutine",
  args: {
    routine: v.object({
      id: v.optional(v.string()),
      title: v.string(),
      orderToken: v.optional(v.string()),
    }),
    now: v.optional(v.number()),
  },
  handler: function* createRoutine({ routine, now }) {
    const timestamp = now ?? Date.now();
    const newRoutine: Routine = {
      type: routineType,
      id: routine.id ?? uuidv7(),
      title: routine.title.trim() || "New routine",
      orderToken: routine.orderToken ?? (yield* nextRoutineOrderToken({})),
      createdAt: timestamp,
      archivedAt: null,
    };
    yield* insert(routinesTable, [newRoutine]);
    return newRoutine;
  },
});

export const updateHabit = action({
  name: "updateHabit",
  args: {
    id: v.string(),
    habit: v.object({
      title: v.optional(v.string()),
      routineId: v.optional(v.union(v.string(), v.null())),
      orderToken: v.optional(v.string()),
      targetTime: v.optional(v.union(v.string(), v.null())),
      archivedAt: v.optional(v.union(v.number(), v.null())),
    }),
  },
  handler: function* updateHabit({ id, habit }) {
    const current = yield* habitById({ id });
    if (!current) throw new Error("Habit not found");
    const updated = {
      ...current,
      ...habit,
      ...(habit.title === undefined
        ? {}
        : { title: habit.title.trim() || "New habit" }),
    };
    yield* upsert(habitsTable, [updated]);
    return updated;
  },
});

export const updateRoutine = action({
  name: "updateRoutine",
  args: {
    id: v.string(),
    routine: v.object({
      title: v.optional(v.string()),
      orderToken: v.optional(v.string()),
      archivedAt: v.optional(v.union(v.number(), v.null())),
    }),
  },
  handler: function* updateRoutine({ id, routine }) {
    const current = yield* routineById({ id });
    if (!current) throw new Error("Routine not found");
    const updated = {
      ...current,
      ...routine,
      ...(routine.title === undefined
        ? {}
        : { title: routine.title.trim() || "New routine" }),
    };
    yield* upsert(routinesTable, [updated]);
    return updated;
  },
});

export const archiveHabit = action({
  name: "archiveHabit",
  args: { id: v.string(), now: v.optional(v.number()) },
  handler: function* archiveHabit({ id, now }) {
    return yield* updateHabit({
      id,
      habit: { archivedAt: now ?? Date.now() },
    });
  },
});

function* detachRoutineHabits(routineId: string) {
  const habits = yield* allHabits({});
  for (const habit of habits) {
    if (habit.routineId === routineId) {
      yield* updateHabit({ id: habit.id, habit: { routineId: null } });
    }
  }
}

export const archiveRoutine = action({
  name: "archiveRoutine",
  args: { id: v.string(), now: v.optional(v.number()) },
  handler: function* archiveRoutine({ id, now }) {
    yield* detachRoutineHabits(id);
    return yield* updateRoutine({
      id,
      routine: { archivedAt: now ?? Date.now() },
    });
  },
});

export const deleteHabits = action({
  name: "deleteHabits",
  args: { ids: v.array(v.string()) },
  handler: function* deleteHabits({ ids }) {
    for (const id of ids) {
      const completions = yield* habitCompletionsByHabitId({ habitId: id });
      yield* deleteRows(
        habitCompletionsTable,
        completions.map((completion) => completion.id),
      );
    }
    yield* deleteRows(habitsTable, ids);
  },
});

export const deleteRoutines = action({
  name: "deleteRoutines",
  args: { ids: v.array(v.string()) },
  handler: function* deleteRoutines({ ids }) {
    for (const id of ids) yield* detachRoutineHabits(id);
    yield* deleteRows(routinesTable, ids);
  },
});

export const deleteHabitCompletions = action({
  name: "deleteHabitCompletions",
  args: { ids: v.array(v.string()) },
  handler: function* deleteHabitCompletions({ ids }) {
    yield* deleteRows(habitCompletionsTable, ids);
  },
});

export const toggleHabitToday = action({
  name: "toggleHabitToday",
  args: {
    habitId: v.string(),
    completionId: v.optional(v.string()),
    now: v.optional(v.number()),
  },
  handler: function* toggleHabitToday({ habitId, completionId, now }) {
    if (!(yield* habitById({ id: habitId }))) throw new Error("Habit not found");
    const timestamp = now ?? Date.now();
    const start = new Date(timestamp);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const completions = yield* habitCompletionsByHabitId({ habitId });
    const today = completions.filter(
      (completion) =>
        completion.completedAt >= start.getTime() &&
        completion.completedAt < end.getTime(),
    );
    if (today.length > 0) {
      yield* deleteRows(
        habitCompletionsTable,
        today.map((completion) => completion.id),
      );
      return false;
    }
    yield* insert(habitCompletionsTable, [
      {
        type: habitCompletionType,
        id: completionId ?? uuidv7(),
        habitId,
        completedAt: timestamp,
      },
    ]);
    return true;
  },
});

const cannotDrop = selector({
  name: "habitCannotDrop",
  args: {
    id: v.string(),
    dropId: v.string(),
    dropModelType: possibleModelType,
  },
  handler: function* cannotDrop(_args) {
    return false;
  },
});

const noDrop = action({
  name: "habitNoDrop",
  args: {
    id: v.string(),
    dropId: v.string(),
    dropModelType: possibleModelType,
    edge: v.union(v.literal("top"), v.literal("bottom")),
  },
  handler: function* noDrop(_args) {},
});

registerModelSlice(
  {
    byId: habitById,
    delete: deleteHabits,
    canDrop: cannotDrop,
    handleDrop: noDrop,
  },
  habitsTable,
  habitType,
);
registerModelSlice(
  {
    byId: routineById,
    delete: deleteRoutines,
    canDrop: cannotDrop,
    handleDrop: noDrop,
  },
  routinesTable,
  routineType,
);
registerModelSlice(
  {
    byId: habitCompletionById,
    delete: deleteHabitCompletions,
    canDrop: cannotDrop,
    handleDrop: noDrop,
  },
  habitCompletionsTable,
  habitCompletionType,
);
