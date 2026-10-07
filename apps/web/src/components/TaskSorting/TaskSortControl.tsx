import { useEffect, useRef } from "react";
import { useFocusStore } from "@/store/focusSlice";
import { isInputElement } from "@/utils/isInputElement";
import { isTaskSortMode, taskSortLabels, taskSortModes } from "./taskSorting";
import { useTaskSorting } from "./useTaskSorting";
import { useLocation } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TaskSortControl({ viewKey }: { viewKey: string }) {
  const { sortMode, setSortMode } = useTaskSorting(viewKey);
  const ref = useRef<HTMLButtonElement>(null);
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          ref={ref}
          type="button"
          aria-label="Sort tasks"
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded border border-content-tinted/20 bg-surface px-2 py-1 text-xs text-content outline-none hover:bg-panel-hover focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span>{taskSortLabels[sortMode]}</span>
          <ChevronDown className="size-3" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-1100">
        <DropdownMenuLabel>Sort tasks</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sortMode}
          onValueChange={(value) => {
            if (isTaskSortMode(value)) setSortMode(value);
          }}
        >
          {taskSortModes.map((mode) => (
            <DropdownMenuRadioItem key={mode} value={mode}>
              {taskSortLabels[mode]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-4">
          Cycle sort
          <DropdownMenuShortcut>Q</DropdownMenuShortcut>
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
