import { describe, expect, it } from "vitest";
import {
  createAction,
  createSelector,
  DB,
  execSync,
  insert,
  selectFrom,
  selectSync,
  syncDispatch,
} from "@will-be-done/hyperdb";
import { BptreeInmemDriver } from "@will-be-done/hyperdb/drivers/inmemory";
import { changesTable } from "../common";
import {
  entryStorageMigrationTables,
  legacyDailyEntriesMigrationTable,
  legacyStashEntriesMigrationTable,
  migrateLegacyEntries,
} from "./entryStorageMigration";
import {
  dailyEntriesTable,
  spaceMigrationsTable,
  stashEntriesTable,
} from "./tables";

const action = createAction();
const selector = createSelector();

const seedLegacyEntries = action({
  name: "seedLegacyEntries",
  args: {},
  handler: function* seedLegacyEntries() {
    yield* insert(legacyDailyEntriesMigrationTable, [
      {
        type: "projection",
        id: "daily-1",
        orderToken: "legacy-a",
        dailyListId: "list-1",
        createdAt: 1,
      },
      {
        type: "projection",
        id: "daily-collision",
        orderToken: "legacy-collision",
        dailyListId: "list-1",
        createdAt: 1,
      },
    ]);
    yield* insert(legacyStashEntriesMigrationTable, [
      {
        type: "stashProjection",
        id: "stash-1",
        orderToken: "legacy-b",
        createdAt: 2,
      },
    ]);
    yield* insert(dailyEntriesTable, [
      {
        type: "daily_entry",
        id: "daily-collision",
        orderToken: "canonical-collision",
        dailyListId: "list-2",
        createdAt: 3,
      },
    ]);
    yield* insert(changesTable, [
      {
        id: "task_projections:daily-1",
        entityId: "daily-1",
        tableName: "task_projections",
        createdAt: "1-client",
        updatedAt: "2-client",
        deletedAt: null,
        clientId: "client",
        changes: { orderToken: "2-client" },
      },
      {
        id: "stash_projections:stash-1",
        entityId: "stash-1",
        tableName: "stash_projections",
        createdAt: "1-client",
        updatedAt: "4-client",
        deletedAt: "4-client",
        clientId: "client",
        changes: { orderToken: "3-client" },
      },
      {
        id: "task_projections:daily-collision",
        entityId: "daily-collision",
        tableName: "task_projections",
        createdAt: "1-legacy",
        updatedAt: "3-legacy",
        deletedAt: null,
        clientId: "legacy",
        changes: { orderToken: "3-legacy" },
      },
      {
        id: "daily_entries:daily-collision",
        entityId: "daily-collision",
        tableName: "daily_entries",
        createdAt: "1-canonical",
        updatedAt: "5-canonical",
        deletedAt: null,
        clientId: "canonical",
        changes: { orderToken: "5-canonical" },
      },
    ]);
  },
});

const entryRows = selector({
  name: "entryRows",
  args: {},
  handler: function* entryRows() {
    return {
      legacyDailyEntries: yield* selectFrom(
        legacyDailyEntriesMigrationTable,
        "byIds",
      ),
      dailyEntries: yield* selectFrom(dailyEntriesTable, "byIds"),
      legacyStashEntries: yield* selectFrom(
        legacyStashEntriesMigrationTable,
        "byIds",
      ),
      stashEntries: yield* selectFrom(stashEntriesTable, "byIds"),
      changes: yield* selectFrom(changesTable, "byUpdatedAt"),
      migrations: yield* selectFrom(spaceMigrationsTable, "byIds"),
    };
  },
});

describe("entry storage migration", () => {
  it("copies legacy rows and rewrites sync metadata without deleting legacy rows", () => {
    const db = new DB(new BptreeInmemDriver());
    execSync(db.loadTables(entryStorageMigrationTables));
    syncDispatch(db, seedLegacyEntries({}));

    syncDispatch(db, migrateLegacyEntries({}));
    const firstResult = selectSync(db, { selector: entryRows, args: {} });

    expect(firstResult.dailyEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "daily-1",
          type: "daily_entry",
          orderToken: "legacy-a",
        }),
        expect.objectContaining({
          id: "daily-collision",
          type: "daily_entry",
          orderToken: "canonical-collision",
        }),
      ]),
    );
    expect(firstResult.stashEntries).toEqual([
      expect.objectContaining({
        id: "stash-1",
        type: "stash_entry",
        orderToken: "legacy-b",
      }),
    ]);
    expect(firstResult.legacyDailyEntries).toHaveLength(2);
    expect(firstResult.legacyStashEntries).toHaveLength(1);

    expect(firstResult.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "daily_entries:daily-1",
          tableName: "daily_entries",
          deletedAt: null,
        }),
        expect.objectContaining({
          id: "stash_entries:stash-1",
          tableName: "stash_entries",
          deletedAt: "4-client",
        }),
        expect.objectContaining({
          id: "daily_entries:daily-collision",
          clientId: "canonical",
          updatedAt: "5-canonical",
        }),
      ]),
    );
    expect(
      firstResult.changes.some(
        (change) =>
          change.tableName === "task_projections" ||
          change.tableName === "stash_projections",
      ),
    ).toBe(false);
    expect(firstResult.migrations).toEqual([
      expect.objectContaining({ id: "entry-storage-v1" }),
    ]);

    syncDispatch(db, migrateLegacyEntries({}));
    const secondResult = selectSync(db, { selector: entryRows, args: {} });
    expect(secondResult).toEqual(firstResult);
  });

  it("migrates a large entry store in one guarded startup pass", () => {
    const db = new DB(new BptreeInmemDriver());
    execSync(db.loadTables(entryStorageMigrationTables));
    syncDispatch(
      db,
      action({
        name: "seedLargeLegacyEntryStore",
        args: {},
        handler: function* seedLargeLegacyEntryStore() {
          yield* insert(
            legacyDailyEntriesMigrationTable,
            Array.from({ length: 1_500 }, (_, index) => ({
              type: "projection" as const,
              id: `daily-${index}`,
              orderToken: String(index).padStart(4, "0"),
              dailyListId: "list-1",
              createdAt: 1,
            })),
          );
        },
      })({}),
    );

    syncDispatch(db, migrateLegacyEntries({}));
    const result = selectSync(db, { selector: entryRows, args: {} });

    expect(result.dailyEntries).toHaveLength(1_500);
    expect(
      result.dailyEntries.find((entry) => entry.id === "daily-1499"),
    ).toEqual(
      expect.objectContaining({
        id: "daily-1499",
        type: "daily_entry",
      }),
    );
    expect(result.legacyDailyEntries).toHaveLength(1_500);
    expect(result.migrations).toHaveLength(1);
  });
});
