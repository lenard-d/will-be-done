import {
  insert,
  runSelectorAsync,
  selectFrom,
  syncDispatch,
  v,
  type ExtractIndexes,
  type HyperDB,
  type TableDefinition,
} from "@will-be-done/hyperdb";
import { action } from "./builders";

type TableIndexName<TTable extends TableDefinition> = Extract<
  keyof ExtractIndexes<TTable>,
  string | number
>;

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

const loadTablesFromDB = <TTable extends TableDefinition>(table: TTable) =>
  action({
    name: `loadTablesFromDB:${table.tableName}`,
    args: {},
    handler: function* loadRowsIntoSyncDb() {
      return yield* selectFrom(table, "byIds" as TableIndexName<TTable>);
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
    const res = await runSelectorAsync(persistentDB, () =>
      loadTablesFromDB(table)({}),
    );

    syncDispatch(syncDB, createLoadRowsIntoSyncDb(table)({ rows: res }));
  }
};
