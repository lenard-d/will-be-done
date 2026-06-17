import AwaitLock from "await-lock";
import { type SubscribableDB } from "@will-be-done/hyperdb-lib";
import { AutoBackuper } from "./autoBackup.ts";
import { createCrossTabChanges } from "./crossTabChanges";
import { createLocalPersistQueue } from "./localPersistQueue";
import { getClientId, getDbName, initClock } from "./syncClock";
import { registerSyncChangeHooks } from "./syncChangeHooks";
import { hydrateSyncDb } from "./syncHydration";
import { Syncer } from "./syncer";
import { createStoreDbs } from "./storeDbs";
import type { SyncConfig } from "./syncTypes";

export type { SyncConfig } from "./syncTypes";

const lock = new AwaitLock();
const initedDbs: Record<string, SubscribableDB> = {};

export const initDbStore = async (
  syncConfig: SyncConfig,
): Promise<SubscribableDB> => {
  const dbName = getDbName(syncConfig);

  await lock.acquireAsync();
  try {
    if (initedDbs[dbName]) {
      return initedDbs[dbName];
    }

    const clientId = getClientId(dbName);
    const nextClock = initClock(clientId);
    const { persistentDB, syncDB, syncSubDb } = await createStoreDbs(
      dbName,
      syncConfig,
    );

    registerSyncChangeHooks({
      syncSubDb,
      clientId,
      nextClock,
    });

    await hydrateSyncDb({
      persistentDB,
      syncDB,
      syncableDBTables: syncConfig.syncableDBTables,
    });

    const crossTabChanges = createCrossTabChanges({
      clientId,
      syncSubDb,
      syncConfig,
      nextClock,
    });

    const syncer = new Syncer(
      persistentDB,
      clientId,
      syncConfig,
      nextClock,
      crossTabChanges.applyChanges,
    );

    const localPersistQueue = createLocalPersistQueue({
      clientId,
      persistentDB,
      syncSubDb,
      nextClock,
      postChanges: crossTabChanges.postChanges,
      onPersisted: () => syncer.forceSync(),
    });
    localPersistQueue.start();

    if (!syncConfig.disableSync) {
      syncer.startLoop();

      const autoBackuper = new AutoBackuper(dbName, syncSubDb);
      autoBackuper.start();
    }

    await syncConfig.afterInit(syncSubDb);

    initedDbs[dbName] = syncSubDb;

    return syncSubDb;
  } finally {
    lock.release();
  }
};
