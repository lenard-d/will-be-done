import { useSyncExternalStore } from "react";
import { isTaskSortMode, type TaskSortMode } from "./taskSorting";

const settingPrefix = "will-be-done:task-sort:";
const settingChanged = "will-be-done:task-sort-changed";
const sessionSettings = new Map<string, TaskSortMode>();

function readSetting(key: string): TaskSortMode | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const value = localStorage.getItem(key);
    return isTaskSortMode(value) ? value : sessionSettings.get(key);
  } catch {
    return sessionSettings.get(key);
  }
}

function writeSetting(key: string, mode: TaskSortMode): void {
  sessionSettings.set(key, mode);
  try {
    localStorage.setItem(key, mode);
  } catch {
    // Keep the setting for this session when browser storage is unavailable.
  }
  window.dispatchEvent(new Event(settingChanged));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(settingChanged, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(settingChanged, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function getDefaultTaskSortMode(): TaskSortMode {
  return readSetting(`${settingPrefix}default`) ?? "date";
}

export function setDefaultTaskSortMode(mode: TaskSortMode): void {
  writeSetting(`${settingPrefix}default`, mode);
}

export function useDefaultTaskSortMode(): TaskSortMode {
  return useSyncExternalStore(subscribe, getDefaultTaskSortMode, () => "date");
}

export function useTaskSorting(viewKey: string) {
  const key = `${settingPrefix}view:${viewKey}`;
  const sortMode = useSyncExternalStore<TaskSortMode>(
    subscribe,
    () => readSetting(key) ?? getDefaultTaskSortMode(),
    () => "date",
  );
  return {
    sortMode,
    setSortMode: (mode: TaskSortMode) => writeSetting(key, mode),
  };
}
