import { BptreeInmemDriver } from "@will-be-done/hyperdb/drivers/inmemory";
import { DB, execAsync, HybridDB, SubscribableDB } from "@will-be-done/hyperdb";
import { dbIdTrait } from "@will-be-done/slices/traits";
import { getDevtoolsEnabled } from "@/lib/devtools";
import { openPersistentDriver } from "./persistentDriver";
import type { SyncConfig } from "./syncTypes";

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

  await execAsync(persistentDB.loadTables(syncConfig.persistDBTables));

  const cacheDB = new DB(new BptreeInmemDriver(), {
    traits: [dbIdTrait(syncConfig.dbType, syncConfig.dbId)],
    tracer,
    dbName: "hybrid-cache",
  });

  const hybridDB = new HybridDB(persistentDB, cacheDB);

  const syncSubDb = new SubscribableDB(hybridDB);
  await execAsync(syncSubDb.loadTables(syncConfig.persistDBTables));

  return { persistentDB, syncSubDb };
};
