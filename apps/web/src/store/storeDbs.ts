import {
  BptreeInmemDriver,
  DB,
  execAsync,
  execSync,
  SubscribableDB,
} from "@will-be-done/hyperdb-lib";
import { dbIdTrait } from "@will-be-done/slices/traits";
import { openPersistentDriver } from "./persistentDriver";
import type { SyncConfig } from "./syncTypes";

export const createStoreDbs = async (
  dbName: string,
  syncConfig: SyncConfig,
) => {
  const persistentDriver = await openPersistentDriver(dbName);
  const persistentDB = new DB(persistentDriver, {
    traits: [dbIdTrait(syncConfig.dbType, syncConfig.dbId)],
    tracer: process.env.NODE_ENV === "development" ? undefined : null,
    runtimeValidation: process.env.NODE_ENV === "development",
    freezeArgs: process.env.NODE_ENV === "development",
    freezeRows: process.env.NODE_ENV === "development",
    dbName: "persistent",
  });

  await execAsync(persistentDB.loadTables(syncConfig.persistDBTables));

  const syncDB = new DB(new BptreeInmemDriver(), {
    traits: [dbIdTrait(syncConfig.dbType, syncConfig.dbId)],
    tracer: process.env.NODE_ENV === "development" ? undefined : null,
    dbName: "in-mem",
  });

  execSync(syncDB.loadTables(syncConfig.inmemDBTables));

  const syncSubDb = new SubscribableDB(syncDB);

  return { persistentDB, syncDB, syncSubDb };
};
