import { describe, expect, it } from "vitest";
import {
  DB,
  execSync,
  HybridDB,
  selectSync,
  syncDispatch,
} from "@will-be-done/hyperdb";
import { BptreeInmemDriver } from "@will-be-done/hyperdb/drivers/inmemory";
import { appHandleDrop } from "./app";
import {
  activeHabits,
  allHabits,
  allRoutines,
  archiveHabit,
  createHabit,
  createRoutine,
  deleteHabits,
  habitById,
  habitCompletionsByHabitId,
  moveHabit,
  moveRoutine,
  toggleHabitToday,
  UNASSIGNED_ROUTINE_ID,
  updateHabit,
} from "./habits";
import {
  habitCompletionsTable,
  habitType,
  habitsTable,
  isHabit,
  isHabitRecord,
  routineType,
  routinesTable,
} from "./tables";

function createDB() {
  const db = new DB(new BptreeInmemDriver());
  execSync(db.loadTables([habitsTable, routinesTable, habitCompletionsTable]));
  return db;
}

const rawHabitBase = {
  type: "habit",
  title: "Legacy habit",
  createdAt: 1,
  archivedAt: null,
} as const;

function insertRawHabits(
  db: DB,
  habits: Array<{ id: string; orderToken: string; [key: string]: unknown }>,
) {
  execSync(db.driver.insert("habits", habits));
}

function readRawHabits(db: DB) {
  return execSync(
    db.driver.intervalScan("habits", "byOrder", [{}], { order: "asc" }),
  );
}

