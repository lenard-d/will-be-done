import {
  asyncDispatch,
  execAsync,
  type HyperDB,
  type Op,
  type Row,
  type SubscribableDB,
  type TableDefinition,
} from "@will-be-done/hyperdb";
import AwaitLock from "await-lock";
import {
  changesTable,
  insertChangeFromDelete,
  insertChangeFromInsert,
  insertChangeFromUpdate,
  type Change,
  type ChangesetArrayType,
  type PrimitiveRow,
} from "@will-be-done/slices/common";
import { State } from "@/utils/State.ts";
import { flushPendingDrafts } from "./pendingDraftFlushes.ts";
import type { ChangePersistedEvent } from "./syncTypes";

type RowType = Record<string, string | number | boolean | null> & {
  id: string;
};

type CreateLocalPersistQueueArgs = {
  clientId: string;
  persistentDB: HyperDB;
  syncSubDb: SubscribableDB;
  nextClock: () => string;
  postChanges: (event: ChangePersistedEvent) => void;
  onPersisted: () => void;
};

const describePersistOp = (op: Op) => ({
  type: op.type,
  tableName: op.table.tableName,
  oldId: "oldValue" in op ? op.oldValue?.id : undefined,
  newId: "newValue" in op ? op.newValue.id : undefined,
  oldValue: "oldValue" in op ? op.oldValue : undefined,
  newValue: "newValue" in op ? op.newValue : undefined,
});

