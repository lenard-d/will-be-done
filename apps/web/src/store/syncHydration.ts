import {
  insert,
  runSelectorAsync,
  selectFrom,
  syncDispatch,
  v,
  type HyperDB,
  type TableDefinition,
} from "@will-be-done/hyperdb-lib";
import { action } from "./builders";

const createLoadRowsIntoSyncDb = <TTable extends TableDefinition>(
  table: TTable,
) =>
  action({
    name: `loadRowsIntoSyncDb:${table.tableName}`,
    args: {
      rows: v.array(table.v()),
    },
    handler: function* loadRowsIntoSyncDb({ rows }) {
      yield* insert(table, rows);
    },
  });

type HydrateSyncDbArgs = {
  persistentDB: HyperDB;
  syncDB: HyperDB;
  syncableDBTables: TableDefinition[];
};

export const hydrateSyncDb = async ({
  persistentDB,
  syncDB,
  syncableDBTables,
}: HydrateSyncDbArgs) => {
  for (const table of syncableDBTables) {
    const res = await runSelectorAsync(persistentDB, function* () {
      return yield* selectFrom(table, "byIds");
    });

    syncDispatch(syncDB, createLoadRowsIntoSyncDb(table)({ rows: res }));
  }
};
