import { useEffect, type RefObject } from "react";
import { useLocation } from "@tanstack/react-router";
import { useFocusStore } from "@/store/focusSlice";
import { isInputElement } from "@/utils/isInputElement";
import { taskSortModes } from "./taskSorting";
import { useTaskSorting } from "./useTaskSorting";

/** Attach Q to the visible view control, even when its options are closed. */
export function useTaskSortShortcut({
  viewKey,
  controlRef,
}: {
  viewKey: string;
  controlRef: RefObject<HTMLButtonElement | null>;
}) {
  const { sortMode, setSortMode } = useTaskSorting(viewKey);
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
      const control = controlRef.current;
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
  }, [sortMode, setSortMode, viewKey, pathname, controlRef]);
}
