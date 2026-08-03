import {
  deleteRows,
  insert,
  selectFrom,
  upsert,
  v,
} from "@will-be-done/hyperdb";
import {
  generateJitteredKeyBetween,
  generateNJitteredKeysBetween,
} from "fractional-indexing-jittered";
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

export const UNASSIGNED_ROUTINE_ID = "virtual:habit-routine:unassigned";

const movePosition = v.union(
  v.literal("prepend"),
  v.literal("append"),
  v.object({
    targetId: v.string(),
    edge: v.union(v.literal("top"), v.literal("bottom")),
  }),
);

type MovePosition =
  | "prepend"
  | "append"
  | { targetId: string; edge: "top" | "bottom" };

const insertAtPosition = <T extends { id: string }>(
  items: T[],
  item: T,
  position: MovePosition,
) => {
  const withoutItem = items.filter((candidate) => candidate.id !== item.id);
  if (position === "prepend") return [item, ...withoutItem];
  if (position === "append") return [...withoutItem, item];

  const targetIndex = withoutItem.findIndex(
    (candidate) => candidate.id === position.targetId,
  );
  if (targetIndex === -1) throw new Error("Move target not found");
  const insertIndex = targetIndex + (position.edge === "bottom" ? 1 : 0);
  return [
    ...withoutItem.slice(0, insertIndex),
    item,
    ...withoutItem.slice(insertIndex),
  ];
};

const tokenAt = <T extends { orderToken: string }>(
  items: T[],
  index: number,
) => {
  try {
    return generateJitteredKeyBetween(
      items[index - 1]?.orderToken ?? null,
      items[index + 1]?.orderToken ?? null,
    );
  } catch {
    // Legacy releases used timestamp strings, which are not valid fractional
    // keys. Callers re-key the affected ordered list in this case.
    return null;
  }
};

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
    return generateJitteredKeyBetween(previousToken, null);
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
    return generateJitteredKeyBetween(previousToken, null);
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

export const moveHabit = action({
  name: "moveHabit",
  args: {
    id: v.string(),
    routineId: v.union(v.string(), v.null()),
    position: movePosition,
  },
  handler: function* moveHabit({ id, routineId, position }) {
    const current = yield* habitById({ id });
    if (!current) throw new Error("Habit not found");

    const activeRoutineIds = new Set(
      (yield* activeRoutines({})).map((routine) => routine.id),
    );
    const normalizedRoutineId =
      routineId !== null && activeRoutineIds.has(routineId) ? routineId : null;
    const targetHabits = (yield* allHabits({}))
      .filter(
        (habit) =>
          habit.archivedAt === null &&
          (normalizedRoutineId === null
            ? habit.routineId === null || !activeRoutineIds.has(habit.routineId)
            : habit.routineId === normalizedRoutineId),
      )
      .sort((left, right) => left.orderToken.localeCompare(right.orderToken));
    const moved = { ...current, routineId: normalizedRoutineId };
    const ordered = insertAtPosition(targetHabits, moved, position);
    const movedIndex = ordered.findIndex((habit) => habit.id === id);
    const orderToken = tokenAt(ordered, movedIndex);

    if (orderToken !== null) {
      const updated = { ...moved, orderToken };
      yield* upsert(habitsTable, [updated]);
      return updated;
    }

    const tokens = generateNJitteredKeysBetween(null, null, ordered.length);
    const rekeyed = ordered.map((habit, index) => ({
      ...habit,
      orderToken: tokens[index]!,
    }));
    yield* upsert(habitsTable, rekeyed);
    return rekeyed[movedIndex]!;
  },
});

