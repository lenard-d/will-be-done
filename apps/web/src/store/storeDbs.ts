import { BptreeInmemDriver } from "@will-be-done/hyperdb/drivers/inmemory";
import { DB, execAsync, HybridDB, SubscribableDB } from "@will-be-done/hyperdb";
import { dbIdTrait } from "@will-be-done/slices/traits";
import { getDevtoolsEnabled } from "@/lib/devtools";
import { openPersistentDriver } from "./persistentDriver";
import type { SyncConfig } from "./syncTypes";
import {
  migrateLegacyTaskSections,
  taskSectionStorageMigrationTables,
} from "@will-be-done/slices/space";
import { asyncDispatch } from "@will-be-done/hyperdb";

export const createStoreDbs = async (
  dbName: string,
  syncConfig: SyncConfig,
) => {
  const persistentDriver = await openPersistentDriver(dbName);
  const tracer =
    process.env.NODE_ENV === "development" || getDevtoolsEnabled()
      ? "default"
      : "disabled";
  const persistentDB = new DB(persistentDriver, {
    traits: [dbIdTrait(syncConfig.dbType, syncConfig.dbId)],
    tracer,
    runtimeRowsValidation: process.env.NODE_ENV === "development",
    freezeArgs: process.env.NODE_ENV === "development",
    freezeRows: process.env.NODE_ENV === "development",
    dbName: "persistent",
  });

  if (syncConfig.dbType === "space") {
    await execAsync(persistentDB.loadTables(taskSectionStorageMigrationTables));
    await asyncDispatch(persistentDB, migrateLegacyTaskSections({}));
  }

  await execAsync(persistentDB.loadTables(syncConfig.persistDBTables));

  const cacheDB = new DB(new BptreeInmemDriver(), {
    traits: [dbIdTrait(syncConfig.dbType, syncConfig.dbId)],
    tracer,
    dbName: "hybrid-cache",
  });

  const hybridDB = new HybridDB(persistentDB, cacheDB);

  const syncSubDb = new SubscribableDB(hybridDB);
  await execAsync(syncSubDb.loadTables(syncConfig.persistDBTables));

  // const canPreloadChanges = syncConfig.persistDBTables.includes(changesTable);
  // const canPreloadTaskProjections =
  //   syncConfig.persistDBTables.includes(taskProjectionsTable);

  // syncSubDb.afterScan(
  //   function* (_db, table, _indexName, _clauses, _selectOptions, results) {
  //     if (
  //       !canPreloadChanges ||
  //       table === changesTable ||
  //       results.length === 0
  //     ) {
  //       return;
  //     }
  //
  //     yield* preloadEntities({
  //       ids: results.map((row) => row.id),
  //       tableName: table.tableName,
  //       preloadTaskProjections:
  //         table === tasksTable && canPreloadTaskProjections,
  //     });
  //   },
  // );

  return { persistentDB, syncSubDb };
};
