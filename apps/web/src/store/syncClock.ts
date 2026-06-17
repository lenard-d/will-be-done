import { nanoid } from "nanoid";
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
      now = newNow;
      n = 0;
    }

    return `${now}-${n.toString().padStart(4, "0")}-${clientId}`;
  };
};

export const getClientId = (dbName: string) => {
  const key = "clientId-" + dbName;

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