describe("persistent habit actions", () => {
  it("distinguishes legacy storage records from normalized habits", () => {
    const legacyRecord = {
      ...rawHabitBase,
      id: "legacy-habit-guard",
      orderToken: "1700000000000",
    };
    const normalizedHabit = {
      ...legacyRecord,
      routineId: null,
      targetTime: null,
    };

    expect(isHabitRecord(legacyRecord)).toBe(true);
    expect(isHabit(legacyRecord)).toBe(false);
    expect(isHabit(normalizedHabit)).toBe(true);
  });

  it("loads and normalizes every legacy nullable-field omission", () => {
    const primary = new DB(new BptreeInmemDriver(), {
      runtimeRowsValidation: true,
    });
    const db = new HybridDB(primary, new DB(new BptreeInmemDriver()));
    execSync(
      db.loadTables([habitsTable, routinesTable, habitCompletionsTable]),
    );
    insertRawHabits(primary, [
      {
        ...rawHabitBase,
        id: "legacy-habit-missing-routine-id",
        orderToken: "1700000000000",
        targetTime: "08:00",
      },
      {
        ...rawHabitBase,
        id: "legacy-habit-missing-target-time",
        orderToken: "1700000000001",
        routineId: "routine-1",
      },
      {
        ...rawHabitBase,
        id: "legacy-habit-missing-nullable-fields",
        orderToken: "1700000000002",
      },
    ]);
    execSync(db.preloadTables([{ table: habitsTable, scanIndex: "byIds" }]));

    const habits = selectSync(db, { selector: allHabits, args: {} });
    expect(habits).toEqual([
      {
        ...rawHabitBase,
        id: "legacy-habit-missing-routine-id",
        orderToken: "1700000000000",
        routineId: null,
        targetTime: "08:00",
      },
      {
        ...rawHabitBase,
        id: "legacy-habit-missing-target-time",
        orderToken: "1700000000001",
        routineId: "routine-1",
        targetTime: null,
      },
      {
        ...rawHabitBase,
        id: "legacy-habit-missing-nullable-fields",
        orderToken: "1700000000002",
        routineId: null,
        targetTime: null,
      },
    ]);
    for (const habit of habits) {
      expect(
        selectSync(db, {
          selector: habitById,
          args: { id: habit.id },
        }),
      ).toEqual(habit);
    }
  });

  it("upgrades a legacy habit to a complete row when updating it", () => {
    const db = createDB();
    insertRawHabits(db, [
      {
        ...rawHabitBase,
        id: "legacy-habit-to-update",
        orderToken: "1700000000000",
      },
    ]);

    const updated = syncDispatch(
      db,
      updateHabit({
        id: "legacy-habit-to-update",
        habit: { title: "Updated legacy habit" },
      }),
    );

    expect(updated).toMatchObject({
      id: "legacy-habit-to-update",
      title: "Updated legacy habit",
      routineId: null,
      targetTime: null,
    });
    expect(readRawHabits(db)).toEqual([
      {
        ...rawHabitBase,
        id: "legacy-habit-to-update",
        title: "Updated legacy habit",
        orderToken: "1700000000000",
        routineId: null,
        targetTime: null,
      },
    ]);
  });

  it("appends habits and routines after legacy numeric order tokens", () => {
    const db = createDB();
    syncDispatch(
      db,
      createHabit({
        habit: {
          id: "legacy-habit-1",
          title: "First",
          orderToken: "1700000000000",
        },
        now: 1,
      }),
    );
    syncDispatch(
      db,
      createHabit({
        habit: {
          id: "legacy-habit-2",
          title: "Second",
          orderToken: "1700000000001",
        },
        now: 2,
      }),
    );
    syncDispatch(
      db,
      createRoutine({
        routine: {
          id: "legacy-routine-1",
          title: "Morning",
          orderToken: "1700000000000",
        },
        now: 1,
      }),
    );

    const appendedHabit = syncDispatch(
      db,
      createHabit({ habit: { id: "new-habit", title: "Third" }, now: 3 }),
    );
    const appendedRoutine = syncDispatch(
      db,
      createRoutine({
        routine: { id: "new-routine", title: "Evening" },
        now: 3,
      }),
    );

    expect(appendedHabit.orderToken).not.toMatch(/^\d+$/);
    expect(appendedRoutine.orderToken).not.toMatch(/^\d+$/);
    expect(
      selectSync(db, { selector: allHabits, args: {} }).map((row) => row.id),
    ).toEqual(["legacy-habit-1", "legacy-habit-2", "new-habit"]);
    expect(
      selectSync(db, { selector: allRoutines, args: {} }).map((row) => row.id),
    ).toEqual(["legacy-routine-1", "new-routine"]);
  });

  it("creates and archives a habit", () => {
    const db = createDB();
    const habit = syncDispatch(
      db,
      createHabit({
        habit: { id: "habit-1", title: "  Drink water  " },
        now: 100,
      }),
    );

    expect(habit).toMatchObject({
      id: "habit-1",
      title: "Drink water",
      routineId: null,
      targetTime: null,
      archivedAt: null,
    });
    expect(readRawHabits(db)[0]).toMatchObject({
      id: "habit-1",
      routineId: null,
      targetTime: null,
    });
    expect(
      selectSync(db, { selector: activeHabits, args: {} }).map((row) => row.id),
    ).toEqual(["habit-1"]);

    syncDispatch(db, archiveHabit({ id: "habit-1", now: 200 }));

    expect(selectSync(db, { selector: activeHabits, args: {} })).toEqual([]);
    expect(
      selectSync(db, { selector: habitById, args: { id: "habit-1" } })
        ?.archivedAt,
    ).toBe(200);
  });

  it("toggles one explicit completion for the local calendar day", () => {
    const db = createDB();
    syncDispatch(
      db,
      createHabit({ habit: { id: "habit-1", title: "Walk" }, now: 100 }),
    );
    const morning = new Date(2027, 2, 5, 8).getTime();
    const evening = new Date(2027, 2, 5, 20).getTime();

    expect(
      syncDispatch(
        db,
        toggleHabitToday({
          habitId: "habit-1",
          completionId: "completion-1",
          now: morning,
        }),
      ),
    ).toBe(true);
    expect(
      selectSync(db, {
        selector: habitCompletionsByHabitId,
        args: { habitId: "habit-1" },
      }),
    ).toHaveLength(1);

    expect(
      syncDispatch(
        db,
        toggleHabitToday({
          habitId: "habit-1",
          completionId: "unused",
          now: evening,
        }),
      ),
    ).toBe(false);
    expect(
      selectSync(db, {
        selector: habitCompletionsByHabitId,
        args: { habitId: "habit-1" },
      }),
    ).toEqual([]);
  });

  it("deletes a habit and its completion records", () => {
    const db = createDB();
    syncDispatch(
      db,
      createRoutine({ routine: { id: "routine-1", title: "Morning" }, now: 1 }),
    );
    syncDispatch(
      db,
      createHabit({
        habit: { id: "habit-1", title: "Walk", routineId: "routine-1" },
        now: 2,
      }),
    );
    syncDispatch(
      db,
      toggleHabitToday({
        habitId: "habit-1",
        completionId: "completion-1",
        now: new Date(2027, 2, 5, 8).getTime(),
      }),
    );

    syncDispatch(db, deleteHabits({ ids: ["habit-1"] }));

    expect(
      selectSync(db, { selector: habitById, args: { id: "habit-1" } }),
    ).toBeUndefined();
    expect(
      selectSync(db, {
        selector: habitCompletionsByHabitId,
        args: { habitId: "habit-1" },
      }),
    ).toEqual([]);
  });

  it("moves habits within and between routines with persistent ordering", () => {
    const db = createDB();
    for (const [id, title] of [
      ["morning", "Morning"],
      ["evening", "Evening"],
    ] as const) {
      syncDispatch(db, createRoutine({ routine: { id, title }, now: 1 }));
    }
    for (const [id, title, routineId] of [
      ["water", "Water", "morning"],
      ["walk", "Walk", "morning"],
      ["journal", "Journal", "evening"],
    ] as const) {
      syncDispatch(
        db,
        createHabit({ habit: { id, title, routineId }, now: 2 }),
      );
    }

    syncDispatch(
      db,
      moveHabit({
        id: "walk",
        routineId: "morning",
        position: { targetId: "water", edge: "top" },
      }),
    );
    syncDispatch(
      db,
      moveHabit({ id: "water", routineId: "evening", position: "prepend" }),
    );

    const habits = selectSync(db, { selector: allHabits, args: {} });
    const titlesIn = (routineId: string) =>
      habits
        .filter((habit) => habit.routineId === routineId)
        .sort((left, right) => left.orderToken.localeCompare(right.orderToken))
        .map((habit) => habit.title);
    expect(titlesIn("morning")).toEqual(["Walk"]);
    expect(titlesIn("evening")).toEqual(["Water", "Journal"]);
  });

  it("reorders routines around a target", () => {
    const db = createDB();
    for (const [id, title] of [
      ["morning", "Morning"],
      ["afternoon", "Afternoon"],
      ["evening", "Evening"],
    ] as const) {
      syncDispatch(db, createRoutine({ routine: { id, title }, now: 1 }));
    }

    syncDispatch(
      db,
      moveRoutine({ id: "evening", targetId: "morning", edge: "top" }),
    );

    expect(
      selectSync(db, { selector: allRoutines, args: {} }).map(
        (routine) => routine.id,
      ),
    ).toEqual(["evening", "morning", "afternoon"]);
  });

  it("persists card and column drops through the generic DnD actions", () => {
    const db = createDB();
    for (const id of ["morning", "evening"] as const) {
      syncDispatch(db, createRoutine({ routine: { id, title: id }, now: 1 }));
    }
    syncDispatch(
      db,
      createHabit({
        habit: { id: "water", title: "Water", routineId: "morning" },
        now: 2,
      }),
    );
    syncDispatch(
      db,
      createHabit({
        habit: { id: "journal", title: "Journal", routineId: "evening" },
        now: 2,
      }),
    );

    syncDispatch(
      db,
      appHandleDrop({
        id: "journal",
        modelType: habitType,
        dropId: "water",
        dropModelType: habitType,
        edge: "top",
      }),
    );
    expect(
      selectSync(db, { selector: habitById, args: { id: "water" } })?.routineId,
    ).toBe("evening");

    syncDispatch(
      db,
      appHandleDrop({
        id: UNASSIGNED_ROUTINE_ID,
        modelType: routineType,
        dropId: "water",
        dropModelType: habitType,
        edge: "top",
      }),
    );
    expect(
      selectSync(db, { selector: habitById, args: { id: "water" } })?.routineId,
    ).toBeNull();
  });

  it("keeps dangling-reference habits in the unassigned order when dropping", () => {
    const db = createDB();
    syncDispatch(
      db,
      createHabit({
        habit: {
          id: "dangling",
          title: "Dangling",
          routineId: "missing-routine",
        },
        now: 1,
      }),
    );
    syncDispatch(
      db,
      createHabit({
        habit: { id: "unassigned", title: "Unassigned", routineId: null },
        now: 2,
      }),
    );

    syncDispatch(
      db,
      appHandleDrop({
        id: "dangling",
        modelType: habitType,
        dropId: "unassigned",
        dropModelType: habitType,
        edge: "top",
      }),
    );

    const habits = selectSync(db, { selector: allHabits, args: {} });
    expect(habits.map((habit) => habit.id)).toEqual(["unassigned", "dangling"]);
    expect(habits.find((habit) => habit.id === "unassigned")?.routineId).toBeNull();
    expect(habits.find((habit) => habit.id === "dangling")?.routineId).toBe(
      "missing-routine",
    );
  });

  it("normalizes legacy numeric tokens when a habit is reordered", () => {
    const db = createDB();
    for (const [id, orderToken] of [
      ["first", "1700000000000"],
      ["second", "1700000000001"],
    ] as const) {
      syncDispatch(
        db,
        createHabit({
          habit: { id, title: id, orderToken, routineId: null },
          now: 1,
        }),
      );
    }

    syncDispatch(
      db,
      moveHabit({
        id: "second",
        routineId: null,
        position: { targetId: "first", edge: "top" },
      }),
    );

    const habits = selectSync(db, { selector: allHabits, args: {} });
    expect(habits.map((habit) => habit.id)).toEqual(["second", "first"]);
    expect(habits.every((habit) => !/^\d+$/.test(habit.orderToken))).toBe(true);
  });
});
