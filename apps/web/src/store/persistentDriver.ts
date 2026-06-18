import { useSyncExternalStore } from "react";
import { openIndexedDBDriver } from "@will-be-done/hyperdb-lib/drivers/idb";
import { initAsyncDriver } from "./asyncDriver";

export type PersistentDriverKind = "wa-sqlite" | "indexeddb";

const PERSISTENT_DRIVER_CHANGED = "will-be-done:persistent-driver-changed";

const PERSISTENT_DRIVER_KEY = "will-be-done:persistent-driver";

const legacyPersistentDriverKey = (dbName: string) =>
  `${PERSISTENT_DRIVER_KEY}:${dbName}`;

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

export function getPersistentDriverKind(
  dbName?: string,
): PersistentDriverKind {
  if (typeof window === "undefined") return "wa-sqlite";

  try {
    const value = localStorage.getItem(PERSISTENT_DRIVER_KEY);
    if (isPersistentDriverKind(value)) return value;

    return getLegacyPersistentDriverKind(dbName) ?? "wa-sqlite";
  } catch {
    return "wa-sqlite";
  }
}

export function setPersistentDriverKind(kind: PersistentDriverKind): void {
  try {
    localStorage.setItem(PERSISTENT_DRIVER_KEY, kind);
  } catch {
    // Ignore storage failures so the navigation can still continue.
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PERSISTENT_DRIVER_CHANGED));
  }
}

function subscribeToPersistentDriverKind(onStoreChange: () => void): () => void {
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

export function usePersistentDriverKind(): PersistentDriverKind {
  return useSyncExternalStore(
    subscribeToPersistentDriverKind,
    () => getPersistentDriverKind(),
    () => "wa-sqlite",
  );
}

export async function openPersistentDriver(dbName: string) {
  if (getPersistentDriverKind() === "indexeddb") {
    return openIndexedDBDriver(dbName);
  }

  return initAsyncDriver(dbName);
}