export const moveRoutine = action({
  name: "moveRoutine",
  args: {
    id: v.string(),
    targetId: v.string(),
    edge: v.union(v.literal("top"), v.literal("bottom")),
  },
  handler: function* moveRoutine({ id, targetId, edge }) {
    const current = yield* routineById({ id });
    if (!current) throw new Error("Routine not found");
    if (id === targetId) return current;

    const routines = (yield* activeRoutines({})).sort((left, right) =>
      left.orderToken.localeCompare(right.orderToken),
    );
    const ordered = insertAtPosition(routines, current, { targetId, edge });
    const movedIndex = ordered.findIndex((routine) => routine.id === id);
    const orderToken = tokenAt(ordered, movedIndex);

    if (orderToken !== null) {
      const updated = { ...current, orderToken };
      yield* upsert(routinesTable, [updated]);
      return updated;
    }

    const tokens = generateNJitteredKeysBetween(null, null, ordered.length);
    const rekeyed = ordered.map((routine, index) => ({
      ...routine,
      orderToken: tokens[index]!,
    }));
    yield* upsert(routinesTable, rekeyed);
    return rekeyed[movedIndex]!;
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

export const toggleHabitCompletionAt = action({
  name: "toggleHabitCompletionAt",
  args: {
    habitId: v.string(),
    completedAt: v.number(),
    completionId: v.optional(v.string()),
  },
  handler: function* toggleHabitCompletionAt({
    habitId,
    completedAt,
    completionId,
  }) {
    if (!(yield* habitById({ id: habitId }))) {
      throw new Error("Habit not found");
    }

    const start = new Date(completedAt);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const completions = yield* habitCompletionsByHabitId({ habitId });
    const matchingDay = completions.filter(
      (completion) =>
        completion.completedAt >= start.getTime() &&
        completion.completedAt < end.getTime(),
    );

    if (matchingDay.length > 0) {
      yield* deleteRows(
        habitCompletionsTable,
        matchingDay.map((completion) => completion.id),
      );
      return false;
    }

    yield* insert(habitCompletionsTable, [
      {
        type: habitCompletionType,
        id: completionId ?? uuidv7(),
        habitId,
        completedAt,
      },
    ]);
    return true;
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
    const timestamp = now ?? Date.now();
    return yield* toggleHabitCompletionAt({
      habitId,
      completedAt: timestamp,
      completionId,
    });
  },
});

const habitCanDrop = selector({
  name: "habitCanDrop",
  args: {
    id: v.string(),
    dropId: v.string(),
    dropModelType: possibleModelType,
  },
  handler: function* habitCanDrop({ id, dropId, dropModelType }) {
    return dropModelType === habitType && id !== dropId;
  },
});

const habitHandleDrop = action({
  name: "habitHandleDrop",
  args: {
    id: v.string(),
    dropId: v.string(),
    dropModelType: possibleModelType,
    edge: v.union(v.literal("top"), v.literal("bottom")),
  },
  handler: function* habitHandleDrop({ id, dropId, dropModelType, edge }) {
    if (dropModelType !== habitType || id === dropId) return;
    const target = yield* habitById({ id });
    if (!target) return;
    const targetRoutine = target.routineId
      ? yield* routineById({ id: target.routineId })
      : undefined;
    yield* moveHabit({
      id: dropId,
      routineId: targetRoutine?.archivedAt === null ? targetRoutine.id : null,
      position: { targetId: target.id, edge },
    });
  },
});

const routineCanDrop = selector({
  name: "routineCanDrop",
  args: {
    id: v.string(),
    dropId: v.string(),
    dropModelType: possibleModelType,
  },
  handler: function* routineCanDrop({ dropModelType }) {
    return dropModelType === habitType;
  },
});

const routineHandleDrop = action({
  name: "routineHandleDrop",
  args: {
    id: v.string(),
    dropId: v.string(),
    dropModelType: possibleModelType,
    edge: v.union(v.literal("top"), v.literal("bottom")),
  },
  handler: function* routineHandleDrop({ id, dropId, dropModelType }) {
    if (dropModelType !== habitType) return;
    yield* moveHabit({
      id: dropId,
      routineId: id === UNASSIGNED_ROUTINE_ID ? null : id,
      position: "append",
    });
  },
});

const cannotDrop = selector({
  name: "habitCompletionCannotDrop",
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
  name: "habitCompletionNoDrop",
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
    canDrop: habitCanDrop,
    handleDrop: habitHandleDrop,
  },
  habitsTable,
  habitType,
);
registerModelSlice(
  {
    byId: routineById,
    delete: deleteRoutines,
    canDrop: routineCanDrop,
    handleDrop: routineHandleDrop,
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
