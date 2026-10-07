import { useEffect, useRef } from "react";
import { useFocusStore } from "@/store/focusSlice";
import { isInputElement } from "@/utils/isInputElement";
import { isTaskSortMode, taskSortLabels, taskSortModes } from "./taskSorting";
import { useTaskSorting } from "./useTaskSorting";
import { useLocation } from "@tanstack/react-router";

export function TaskSortControl({ viewKey }: { viewKey: string }) {
  const { sortMode, setSortMode } = useTaskSorting(viewKey);
  const ref = useRef<HTMLSelectElement>(null);
  const pathname = useLocation({ select: (location) => location.pathname });
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (
        event.code !== "KeyQ" ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      )
        return;
      const focus = useFocusStore.getState();
      if (focus.isFocusDisabled || focus.editItemKey) return;
      if (event.target instanceof Element && isInputElement(event.target))
        return;
      const control = ref.current;
      const hiddenRegion = '[aria-hidden="true"], [inert]';
      if (
        !control ||
        control.getClientRects().length === 0 ||
        control.closest(hiddenRegion)
      )
        return;
      // A focused embedded panel owns the shortcut instead of its surrounding view.
      const focusedView = document.activeElement?.closest(
        "[data-task-sort-view]",
      );
      if (focusedView && !focusedView.closest(hiddenRegion)) {
        if (focusedView.getAttribute("data-task-sort-view") !== viewKey) return;
      } else if (pathname.includes("/timeline") && viewKey !== "timeline") {
        return;
      } else if (pathname.includes("/dates") && viewKey !== "daily") {
        return;
      } else if (pathname.includes("/all-tasks") && viewKey !== "all-tasks") {
        return;
      }
      event.preventDefault();
      setSortMode(
        taskSortModes[
          (taskSortModes.indexOf(sortMode) + 1) % taskSortModes.length
        ],
      );
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [sortMode, setSortMode, viewKey, pathname]);
  return (
    <label className="inline-flex shrink-0 items-center gap-2 text-xs text-content-tinted">
      <span>Sort</span>
      <select
        ref={ref}
        aria-label="Sort tasks"
        title="Cycle sort: Q"
        value={sortMode}
        onChange={(event) => {
          if (isTaskSortMode(event.target.value))
            setSortMode(event.target.value);
        }}
        className="cursor-pointer rounded border border-content-tinted/20 bg-surface px-2 py-1 text-content outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {taskSortModes.map((mode) => (
          <option key={mode} value={mode}>
            {taskSortLabels[mode]}
          </option>
        ))}
      </select>
    </label>
  );
}
