import { HyperDB, TableDefinition } from "@will-be-done/hyperdb";
import type { ChangesetArrayType } from "@will-be-done/slices/common";

export interface SyncConfig {
  dbId: string;
  dbType: "user" | "space";
  persistDBTables: TableDefinition[];
  inmemDBTables: TableDefinition[];
  syncableDBTables: TableDefinition[];
  tableNameMap: Record<string, TableDefinition>;
  afterInit: (db: HyperDB) => void | Promise<void>;
  disableSync?: boolean;
}

export type ChangePersistedEvent = {
  changeset: ChangesetArrayType;
};
