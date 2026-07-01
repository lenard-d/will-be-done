import { asyncDispatch, DB, execAsync } from "@will-be-done/hyperdb";
import {
  insertChangeFromInsert,
  changesTable,
  syncStateTable,
  ChangesetArrayType,
} from "@will-be-done/slices/common";
import { dbIdTrait } from "@will-be-done/slices/traits";
import {
  createInboxIfNotExists,
  createProjectCategoryTask,
  firstProjectCategoryChild,
  registeredSpaceSyncableTables,
  tasksTable,
} from "@will-be-done/slices/space";
import { BroadcastChannel } from "broadcast-channel";
import { authUtils } from "@/lib/auth";
import { openPersistentDriver } from "./persistentDriver";
import { getClientId, initClock } from "./syncClock";

export async function initPopupStore(spaceId: string) {
  const dbName = "space-" + spaceId;
  const clientId = getClientId(dbName);
  const nextClock = initClock(clientId);

  const persistDBTables = [
    ...registeredSpaceSyncableTables,
    changesTable,
    syncStateTable,
  ];

  const persistentDriver = await openPersistentDriver(dbName);
  const asyncDB = new DB(persistentDriver, {
    traits: [dbIdTrait("space", spaceId)],
  });

  await execAsync(asyncDB.loadTables(persistDBTables));

  // Ensure inbox exists
  await asyncDispatch(asyncDB, createInboxIfNotExists({}));

  return {
    async createInboxTask(title: string) {
      const result = await asyncDispatch(
        asyncDB,
        (function* () {
          // Get inbox project
          const inbox = yield* createInboxIfNotExists({});

          // Get first category of inbox
          const inboxCategory = yield* firstProjectCategoryChild({
            projectId: inbox.id,
          });
          if (!inboxCategory) {
            throw new Error("Inbox category not found");
          }

          // Create task at the top (prepend)
          const task = yield* createProjectCategoryTask({
            categoryId: inboxCategory.id,
            position: "prepend",
            taskAttrs: { title },
          });

          // Create change record
          const change = yield* insertChangeFromInsert({
            tableDef: tasksTable,
            row: task,
            clientId: clientId,
            nextClock: nextClock(),
          });

          return { task, change };
        })(),
      );

      // Notify main window via BroadcastChannel
      const bc = new BroadcastChannel(`changes-${clientId}`);
      const changeset: ChangesetArrayType = [
        {
          tableName: tasksTable.tableName,
          data: [{ row: result.task, change: result.change }],
        },
      ];
      await bc.postMessage({ changeset });
      await bc.close();

      return result.task;
    },
  };
}

export function getPopupSpaceId(): string | null {
  return authUtils.getLastUsedSpaceId();
}