export const createLocalPersistQueue = ({
  clientId,
  persistentDB,
  syncSubDb,
  nextClock,
  postChanges,
  onPersisted,
}: CreateLocalPersistQueueArgs) => {
  const pendingPersistBatches = new State<Op[][]>([]);
  const persistQueueLock = new AwaitLock();

  const createInsertChange = (table: TableDefinition, row: Row): Change => {
    const createdAt = nextClock();
    const changes: Record<string, string> = {};
    for (const col of Object.keys(row)) {
      changes[col] = createdAt;
    }

    return {
      id: `${table.tableName}:${row.id}`,
      entityId: row.id,
      tableName: table.tableName,
      deletedAt: null,
      clientId,
      changes,
      createdAt,
      updatedAt: createdAt,
    };
  };

  const persistBatch = async (ops: Op[]) => {
    const changesByTable = new Map<
      string,
      Array<{ row?: RowType; change: Change }>
    >();

    const appendPersistedChange = (
      tableName: string,
      row: RowType | undefined,
      change: Change,
    ) => {
      if (!changesByTable.has(tableName)) {
        changesByTable.set(tableName, []);
      }

      changesByTable.get(tableName)!.push({ row, change });
    };

    const persistInsertRun = async (
      tx: HyperDB,
      table: TableDefinition,
      rows: Row[],
    ) => {
      await execAsync(tx.insert(table, rows));
      const changes = rows.map((row) => createInsertChange(table, row));
      await execAsync(tx.upsert(changesTable, changes));

      for (let i = 0; i < rows.length; i++) {
        appendPersistedChange(table.tableName, rows[i] as RowType, changes[i]!);
      }
    };

    const tx = await execAsync(persistentDB.beginTx());
    let committed = false;
    try {
      try {
        for (let opIndex = 0; opIndex < ops.length; opIndex++) {
          const op = ops[opIndex]!;
          if (op.table == changesTable) continue;

          let change: Change | undefined;

          try {
            if (op.type === "insert") {
              const rows = [op.newValue as Row];
              while (
                opIndex + 1 < ops.length &&
                ops[opIndex + 1]!.type === "insert" &&
                ops[opIndex + 1]!.table === op.table
              ) {
                opIndex++;
                const nextOp = ops[opIndex]!;
                if (nextOp.type !== "insert") {
                  break;
                }
                rows.push(nextOp.newValue as Row);
              }

              await persistInsertRun(tx, op.table, rows);
              continue;
            } else if (op.type === "upsert") {
              await execAsync(tx.upsert(op.table, [op.newValue]));
              change = await asyncDispatch(
                tx,
                op.oldValue
                  ? insertChangeFromUpdate({
                      tableDef: op.table,
                      oldRow: op.oldValue as PrimitiveRow,
                      newRow: op.newValue as PrimitiveRow,
                      clientId,
                      nextClock: nextClock(),
                    })
                  : insertChangeFromInsert({
                      tableDef: op.table,
                      row: op.newValue as PrimitiveRow,
                      clientId,
                      nextClock: nextClock(),
                    }),
              );
            } else if (op.type === "delete") {
              await execAsync(tx.delete(op.table, [op.oldValue.id]));
              change = await asyncDispatch(
                tx,
                insertChangeFromDelete({
                  tableDef: op.table,
                  row: op.oldValue as PrimitiveRow,
                  clientId,
                  nextClock: nextClock(),
                }),
              );
            }
          } catch (error) {
            console.error("Failed while persisting local op", {
              op: describePersistOp(op),
              error,
            });
            throw error;
          }

          if (change) {
            const tableName = op.table.tableName;
            const row =
              op.type === "delete" ? undefined : (op.newValue as RowType);
            appendPersistedChange(tableName, row, change);
          }
        }
      } catch (error) {
        console.error("Failed to persist local batch", {
          opCount: ops.length,
          ops: ops.map(describePersistOp),
          error,
        });
        throw error;
      }

      try {
        await execAsync(tx.commit());
      } catch (error) {
        console.error("Failed to commit local persist transaction", {
          opCount: ops.length,
          ops: ops.map(describePersistOp),
          error,
        });
        throw error;
      }
      committed = true;
    } finally {
      if (!committed) {
        try {
          await execAsync(tx.rollback());
        } catch (rollbackError) {
          console.error("Failed to rollback local persist transaction", {
            rollbackError,
            ops: ops.map(describePersistOp),
          });
        }
      }
    }

    const changeset: ChangesetArrayType = [];
    for (const [tableName, data] of changesByTable) {
      changeset.push({ tableName, data });
    }

    if (changeset.length > 0) {
      postChanges({ changeset });
    }

    onPersisted();
  };

  const drainPendingPersistBatches = async () => {
    await persistQueueLock.acquireAsync();
    try {
      const queuedBatches = pendingPersistBatches.get();
      if (queuedBatches.length === 0) return;

      pendingPersistBatches.set([]);

      while (queuedBatches.length > 0) {
        for (const ops of queuedBatches) {
          try {
            await persistBatch(ops);
          } catch (error) {
            console.error("Failed to persist local changes", error);
          }
        }

        queuedBatches.splice(0, queuedBatches.length);
        queuedBatches.push(...pendingPersistBatches.get());
        pendingPersistBatches.set([]);
      }
    } finally {
      persistQueueLock.release();
    }
  };

  const flushDraftsAndPersist = async () => {
    flushPendingDrafts();
    await drainPendingPersistBatches();
  };

  const flushDraftsAndPersistBestEffort = () => {
    void flushDraftsAndPersist();
  };

  const flushDraftsAndPersistWhenHidden = () => {
    if (document.visibilityState === "hidden") {
      flushDraftsAndPersistBestEffort();
    }
  };

  return {
    start: () => {
      void (async () => {
        while (true) {
          await drainPendingPersistBatches();
          await pendingPersistBatches.when((queue) => queue.length > 0);
        }
      })();

      window.addEventListener("beforeunload", flushDraftsAndPersistBestEffort, {
        capture: true,
      });
      window.addEventListener("pagehide", flushDraftsAndPersistBestEffort, {
        capture: true,
      });
      document.addEventListener(
        "visibilitychange",
        flushDraftsAndPersistWhenHidden,
        { capture: true },
      );

      syncSubDb.subscribe((ops, traits) => {
        ops = ops.filter((op) => op.table !== changesTable);
        if (ops.length === 0) return;

        if (traits.some((t) => t.type === "skip-sync")) {
          return;
        }

        pendingPersistBatches.modify((queue) => {
          queue.push([...ops]);
          return queue;
        });
      });
    },
    drain: drainPendingPersistBatches,
    flushDraftsAndPersist,
  };
};
