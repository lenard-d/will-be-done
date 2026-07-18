import { describe, expect, it } from "vitest";
import {
  DB,
  execSync,
  HybridDB,
  selectSync,
  syncDispatch,
} from "@will-be-done/hyperdb";
import { BptreeInmemDriver } from "@will-be-done/hyperdb/drivers/inmemory";
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
  toggleHabitToday,
  updateHabit,
} from "./habits";
import {
  habitCompletionsTable,
  habitsTable,
  isHabit,
  isHabitRecord,
  routinesTable,
} from "./tables";

function createDB() {
  const db = new DB(new BptreeInmemDriver());
  execSync(
    db.loadTables([habitsTable, routinesTable, habitCompletionsTable]),
  );
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
    const db = new HybridDB(
      primary,
      new DB(new BptreeInmemDriver()),
    );
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
});
