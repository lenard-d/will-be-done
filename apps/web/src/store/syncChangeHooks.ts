import {
  noop,
  type SubscribableDB,
  syncDispatch,
} from "@will-be-done/hyperdb-lib";
import {
  changesTable,
  insertChangeFromDelete,
  insertChangeFromInsert,
  insertChangeFromUpdate,
  type PrimitiveRow,
} from "@will-be-done/slices/common";

type RegisterSyncChangeHooksArgs = {
  syncSubDb: SubscribableDB;
  clientId: string;
  nextClock: () => string;
};

export const registerSyncChangeHooks = ({
  syncSubDb,
  clientId,
  nextClock,
}: RegisterSyncChangeHooksArgs) => {
  syncSubDb.afterInsert(function* (db, table, traits, ops) {
    if (table === changesTable) return;
    if (traits.some((t) => t.type === "skip-sync")) {
      return;
    }

    for (const op of ops) {
      syncDispatch(
        db,
        insertChangeFromInsert({
          tableDef: op.table,
          row: op.newValue as PrimitiveRow,
          clientId,
          nextClock: nextClock(),
        }),
      );
    }

    yield* noop();
  });

  syncSubDb.afterUpsert(function* (db, table, traits, ops) {
    if (table === changesTable) return;
    if (traits.some((t) => t.type === "skip-sync")) {
      return;
    }

    for (const op of ops) {
      if (!op.oldValue) {
        syncDispatch(
          db,
          insertChangeFromInsert({
            tableDef: op.table,
            row: op.newValue as PrimitiveRow,
            clientId,
            nextClock: nextClock(),
          }),
        );
        continue;
      }

      syncDispatch(
        db,
        insertChangeFromUpdate({
          tableDef: op.table,
          oldRow: op.oldValue as PrimitiveRow,
          newRow: op.newValue as PrimitiveRow,
          clientId,
          nextClock: nextClock(),
        }),
      );
    }

    yield* noop();
  });

  syncSubDb.afterDelete(function* (db, table, traits, ops) {
    if (table === changesTable) return;
    if (traits.some((t) => t.type === "skip-sync")) {
      return;
    }

    for (const op of ops) {
      syncDispatch(
        db,
        insertChangeFromDelete({
          tableDef: op.table,
          row: op.oldValue as PrimitiveRow,
          clientId,
          nextClock: nextClock(),
        }),
      );
    }

    yield* noop();
  });
};
