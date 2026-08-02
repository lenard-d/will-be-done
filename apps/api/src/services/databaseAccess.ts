import { selectSync, syncDispatch, type DB } from "@will-be-done/hyperdb";
import { spaceDBConfig } from "../db/configs";
import { getHyperDB, getMainHyperDB } from "../db/db";
import { getDbById, getDbByIdOrCreate } from "../slices/dbSlice";

export type DatabaseType = "user" | "space";

export class DatabaseAccessDeniedError extends Error {
  constructor(databaseType: DatabaseType) {
    super(`Access denied to ${databaseType}`);
    this.name = "DatabaseAccessDeniedError";
  }
}

export function ensureDatabaseAccessOrCreate(
  {
    dbId,
    dbType,
    userId,
  }: {
    dbId: string;
    dbType: DatabaseType;
    userId: string;
  },
  mainDB: DB = getMainHyperDB(),
): void {
  if (dbType === "user") {
    if (userId !== dbId) {
      throw new DatabaseAccessDeniedError(dbType);
    }
    return;
  }

  const existing = selectSync(mainDB, {
    selector: getDbById,
    args: { id: dbId, type: dbType },
  });

  if (existing) {
    if (existing.userId !== userId) {
      throw new DatabaseAccessDeniedError(dbType);
    }
    return;
  }

  syncDispatch(mainDB, getDbByIdOrCreate({ id: dbId, type: dbType, userId }));
}

export function getSpaceDatabase(spaceId: string, userId: string) {
  ensureDatabaseAccessOrCreate({ dbId: spaceId, dbType: "space", userId });
  return getHyperDB(spaceDBConfig(spaceId)).db;
}
