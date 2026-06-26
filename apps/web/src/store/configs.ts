import { changesTable, syncStateTable } from "@will-be-done/slices/common";
import {
  allTasks,
  createInboxIfNotExists,
  generateTasksFromTemplates,
  loadSpaceBackup,
  registeredSpaceSyncableTableNameMap,
  registeredSpaceSyncableTables,
  type Task,
} from "@will-be-done/slices/space";
import {
  asyncDispatch,
  HyperDB,
  runSelectorAsync,
} from "@will-be-done/hyperdb";
import {
  registeredUserSyncableTableNameMap,
  registeredUserSyncableTables,
} from "@will-be-done/slices/user";
import type { SyncConfig } from "./syncTypes";
import { generateDemoBackup } from "@/lib/demoData";

const demoDbId = "e89b6c8f-1d6c-4bf4-9d27-478339773fc9";
export const spaceDbType = "space";

export const spaceDBConfig = (dbId: string) => {
  return {
    dbId,
    dbType: spaceDbType,
    persistDBTables: [
      ...registeredSpaceSyncableTables,
      changesTable,
      syncStateTable,
    ],
    inmemDBTables: [...registeredSpaceSyncableTables, changesTable],
    syncableDBTables: registeredSpaceSyncableTables,
    tableNameMap: registeredSpaceSyncableTableNameMap,
    afterInit: async (db: HyperDB) => {
      await asyncDispatch(db, createInboxIfNotExists({}));

      // To make load faster
      setTimeout(() => {
        void asyncDispatch(
          db,
          generateTasksFromTemplates({ toDate: Date.now() }),
        );
      }, 2000);
      setInterval(() => {
        void asyncDispatch(
          db,
          generateTasksFromTemplates({ toDate: Date.now() }),
        );
      }, 60 * 1000);
    },
  } satisfies SyncConfig;
};

export const demoSpaceDBConfig = () => {
  return {
    ...spaceDBConfig(demoDbId),
    disableSync: true,
    afterInit: async (db: HyperDB) => {
      await asyncDispatch(db, createInboxIfNotExists({}));
      const tasks = await runSelectorAsync<Task[]>(
        db,
        function* () {
          return yield* allTasks({});
        },
        [],
      );

      if (tasks.length === 0) {
        await asyncDispatch(
          db,
          loadSpaceBackup({ backup: generateDemoBackup() }),
        );
      }

      await asyncDispatch(
        db,
        generateTasksFromTemplates({ toDate: Date.now() }),
      );
      setInterval(() => {
        void asyncDispatch(
          db,
          generateTasksFromTemplates({ toDate: Date.now() }),
        );
      }, 60 * 1000);
    },
  } satisfies SyncConfig;
};

export const userDBConfig = (dbId: string) => {
  return {
    dbId,
    dbType: "user",
    persistDBTables: [
      ...registeredUserSyncableTables,
      changesTable,
      syncStateTable,
    ],
    inmemDBTables: [...registeredUserSyncableTables, changesTable],
    syncableDBTables: registeredUserSyncableTables,
    tableNameMap: registeredUserSyncableTableNameMap,
    afterInit: () => {},
  } satisfies SyncConfig;
};
