import SQLiteAsyncESMFactory from "wa-sqlite/dist/wa-sqlite-async.mjs";
import {
  AsyncSqlDriver,
  type AsyncSQLiteDB,
  type SqlValue,
  logAsyncSqlDriverDebugEvent,
} from "@will-be-done/hyperdb/drivers/sqlite";
import asyncSqlWasmUrl from "wa-sqlite/dist/wa-sqlite-async.wasm?url";
//@ts-expect-error no declarations
import { IDBBatchAtomicVFS } from "wa-sqlite/src/examples/IDBBatchAtomicVFS.js";
import * as SQLite from "wa-sqlite";
import { getDevtoolsEnabled } from "@/lib/devtools";

const isLogsEnabled = () =>
  getDevtoolsEnabled() || process.env.NODE_ENV === "development";

export async function initAsyncDriver(dbName: string) {
  const module = await SQLiteAsyncESMFactory({
    locateFile: () => asyncSqlWasmUrl,
  });

  const sqlite3 = SQLite.Factory(module);

  console.log("initAsyncDriver - spaceId", dbName);

  const vfs = await IDBBatchAtomicVFS.create("db-" + dbName, module);
  sqlite3.vfs_register(vfs, true);

  const db = await sqlite3.open_v2("db-" + dbName);

  await sqlite3.exec(db, `PRAGMA cache_size=5000;`);
  await sqlite3.exec(db, `PRAGMA journal_mode=DELETE;`);

  const sqliteDb: AsyncSQLiteDB = {
    async exec(sql: string, params?: SqlValue[] | null): Promise<void> {
      for await (const stmt of sqlite3.statements(db, sql)) {
        if (params) sqlite3.bind_collection(stmt, params);
        await sqlite3.step(stmt);
      }
    },
    async prepare(sql: string) {
      return {
        async values(values: SqlValue[]): Promise<SqlValue[][]> {
          const rows: SqlValue[][] = [];

          for await (const stmt of sqlite3.statements(db, sql)) {
            sqlite3.bind_collection(stmt, values);

            while ((await sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
              rows.push(sqlite3.row(stmt) as SqlValue[]);
            }
          }

          return rows;
        },
        finalize(): void {
          // wa-sqlite finalizes scoped statements after iteration.
        },
      };
    },
  };

  // @ts-expect-error it's ok
  window.execQuery = async (q: string) => {
    const res: unknown[] = [];
    for await (const stmt of sqlite3.statements(db, q)) {
      while ((await sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
        const row = sqlite3.row(stmt);
        const record = JSON.parse(row[0] as string) as unknown;
        res.push(record);
      }
    }

    return res;
  };

  return new AsyncSqlDriver(sqliteDb, {
    debug: isLogsEnabled() ? logAsyncSqlDriverDebugEvent : undefined,
  });
}
