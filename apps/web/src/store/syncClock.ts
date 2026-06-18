import { nanoid } from "nanoid";
import { getPersistentDriverKind } from "./persistentDriver";
import type { SyncConfig } from "./syncTypes";

export const getDbName = (syncConfig: Pick<SyncConfig, "dbType" | "dbId">) => {
  return syncConfig.dbType + "-" + syncConfig.dbId;
};

export const initClock = (clientId: string) => {
  let now = Date.now();
  let n = 0;

  return () => {
    const newNow = Date.now();

    if (newNow === now) {
      n++;
    } else if (newNow > now) {
      now = newNow;
      n = 0;
    } else {
      // Clock went backwards — keep `now` at its current high-water mark
      // and increment the counter to preserve strict monotonicity.
      n++;
    }

    return `${now}-${n.toString().padStart(4, "0")}-${clientId}`;
  };
};

export const getClientId = (dbName: string) => {
  const driverKind = getPersistentDriverKind();
  const key =
    driverKind === "wa-sqlite"
      ? "clientId-" + dbName
      : `clientId-${dbName}-${driverKind}`;

  let id: string | null = null;
  try {
    id = localStorage.getItem(key);
  } catch (e) {
    console.warn("Failed to read client id from localStorage", e);
  }

  if (id) return id;

  const newId = nanoid();
  try {
    localStorage.setItem(key, newId);
  } catch (e) {
    console.warn("Failed to save client id to localStorage", e);
  }

  return newId;
};
