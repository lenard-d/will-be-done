import { action, selector } from "../builders";
import {
  entryStorageMigrationTables,
  isEntryStorageMigrationApplied,
  migrateLegacyEntries,
} from "./entryStorageMigration";
import {
  isTaskSectionStorageMigrationApplied,
  migrateLegacyTaskSections,
  taskSectionStorageMigrationTables,
} from "./taskSectionStorageMigration";

export const spaceStorageMigrationTables = [
  ...taskSectionStorageMigrationTables,
  ...entryStorageMigrationTables.filter(
    (entryTable) =>
      !taskSectionStorageMigrationTables.some(
        (taskSectionTable) =>
          taskSectionTable.tableName === entryTable.tableName,
      ),
  ),
];

export const areSpaceStorageMigrationsApplied = selector({
  name: "areSpaceStorageMigrationsApplied",
  args: {},
  handler: function* areSpaceStorageMigrationsApplied() {
    return (
      (yield* isTaskSectionStorageMigrationApplied({})) &&
      (yield* isEntryStorageMigrationApplied({}))
    );
  },
});

export const migrateLegacySpaceStorage = action({
  name: "migrateLegacySpaceStorage",
  args: {},
  handler: function* migrateLegacySpaceStorage() {
    yield* migrateLegacyTaskSections({});
    yield* migrateLegacyEntries({});
  },
});
