import { useSyncExternalStore } from "react";

export const WEB_DEVTOOLS_ENABLED_KEY = "will-be-done:hyperdb-devtools-enabled";
export const HYPERDB_DEVTOOLS_OPEN_KEY = "hyperdb-devtools-open";

const DEVTOOLS_SETTING_CHANGED = "will-be-done:devtools-setting-changed";

const defaultDevtoolsEnabled = process.env.NODE_ENV === "development";

function readBooleanSetting(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return fallback;
    return value === "true";
  } catch {
    return fallback;
  }
}

function writeBooleanSetting(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage failures so the UI can still update for this session.
  }
}

export function getDevtoolsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return readBooleanSetting(WEB_DEVTOOLS_ENABLED_KEY, defaultDevtoolsEnabled);
}

export function setDevtoolsEnabled(enabled: boolean): void {
  writeBooleanSetting(WEB_DEVTOOLS_ENABLED_KEY, enabled);
  writeBooleanSetting(HYPERDB_DEVTOOLS_OPEN_KEY, enabled);
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DEVTOOLS_SETTING_CHANGED));
}

function subscribeToDevtoolsEnabled(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === WEB_DEVTOOLS_ENABLED_KEY ||
      event.key === HYPERDB_DEVTOOLS_OPEN_KEY
    ) {
      onStoreChange();
    }
  };

  window.addEventListener(DEVTOOLS_SETTING_CHANGED, onStoreChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(DEVTOOLS_SETTING_CHANGED, onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function useDevtoolsEnabled(): boolean {
  return useSyncExternalStore(
    subscribeToDevtoolsEnabled,
    getDevtoolsEnabled,
    () => false,
  );
}
