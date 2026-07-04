import { useSyncExternalStore } from "react";
import {
  openIndexedDBDriver,
  logIdbDriverDebugEvent,
} from "@will-be-done/hyperdb/drivers/idb";
import { initAsyncDriver } from "./asyncDriver";
import { getDevtoolsEnabled } from "@/lib/devtools";

export type PersistentDriverKind = "wa-sqlite" | "indexeddb";

const PERSISTENT_DRIVER_CHANGED = "will-be-done:persistent-driver-changed";

const PERSISTENT_DRIVER_KEY = "will-be-done:persistent-driver";

const isLogsEnabled = () =>
  getDevtoolsEnabled() || process.env.NODE_ENV === "development";

const resolvedPersistentDriverKinds: Record<string, PersistentDriverKind> = {};

const legacyPersistentDriverKey = (dbName: string) =>
  `${PERSISTENT_DRIVER_KEY}:${dbName}`;

const waSqliteIndexedDbName = (dbName: string) => `db-${dbName}`;

const isPersistentDriverKind = (
  value: string | null,
): value is PersistentDriverKind =>
  value === "wa-sqlite" || value === "indexeddb";

function getLegacyPersistentDriverKind(
  dbName?: string,
): PersistentDriverKind | null {
  if (typeof window === "undefined") return null;

  if (dbName) {
    const value = localStorage.getItem(legacyPersistentDriverKey(dbName));
    return isPersistentDriverKind(value) ? value : null;
  }

  let foundLegacyKind: PersistentDriverKind | null = null;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(`${PERSISTENT_DRIVER_KEY}:`)) continue;

    const value = localStorage.getItem(key);
    if (value === "indexeddb") {
      return "indexeddb";
    }
    if (value === "wa-sqlite") {
      foundLegacyKind = "wa-sqlite";
    }
  }

  return foundLegacyKind;
}

function getStoredPersistentDriverKind(
  dbName?: string,
): PersistentDriverKind | null {
  if (typeof window === "undefined") return "wa-sqlite";

  try {
    const value = localStorage.getItem(PERSISTENT_DRIVER_KEY);
    if (isPersistentDriverKind(value)) return value;

    return getLegacyPersistentDriverKind(dbName);
  } catch {
    return null;
  }
}

function notifyPersistentDriverKindChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PERSISTENT_DRIVER_CHANGED));
  }
}

export function getPersistentDriverKind(dbName?: string): PersistentDriverKind {
  const storedKind = getStoredPersistentDriverKind(dbName);
  if (storedKind) return storedKind;

  if (dbName && resolvedPersistentDriverKinds[dbName]) {
    return resolvedPersistentDriverKinds[dbName];
  }

  if (typeof window === "undefined") return "wa-sqlite";

  return "indexeddb";
}

async function hasExistingWaSqliteDatabase(dbName: string): Promise<boolean> {
  if (typeof indexedDB === "undefined" || !indexedDB.databases) {
    return true;
  }

  try {
    const databases = await indexedDB.databases();
    return databases.some(({ name }) => name === waSqliteIndexedDbName(dbName));
  } catch {
    return true;
  }
}

export async function resolvePersistentDriverKind(
  dbName: string,
): Promise<PersistentDriverKind> {
  const storedKind = getStoredPersistentDriverKind(dbName);
  if (storedKind) return storedKind;

  const nextKind = (await hasExistingWaSqliteDatabase(dbName))
    ? "wa-sqlite"
    : "indexeddb";

  if (resolvedPersistentDriverKinds[dbName] !== nextKind) {
    resolvedPersistentDriverKinds[dbName] = nextKind;
    notifyPersistentDriverKindChanged();
  }

  return nextKind;
}

export function setPersistentDriverKind(kind: PersistentDriverKind): void {
  try {
    localStorage.setItem(PERSISTENT_DRIVER_KEY, kind);
  } catch {
    // Ignore storage failures so the navigation can still continue.
  }

  notifyPersistentDriverKindChanged();
}

function subscribeToPersistentDriverKind(
  onStoreChange: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === PERSISTENT_DRIVER_KEY ||
      event.key?.startsWith(`${PERSISTENT_DRIVER_KEY}:`)
    ) {
      onStoreChange();
    }
  };

  window.addEventListener(PERSISTENT_DRIVER_CHANGED, onStoreChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(PERSISTENT_DRIVER_CHANGED, onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function usePersistentDriverKind(dbName?: string): PersistentDriverKind {
  return useSyncExternalStore(
    subscribeToPersistentDriverKind,
    () => getPersistentDriverKind(dbName),
    () => "wa-sqlite",
  );
}

export async function openPersistentDriver(dbName: string) {
  if ((await resolvePersistentDriverKind(dbName)) === "indexeddb") {
    return openIndexedDBDriver(dbName, {
      debug: isLogsEnabled() ? logIdbDriverDebugEvent : undefined,
    });
  }

  return initAsyncDriver(dbName);
}
