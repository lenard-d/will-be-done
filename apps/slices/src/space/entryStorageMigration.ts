import {
  defineTable,
  deleteRows,
  insert,
  selectFrom,
  upsert,
  v,
} from "@will-be-done/hyperdb";
import { action, selector } from "../builders";
import { changesTable, type Change } from "../common/tables";
import {
  dailyEntriesTable,
  dailyEntryType,
  spaceMigrationsTable,
  stashEntriesTable,
  stashEntryType,
} from "./tables";

export const legacyDailyEntriesTableName = "task_projections";
export const dailyEntriesTableName = "daily_entries";
export const legacyStashEntriesTableName = "stash_projections";
export const stashEntriesTableName = "stash_entries";
export const entryStorageMigrationId = "entry-storage-v1";

export const legacyDailyEntriesMigrationTable = defineTable(
  legacyDailyEntriesTableName,
  {
    type: v.literal("projection"),
    id: v.string(),
    orderToken: v.string(),
    dailyListId: v.string(),
    createdAt: v.number(),
  },
).index("byIds", ["id"]);

export const legacyStashEntriesMigrationTable = defineTable(
  legacyStashEntriesTableName,
  {
    type: v.literal("stashProjection"),
    id: v.string(),
    orderToken: v.string(),
    createdAt: v.number(),
  },
).index("byIds", ["id"]);

export const entryStorageMigrationTables = [
  legacyDailyEntriesMigrationTable,
  dailyEntriesTable,
  legacyStashEntriesMigrationTable,
  stashEntriesTable,
  changesTable,
  spaceMigrationsTable,
];

export const isEntryStorageMigrationApplied = selector({
  name: "isEntryStorageMigrationApplied",
  args: {},
  handler: function* isEntryStorageMigrationApplied() {
    return Boolean(
      yield* selectFrom(spaceMigrationsTable, "byId")
        .where((q) => q.eq("id", entryStorageMigrationId))
        .firstOr(null),
    );
  },
});

export const migrateLegacyEntries = action({
  name: "migrateLegacyEntries",
  args: {},
  handler: function* migrateLegacyEntries() {
    const existingMigration = yield* selectFrom(spaceMigrationsTable, "byId")
      .where((q) => q.eq("id", entryStorageMigrationId))
      .firstOr(null);
    if (existingMigration) return;

    const currentDailyEntryIds = new Set(
      (yield* selectFrom(dailyEntriesTable, "byIds")).map((row) => row.id),
    );
    const dailyEntriesToInsert = (yield* selectFrom(
      legacyDailyEntriesMigrationTable,
      "byIds",
    ))
      .filter((row) => !currentDailyEntryIds.has(row.id))
      .map((row) => ({
        ...row,
        type: dailyEntryType as "dailyEntry",
      }));
    if (dailyEntriesToInsert.length > 0) {
      yield* insert(dailyEntriesTable, dailyEntriesToInsert);
    }

    const currentStashEntryIds = new Set(
      (yield* selectFrom(stashEntriesTable, "byIds")).map((row) => row.id),
    );
    const stashEntriesToInsert = (yield* selectFrom(
      legacyStashEntriesMigrationTable,
      "byIds",
    ))
      .filter((row) => !currentStashEntryIds.has(row.id))
      .map((row) => ({
        ...row,
        type: stashEntryType as "stashEntry",
      }));
    if (stashEntriesToInsert.length > 0) {
      yield* insert(stashEntriesTable, stashEntriesToInsert);
    }

    const changes = (yield* selectFrom(
      changesTable,
      "byUpdatedAt",
    )) as Change[];
    const changeIds = new Set(changes.map((change) => change.id));
    const changesToUpsert: Change[] = [];
    const changeIdsToDelete: string[] = [];

    for (const change of changes) {
      const nextTableName =
        change.tableName === legacyDailyEntriesTableName
          ? dailyEntriesTableName
          : change.tableName === legacyStashEntriesTableName
            ? stashEntriesTableName
            : null;
      if (!nextTableName) continue;

      const nextId = `${nextTableName}:${change.entityId}`;
      changeIdsToDelete.push(change.id);
      if (changeIds.has(nextId)) continue;

      changesToUpsert.push({
        ...change,
        id: nextId,
        tableName: nextTableName,
      });
    }

    if (changesToUpsert.length > 0) {
      yield* upsert(changesTable, changesToUpsert);
    }
    if (changeIdsToDelete.length > 0) {
      yield* deleteRows(changesTable, changeIdsToDelete);
    }

    yield* upsert(spaceMigrationsTable, [
      {
        id: entryStorageMigrationId,
        appliedAt: Date.now(),
      },
    ]);
  },
});
