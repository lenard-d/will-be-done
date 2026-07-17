import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import {
  DB,
  createAction,
  defineTable,
  execSync,
  insert,
  selectSync,
  syncDispatch,
  v,
} from "@will-be-done/hyperdb";
import { SqlDriver } from "@will-be-done/hyperdb/drivers/sqlite";
import {
  allHabits,
  allRoutines,
  createHabit,
  createRoutine,
  registeredSpaceSyncableTables,
} from "@will-be-done/slices/space";

type SqlValue = number | string | Uint8Array | null;

const sqliteDatabases: Database[] = [];

function createDriver(sqlite: Database) {
  return new SqlDriver({
    exec(sql: string, params?: SqlValue[]): void {
      if (params) sqlite.run(sql, params);
      else sqlite.run(sql);
    },
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      return {
        values(params: SqlValue[]): SqlValue[][] {
          return statement.values(...params) as SqlValue[][];
        },
        finalize(): void {
          statement.finalize();
        },
      };
    },
  });
}

const legacyHabitsTable = defineTable("habits", {
  type: v.literal("habit"),
  id: v.string(),
  title: v.string(),
  routineId: v.union(v.string(), v.null()),
  orderToken: v.string(),
  targetTime: v.union(v.string(), v.null()),
  createdAt: v.number(),
  archivedAt: v.union(v.number(), v.null()),
})
  .index("byIds", ["id"])
  .index("byOrder", ["orderToken"])
  .index("byRoutineOrder", ["routineId", "orderToken"]);

const legacyRoutinesTable = defineTable("routines", {
  type: v.literal("routine"),
  id: v.string(),
  title: v.string(),
  orderToken: v.string(),
  createdAt: v.number(),
  archivedAt: v.union(v.number(), v.null()),
})
  .index("byIds", ["id"])
  .index("byOrder", ["orderToken"]);

const legacyAction = createAction({ validateArgs: false });
const seedLegacyRows = legacyAction({
  name: "seedLegacyHabitRows",
  args: {},
  handler: function* seedLegacyRows() {
    yield* insert(legacyRoutinesTable, [
      {
        type: "routine",
        id: "legacy-routine",
        title: "Established routine",
        orderToken: "1700000000000",
        createdAt: 10,
        archivedAt: null,
      },
    ]);
    yield* insert(legacyHabitsTable, [
      {
        type: "habit",
        id: "legacy-habit",
        title: "Established habit",
        routineId: "legacy-routine",
        orderToken: "1700000000000",
        targetTime: "07:30",
        createdAt: 20,
        archivedAt: null,
      },
    ]);
  },
});

afterEach(() => {
  for (const sqlite of sqliteDatabases.splice(0)) sqlite.close();
});

describe("habit SQLite compatibility", () => {
  test("loads current definitions over legacy rows and appends without data loss", () => {
    const sqlite = new Database(":memory:", { strict: true });
    sqliteDatabases.push(sqlite);
    const legacyDb = new DB(createDriver(sqlite));
    execSync(legacyDb.loadTables([legacyHabitsTable, legacyRoutinesTable]));
    syncDispatch(legacyDb, seedLegacyRows({}));

    const currentDb = new DB(createDriver(sqlite));
    execSync(currentDb.loadTables(registeredSpaceSyncableTables));
    syncDispatch(
      currentDb,
      createHabit({ habit: { id: "new-habit", title: "Appended habit" } }),
    );
    syncDispatch(
      currentDb,
      createRoutine({
        routine: { id: "new-routine", title: "Appended routine" },
      }),
    );

    const habits = selectSync(currentDb, { selector: allHabits, args: {} });
    const routines = selectSync(currentDb, {
      selector: allRoutines,
      args: {},
    });
    expect(habits.map((row) => row.id)).toEqual([
      "legacy-habit",
      "new-habit",
    ]);
    expect(routines.map((row) => row.id)).toEqual([
      "legacy-routine",
      "new-routine",
    ]);
    expect(habits[0]).toEqual({
      type: "habit",
      id: "legacy-habit",
      title: "Established habit",
      routineId: "legacy-routine",
      orderToken: "1700000000000",
      targetTime: "07:30",
      createdAt: 20,
      archivedAt: null,
    });
    expect(routines[0]).toEqual({
      type: "routine",
      id: "legacy-routine",
      title: "Established routine",
      orderToken: "1700000000000",
      createdAt: 10,
      archivedAt: null,
    });
  });
});
