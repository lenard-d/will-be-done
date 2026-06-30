import { asyncDispatch, type SubscribableDB } from "@will-be-done/hyperdb";
import AwaitLock from "await-lock";
import { AutoBackuper } from "./autoBackup.ts";
import { createCrossTabChanges } from "./crossTabChanges";
import { createLocalPersistQueue } from "./localPersistQueue";
import { getClientId, getDbName, initClock } from "./syncClock";
import { registerSyncChangeHooks } from "./syncChangeHooks";
import { Syncer } from "./syncer";
import { getPersistentDriverKind } from "./persistentDriver";
import { resetEmptyPersistedSyncCursor } from "./syncActions";
import { createStoreDbs } from "./storeDbs";
import type { SyncConfig } from "./syncTypes";
import { spaceDbType } from "./configs.ts";

export type { SyncConfig } from "./syncTypes";

const lock = new AwaitLock();
const initedDbs: Record<string, SubscribableDB> = {};

export const getDBBySpaceId = (spaceId: string) => {
  const dbName = getDbName({ dbType: spaceDbType, dbId: spaceId });
  const cacheKey = `${dbName}:${getPersistentDriverKind(dbName)}`;

  const db = initedDbs[cacheKey];
  if (!db) {
    throw new Error("failed to find db for projectId: " + spaceId);
  }

  return db;
};

export const initDbStore = async (
  syncConfig: SyncConfig,
): Promise<SubscribableDB> => {
  const dbName = getDbName(syncConfig);
  const cacheKey = `${dbName}:${getPersistentDriverKind(dbName)}`;

  await lock.acquireAsync();
  try {
    if (initedDbs[cacheKey]) {
      return initedDbs[cacheKey];
    }

    const clientId = getClientId(dbName);
    const nextClock = initClock(clientId);
    const { persistentDB, syncSubDb } = await createStoreDbs(
      dbName,
      syncConfig,
    );
    await asyncDispatch(persistentDB, resetEmptyPersistedSyncCursor({}));

    registerSyncChangeHooks({
      syncSubDb,
      syncableDBTables: syncConfig.syncableDBTables,
      clientId,
      nextClock,
    });
    await syncConfig.beforeInit?.(syncSubDb);

    const crossTabChanges = createCrossTabChanges({
      clientId,
      syncSubDb,
      syncConfig,
      nextClock,
    });

    const syncer = new Syncer(syncSubDb, clientId, syncConfig, nextClock);

    const localPersistQueue = createLocalPersistQueue({
      syncSubDb,
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

    initedDbs[cacheKey] = syncSubDb;

    return syncSubDb;
  } finally {
    lock.release();
  }
};
