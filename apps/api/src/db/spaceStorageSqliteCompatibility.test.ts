import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import {
  DB,
  createAction,
  execSync,
  insert,
  selectSync,
  syncDispatch,
} from "@will-be-done/hyperdb";
import { SqlDriver } from "@will-be-done/hyperdb/drivers/sqlite";
import {
  allTasks,
  legacyProjectSectionsMigrationTable,
  migrateLegacySpaceStorage,
  registeredSpaceSyncableTables,
  spaceStorageMigrationTables,
  tasksMigrationTable,
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

const seedLegacyRows = createAction()({
  name: "seedLegacySpaceRowsForSqliteCompatibility",
  args: {},
  handler: function* seedLegacyRows() {
    yield* insert(legacyProjectSectionsMigrationTable, [
      {
        type: "projectCategory",
        id: "section-1",
        title: "Legacy section",
        projectId: "project-1",
        orderToken: "a",
        createdAt: 1,
      },
    ]);
    yield* insert(tasksMigrationTable, [
      {
        type: "task",
        id: "task-1",
        title: "Legacy task",
        state: "todo",
        projectCategoryId: "section-1",
        orderToken: "a",
        lastToggledAt: 1,
        createdAt: 1,
        templateId: null,
        templateDate: null,
      },
    ]);
  },
});

afterEach(() => {
  for (const sqlite of sqliteDatabases.splice(0)) sqlite.close();
});

describe("space storage SQLite compatibility", () => {
  test("migrates legacy rows before loading current indexed tables", () => {
    const sqlite = new Database(":memory:", { strict: true });
    sqliteDatabases.push(sqlite);

    const migrationDb = new DB(createDriver(sqlite));
    execSync(migrationDb.loadTables(spaceStorageMigrationTables));
    syncDispatch(migrationDb, seedLegacyRows({}));
    syncDispatch(migrationDb, migrateLegacySpaceStorage({}));

    const currentDb = new DB(createDriver(sqlite));
    execSync(currentDb.loadTables(registeredSpaceSyncableTables));

    expect(selectSync(currentDb, { selector: allTasks, args: {} })).toEqual([
      expect.objectContaining({
        id: "task-1",
        projectSectionId: "section-1",
      }),
    ]);
    const columns = sqlite
      .query("PRAGMA table_info(tasks)")
      .all()
      .map((row) => String((row as { name: string }).name));
    expect(columns).toContain("idx_byProjectSectionIdOrderStates_sort_key");
    expect(columns).not.toContain("idx_byCategoryIdOrderStates_sort_key");
  });
});
